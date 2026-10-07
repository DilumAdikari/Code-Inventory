const express = require('express');
const router = express.Router();
const SalesOrder = require('../models/SalesOrder');
const Approval = require('../models/Approval');
const Stock = require('../models/Stock'); 
const MaterialIssue = require('../models/MaterialIssue'); 
const Workflow = require('../models/Workflow'); 
const warehouse = require('../models/Warehouse');
const FinishedGood = require('../models/FinishedGood');

const mongoose = require('mongoose');

// 1. GET ALL SALES ORDERS
router.get('/', async (req, res) => {
  try {
    const orders = await SalesOrder.find()
      .populate({
        path: 'items.material',
        model: 'FinishedGood'
      })
      .populate('items.color')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 1.1 GET SINGLE SALES ORDER BY ID
router.get('/:id', async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id)
      .populate({
        path: 'items.material',
        model: 'FinishedGood'
      })
      .populate('items.color');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE NEW SALES ORDER BASE ENTRY (🌟 මුලින්ම අනිවාර්යයෙන්ම 'Draft' ලෙස හැදේ)
router.post('/', async (req, res) => {
  const {  orderRef, buyerName, shipmentDate, workflowTemplate, warehouse} = req.body;
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
router.post('/:id/items', async (req, res) => {
  const { material, color, size, quantity, unitPrice, warehouse } = req.body;
  const reqQty = Number(quantity || 0);

  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const cleanMaterialId = material && material._id ? String(material._id) : String(material);
    const cleanColorId = color && color._id ? String(color._id) : String(color);

    /* =========================================================
       🌟 [AUTO MATERIAL ISSUE & STOCK DEDUCT - COMMENTED OUT]
       මෙතැන තිබුණු ඔටෝ ඉෂු කිරීම සහ ස්ටොක් අඩු කිරීමේ ලොජික් එක 
       දැන් කමෙන්ට් කර ඇත. ඕර්ඩර් එකට අයිතම පමණක් ඇතුළත් වේ.
       =========================================================
       
       let queryFilter = {
         material: new mongoose.Types.ObjectId(cleanMaterialId.trim()),
         color: new mongoose.Types.ObjectId(cleanColorId.trim())
       };

       if (warehouse) {
         queryFilter.warehouse = warehouse;
       }

       const availableStocks = await Stock.find(queryFilter);

       let remainingToIssue = reqQty;
       let totalAutoIssued = 0;

       for (let stockDoc of availableStocks) {
         if (remainingToIssue <= 0) break;

         const stockQty = stockDoc.qty !== undefined ? stockDoc.qty : (stockDoc.availableQty || 0);
         if (stockQty <= 0) continue;

         const issueFromThisWarehouse = Math.min(stockQty, remainingToIssue);
         
         // Stock deduction commented out
         // await Stock.findByIdAndUpdate(stockDoc._id, {
         //   $inc: { qty: -issueFromThisWarehouse }
         // });

         // MaterialIssue creation commented out
         // const newIssueNode = new MaterialIssue({
         //   salesOrder: order._id,
         //   material: new mongoose.Types.ObjectId(cleanMaterialId),
         //   color: new mongoose.Types.ObjectId(cleanColorId),
         //   size: size || 'M', 
         //   warehouse: stockDoc.warehouse,
         //   issuedQty: issueFromThisWarehouse,
         //   status: 'PENDING_ISSUE'
         // });
         // await newIssueNode.save();

         remainingToIssue -= issueFromThisWarehouse;
         totalAutoIssued += issueFromThisWarehouse;
       }

       const netRequiredQty = remainingToIssue; 
    ========================================================= */

    // දැන් ඔටෝ ඉෂු වෙනුවට නියමිත ප්‍රමාණය පමණක් අයිතමයට ඇතුළත් වේ
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
    
    const populatedOrder = await SalesOrder.findById(order._id)
      .populate({
        path: 'items.material',
        model: 'FinishedGood'
      })
      .populate('items.color');

    res.json(populatedOrder);
  } catch (err) {
    console.error("❌ MRP Error inside Sales Order Breakdown:", err);
    res.status(400).json({ message: err.message });
  }
});

// 4.1 UPDATE SALES ORDER STATUS (🌟 Submit For Approval සහ Workflow User Assignment)
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

    // 🌟 'Submit For Approval' කළ විට අදාළ වර්ක්ෆ්ලෝ එකට අසයින් කළ නිවැරදි යූසර්ට පමණක් නොටිෆිකේෂන් යැවීම
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

      for (let issueDoc of linkedIssues) {
        if (issueDoc.issuedQty > 0) {
          issueDoc.status = 'PENDING_ISSUE'; 
          await issueDoc.save();
        } else {
          await MaterialIssue.findByIdAndDelete(issueDoc._id);
        }
      }
    }

    const populatedOrder = await SalesOrder.findById(order._id)
      .populate({
        path: 'items.material',
        model: 'FinishedGood'
      })
      .populate('items.color');

    res.json(populatedOrder);
  } catch (err) {
    console.error("❌ Status Update Route Error:", err);
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
    
    const populatedOrder = await SalesOrder.findById(updatedOrder._id)
      .populate({
        path: 'items.material',
        model: 'FinishedGood'
      })
      .populate('items.color');

    res.json(populatedOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;