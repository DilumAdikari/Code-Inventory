const express = require('express');
const router = express.Router();
const ProductionOrder = require('../models/ProductionOrder');
const Stock = require('../models/Stock');
const SalesOrder = require('../models/SalesOrder');
const Costing = require('../models/Costing');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

// ✅ HELPER — extract first approver username from workflow
const getApproverFromWorkflow = async (workflowId) => {
  const wfDoc = await Workflow.findById(workflowId)
    .populate('usersConfiguration.user', 'username');

  if (!wfDoc || !wfDoc.usersConfiguration || wfDoc.usersConfiguration.length === 0) {
    return null;
  }

  const approverConfigs = wfDoc.usersConfiguration
    .filter(c => c.mode === 'APPROVER')
    .sort((a, b) => a.order - b.order);

  if (approverConfigs.length > 0 && approverConfigs[0].user?.username) {
    return approverConfigs[0].user.username.trim().toUpperCase();
  }

  const receiverConfigs = wfDoc.usersConfiguration
    .filter(c => c.mode === 'RECEIVER')
    .sort((a, b) => a.order - b.order);

  if (receiverConfigs.length > 0 && receiverConfigs[0].user?.username) {
    return receiverConfigs[0].user.username.trim().toUpperCase();
  }

  return null;
};

// ✅ 1. GET ALL PRODUCTION ORDERS — must be before /:id
router.get('/', async (req, res) => {
  try {
    const pos = await ProductionOrder.find()
      .populate({ path: 'salesOrder', options: { strictPopulate: false } })
      .populate({ path: 'workflow', options: { strictPopulate: false } })
      .populate({ path: 'costing', options: { strictPopulate: false } })
      .sort({ createdAt: -1 });
    res.json(pos);
  } catch (err) {
    console.error("❌ Error fetching POs:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 2. GET SALES ORDER SIZES — specific path before /:id
router.get('/sales-order-details/:id', async (req, res) => {
  try {
    const order = await SalesOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Sales Order not found" });
    res.json(order.quantities || order.items || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 3. GET COSTING ITEMS — specific path before /:id
router.get('/costing-details/:id', async (req, res) => {
  try {
    const costing = await Costing.findById(req.params.id)
      .populate({ path: 'items.material', model: 'Material', options: { strictPopulate: false } })
      .populate({ path: 'items.color', model: 'Color', options: { strictPopulate: false } });

    if (!costing) return res.status(404).json({ message: "Costing Sheet not found" });
    res.json(costing);
  } catch (err) {
    console.error("❌ Error in costing-details:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 4. CREATE NEW PRODUCTION ORDER
router.post('/create', async (req, res) => {
  const {
    targetDate,
    workflowId,
    salesOrderId,
    costingId,
    garmentQuantities,
    bomItems,
    remarks,
    createdBy
  } = req.body;

  try {
    if (!targetDate || !workflowId || !salesOrderId || !costingId) {
      return res.status(400).json({ message: "Please provide all required fields." });
    }

    const lastOrder = await ProductionOrder.findOne().sort({ createdAt: -1 });
    let nextNo = 1;
    if (lastOrder && lastOrder.productionOrderNo) {
      const match = lastOrder.productionOrderNo.match(/PROD-(\d+)/);
      if (match) nextNo = parseInt(match[1], 10) + 1;
    }
    const generatedOrderNo = `PROD-${String(nextNo).padStart(5, '0')}`;

    const newPO = new ProductionOrder({
      productionOrderNo: generatedOrderNo,
      targetDate,
      workflow: workflowId,
      salesOrder: salesOrderId,
      costing: costingId,
      garmentQuantities,
      bomItems: [],
      remarks,
      status: 'Draft'
    });

    await newPO.save();

    const populatedPO = await ProductionOrder.findById(newPO._id)
      .populate({ path: 'salesOrder', options: { strictPopulate: false } })
      .populate({ path: 'workflow', options: { strictPopulate: false } });

    console.log(`✅ [PO CREATED] ${generatedOrderNo}`);
    res.status(201).json(populatedPO);
  } catch (err) {
    console.error("❌ Error creating Production Order:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 5. SUBMIT FOR APPROVAL — specific POST path before any /:id
router.post('/submit-approval/:id', async (req, res) => {
  const { createdBy } = req.body;
  try {
    const po = await ProductionOrder.findById(req.params.id)
      .populate('salesOrder', 'orderRef')
      .populate('workflow');

    if (!po) return res.status(404).json({ message: "Production Order not found." });

    if (po.status !== 'Draft') {
      return res.status(400).json({ 
        message: "Only Draft orders can be submitted for approval." 
      });
    }

    const targetApprover = await getApproverFromWorkflow(po.workflow._id || po.workflow);

    if (!targetApprover) {
      return res.status(400).json({ 
        message: "No valid approver found in the assigned workflow. Please check workflow configuration." 
      });
    }

    po.status = 'Pending Approval';
    await po.save();

    await Approval.deleteOne({ docId: po._id, status: 'PENDING' });

    const newApproval = new Approval({
      documentType: 'Production Order',
      docId: po._id,
      docNo: po.productionOrderNo,
      requestedBy: createdBy || 'SYSTEM',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `Production Order ${po.productionOrderNo} for Sales Order ${po.salesOrder?.orderRef || 'N/A'} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    console.log(`✅ [PO APPROVAL CREATED] ${po.productionOrderNo} → assigned to: ${targetApprover}`);

    res.json({ 
      message: "Production Order submitted for approval.", 
      po, 
      approver: targetApprover 
    });
  } catch (err) {
    console.error("❌ Submit approval error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 6. SAVE BOM ITEMS — specific PUT path BEFORE /:id
router.put('/save-bom/:id', async (req, res) => {
  try {
    const { bomItems } = req.body;

    const updatedPO = await ProductionOrder.findByIdAndUpdate(
      req.params.id,
      { bomItems },
      { new: true }
    );

    if (!updatedPO) {
      return res.status(404).json({ message: "Production Order not found." });
    }

    console.log(`✅ [BOM SAVED] PO ID: ${req.params.id}`);
    res.json(updatedPO);
  } catch (err) {
    console.error("❌ Error saving BOM:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 7. UPDATE STATUS — generic /:id MUST BE LAST
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;

    const updatedPO = await ProductionOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedPO) {
      return res.status(404).json({ message: "Production Order not found." });
    }

    console.log(`✅ [PO STATUS UPDATED] ${req.params.id} → ${status}`);
    res.json(updatedPO);
  } catch (err) {
    console.error("❌ Error updating PO status:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;