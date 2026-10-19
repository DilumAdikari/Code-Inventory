const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SalesOrder = require('../models/SalesOrder');
const Approval = require('../models/Approval');
const MaterialIssue = require('../models/MaterialIssue');
const Workflow = require('../models/Workflow');

// Escapes special regex characters so search text is matched literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Populates item material, item color and (optionally) workflow for an order
const populateOrder = (query) =>
  query
    .populate({ path: 'items.material', model: 'FinishedGood' })
    .populate('items.color');

// 0.1 GET NEXT SALES ORDER REF (e.g. SO-2026-0001)
// Must stay above GET /:id, otherwise "next-ref" is treated as an ID
router.get('/next-ref', async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    // Zero-padded refs sort correctly as strings, so the last one is the highest
    const lastOrder = await SalesOrder.findOne({ orderRef: { $regex: `^${prefix}` } })
      .sort({ orderRef: -1 })
      .select('orderRef');

    const lastNumber = lastOrder
      ? parseInt(lastOrder.orderRef.slice(prefix.length), 10) || 0
      : 0;

    res.json({ orderRef: `${prefix}${String(lastNumber + 1).padStart(4, '0')}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 0.2 GET SALES ORDERS (PAGED, with optional search and status filter)
// Must stay above GET /:id
router.get('/paged', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ orderRef: regex }, { buyerName: regex }];
    }

    const [data, total] = await Promise.all([
      SalesOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SalesOrder.countDocuments(filter)
    ]);

    res.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1. GET ALL SALES ORDERS
router.get('/', async (req, res) => {
  try {
    const orders = await populateOrder(
      SalesOrder.find().sort({ createdAt: -1 })
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1.1 GET SINGLE SALES ORDER BY ID
router.get('/:id', async (req, res) => {
  try {
    const order = await populateOrder(SalesOrder.findById(req.params.id));
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE NEW SALES ORDER (always starts as 'Draft')
router.post('/', async (req, res) => {
  const { orderRef, buyerName, shipmentDate, workflowTemplate, warehouse } = req.body;
  try {
    const newOrder = new SalesOrder({
      orderRef,
      buyerName,
      shipmentDate,
      workflowTemplate,
      warehouse,
      items: [],
      totalQuantity: 0,
      totalAmount: 0,
      status: 'Draft'
    });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 3. ADD ITEM TO SALES ORDER BREAKDOWN GRID
// Auto material issue and stock deduction are disabled: items are only recorded on the order
router.post('/:id/items', async (req, res) => {
  const { material, color, size, quantity, unitPrice, warehouse } = req.body;
  const reqQty = Number(quantity || 0);

  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const cleanMaterialId = material && material._id ? String(material._id) : String(material);
    const cleanColorId = color && color._id ? String(color._id) : String(color);

    const netRequiredQty = reqQty;
    const totalAutoIssued = 0;

    order.items.push({
      material: new mongoose.Types.ObjectId(cleanMaterialId),
      color: new mongoose.Types.ObjectId(cleanColorId),
      size: size || 'M',
      quantity: reqQty,
      netRequiredQty: Number(netRequiredQty),
      autoIssuedQty: Number(totalAutoIssued),
      unitPrice: Number(unitPrice),
      warehouse: warehouse || 'Main Warehouse'
    });

    order.totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    order.totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    await order.save();

    const populatedOrder = await populateOrder(SalesOrder.findById(order._id));
    res.json(populatedOrder);
  } catch (err) {
    console.error('Sales Order item breakdown error:', err);
    res.status(400).json({ message: err.message });
  }
});

// 4.1 UPDATE SALES ORDER STATUS (Submit for Approval and workflow user assignment)
router.put('/:id/status', async (req, res) => {
  const { status, workflowId, requestedBy } = req.body;

  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Sales Order not found' });

    if (order.status === 'Completed') {
      return res.status(400).json({ message: 'This Sales Order is already completed.' });
    }

    order.status = status;
    if (workflowId) {
      order.workflowTemplate = workflowId;
    }
    await order.save();

    // On 'Submit for Approval', notify only the users on the first approval level of the workflow
    if (status === 'Pending Approval') {

      if (!workflowId || !mongoose.Types.ObjectId.isValid(workflowId)) {
        return res.status(400).json({ message: 'Valid workflowId is required.' });
      }

      const workflow = await Workflow.findById(workflowId)
        .populate('usersConfiguration.user');

      if (!workflow || workflow.usersConfiguration.length === 0) {
        return res.status(400).json({ message: 'Workflow configuration not found or empty.' });
      }

      const firstLevel = Math.min(...workflow.usersConfiguration.map(u => u.order));

      const firstLevelUsers = workflow.usersConfiguration
        .filter(u => u.order === firstLevel);

      for (const config of firstLevelUsers) {
        const username = config.user?.username;
        if (!username) continue;

        await Approval.create({
          documentType: 'Sales Order',
          docId: order._id,
          docNo: order.orderRef,
          requestedBy: requestedBy || 'System User',
          approver: username,
          date: new Date().toISOString().split('T')[0],
          summary: `Buyer: ${order.buyerName} | Total Items: ${order.totalQuantity} | Total Value: LKR ${order.totalAmount}`,
          status: 'PENDING'
        });
      }
    }

    if (status === 'Completed') {
      const linkedIssues = await MaterialIssue.find({ salesOrder: order._id });

      for (const issueDoc of linkedIssues) {
        if (issueDoc.issuedQty > 0) {
          issueDoc.status = 'PENDING_ISSUE';
          await issueDoc.save();
        } else {
          await MaterialIssue.findByIdAndDelete(issueDoc._id);
        }
      }
    }

    const populatedOrder = await populateOrder(SalesOrder.findById(order._id));
    res.json(populatedOrder);
  } catch (err) {
    console.error('Sales Order status update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 5. DELETE ITEM FROM BREAKDOWN GRID
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.items = order.items.filter(item => item._id.toString() !== req.params.itemId);

    order.totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    order.totalAmount = order.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const updatedOrder = await order.save();

    const populatedOrder = await populateOrder(SalesOrder.findById(updatedOrder._id));
    res.json(populatedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;