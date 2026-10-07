const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

// ✅ HELPER
const getApproverFromWorkflow = async (workflowId) => {
  if (!workflowId) return null;

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

// ✅ 1. GET ALL
router.get('/', async (req, res) => {
  try {
    const orders = await PurchaseOrder.find()
      .populate('productionOrder')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 2. CREATE
router.post('/create', async (req, res) => {
  const { productionOrderId, supplierName, expectedDeliveryDate, items, remarks, workflowId, createdBy } = req.body;
  try {
    const totalAmount = items.reduce((sum, item) =>
      sum + (Number(item.orderedQty || 0) * Number(item.unitPrice || 0)), 0);

    const lastPO = await PurchaseOrder.findOne().sort({ createdAt: -1 });
    let nextNo = 1;
    if (lastPO && lastPO.purchaseOrderNo) {
      const match = lastPO.purchaseOrderNo.match(/PR-(\d+)/);
      if (match) nextNo = parseInt(match[1], 10) + 1;
    }
    const generatedPoNo = `PR-${String(nextNo).padStart(5, '0')}`;

    const newPO = new PurchaseOrder({
      purchaseOrderNo: generatedPoNo,
      productionOrder: productionOrderId,
      supplierName: supplierName || 'General Supplier',
      expectedDeliveryDate,
      items,
      totalAmount,
      remarks,
      status: 'Draft',
      workflowId: workflowId || null,
      createdBy: createdBy || 'SYSTEM'
    });

    const savedPO = await newPO.save();
    console.log(`✅ [PO CREATED] ${generatedPoNo}`);
    res.status(201).json(savedPO);
  } catch (err) {
    console.error("❌ PO Creation Error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ✅ 3. SUBMIT FOR APPROVAL — specific POST route BEFORE any /:id routes
router.post('/submit-approval/:id', async (req, res) => {
  const { createdBy, workflowId } = req.body;
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ message: "Purchase Order not found." });

    if (po.status !== 'Draft') {
      return res.status(400).json({ 
        message: "Only Draft Purchase Orders can be submitted for approval." 
      });
    }

    const resolvedWorkflowId = workflowId || po.workflowId;

    if (!resolvedWorkflowId) {
      return res.status(400).json({ 
        message: "No workflow assigned. Please select a workflow first." 
      });
    }

    const targetApprover = await getApproverFromWorkflow(resolvedWorkflowId);

    if (!targetApprover) {
      return res.status(400).json({ 
        message: "No valid approver found in workflow. Please check workflow configuration." 
      });
    }

    po.status = 'Pending Approval';
    po.workflowId = resolvedWorkflowId;
    await po.save();

    await Approval.deleteOne({ docId: po._id, status: 'PENDING' });

    const newApproval = new Approval({
      documentType: 'Purchase Order',
      docId: po._id,
      docNo: po.purchaseOrderNo,
      requestedBy: createdBy || po.createdBy || 'SYSTEM',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `Purchase Order ${po.purchaseOrderNo} for supplier ${po.supplierName} — Total: LKR ${po.totalAmount?.toLocaleString()} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    console.log(`✅ [PO APPROVAL CREATED] ${po.purchaseOrderNo} → assigned to: ${targetApprover}`);

    res.json({ 
      message: "Purchase Order submitted for approval.", 
      po, 
      approver: targetApprover 
    });
  } catch (err) {
    console.error("❌ Submit approval error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 4. UPDATE STATUS — specific PUT BEFORE generic /:id
router.put('/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });

    po.status = status;
    await po.save();
    res.json(po);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 5. UPDATE PO — specific PUT BEFORE generic /:id
router.put('/:id/update', async (req, res) => {
  const { supplierName, expectedDeliveryDate, items, remarks, status } = req.body;
  try {
    const totalAmount = items.reduce((sum, item) =>
      sum + (Number(item.orderedQty || 0) * Number(item.unitPrice || 0)), 0);

    const updatedPO = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { supplierName, expectedDeliveryDate, items, totalAmount, remarks, status: status || 'Draft' },
      { new: true }
    );

    if (!updatedPO) return res.status(404).json({ message: 'Purchase Order not found' });
    res.json(updatedPO);
  } catch (err) {
    console.error("❌ PO Update Error:", err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;