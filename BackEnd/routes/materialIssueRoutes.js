const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MaterialIssue = require('../models/MaterialIssue');
const Stock = require('../models/Stock');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

// ✅ HELPER — extract first approver from workflow
const getApproverFromWorkflow = async (workflowId) => {
  if (!workflowId) return null;
  const wfDoc = await Workflow.findById(workflowId)
    .populate('usersConfiguration.user', 'username');
  if (!wfDoc || !wfDoc.usersConfiguration || wfDoc.usersConfiguration.length === 0) return null;

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

// ✅ HELPER — deduct stock for all items in an issue
const deductStockForIssue = async (issue) => {
  if (!issue.items || issue.items.length === 0) return;
  for (let item of issue.items) {
    if (item.material && issue.warehouse) {
      const issuedQty = Number(item.issuedQty || item.allocatedQty || 0);
      if (issuedQty > 0) {
        await Stock.findOneAndUpdate(
          {
            material: item.material,
            color: item.color || null,
            warehouse: issue.warehouse
          },
          { $inc: { qty: -issuedQty } },
          { new: true }
        );
        console.log(`✅ Stock deducted: material ${item.material} qty -${issuedQty}`);
      }
    }
  }
};

// ✅ 1. GET ALL — specific routes BEFORE /:id
router.get('/', async (req, res) => {
  try {
    const issues = await MaterialIssue.find()
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .populate({ path: 'productionOrder', select: 'productionOrderNo' })
      .populate({ path: 'warehouse', select: 'warehouseName warehouseCode' })
      .populate({ path: 'workflow', select: 'code' })
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' })
      .sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    console.error("❌ MaterialIssue Fetch Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 2. GET BOM FOR PRODUCTION ORDER — specific path BEFORE /:id
router.get('/production-order-bom/:id', async (req, res) => {
  try {
    const po = await mongoose.model('ProductionOrder').findById(req.params.id)
      .populate('bomItems.material');
    if (!po) return res.status(404).json({ message: "PO not found" });
    res.json(po.bomItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 3. CREATE MANUAL ISSUE — specific path BEFORE /:id (Safe against duplicate issueNo)
router.post('/manual-issue', async (req, res) => {
  const { salesOrderId, productionOrderId, workflowId, items, createdBy } = req.body;

  try {
    let finalSalesOrderId = salesOrderId;
    if (!finalSalesOrderId && productionOrderId) {
      const po = await mongoose.model('ProductionOrder').findById(productionOrderId);
      if (po) finalSalesOrderId = po.salesOrder;
    }

    const defaultWarehouse = await mongoose.model('Warehouse').findOne();
    const warehouseId = defaultWarehouse ? defaultWarehouse._id : null;

    const defaultColor = await mongoose.model('Color').findOne();
    const fallbackColorId = defaultColor ? defaultColor._id : null;

    let savedIssue = null;
    let attempts = 0;

    // 🌟 ඩුප්ලිකේට් අංක ගැටළුව මඟහරවා ගැනීමට සහ ආරක්ෂිතව සේව් කිරීමට Retry Loop එකක් යොදා ඇත
    while (!savedIssue && attempts < 5) {
      try {
        const lastIssue = await MaterialIssue.findOne().sort({ _id: -1 });
        let nextNo = 1;
        if (lastIssue && lastIssue.issueNo) {
          const match = lastIssue.issueNo.match(/ISS-(\d+)/);
          if (match) nextNo = parseInt(match[1], 10) + 1 + attempts;
        } else {
          nextNo += attempts;
        }
        const generatedIssueNo = `ISS-${String(nextNo).padStart(5, '0')}`;

        const formattedItems = (items || []).map(item => ({
          material: item.material?._id || item.material,
          color: item.color?._id || item.color || fallbackColorId,
          uom: item.uom || 'Pcs',
          allocatedQty: Number(item.requiredQty || item.qty || 0),
          issuedQty: Number(item.requiredQty || item.qty || 0),
          value: Number(item.value || 0)
        }));

        const newMaterialIssue = new MaterialIssue({
          issueNo: generatedIssueNo,
          salesOrder: finalSalesOrderId,
          productionOrder: productionOrderId,
          warehouse: warehouseId,
          workflow: workflowId || null,
          issueType: 'Manual',
          status: 'PENDING_ISSUE',
          items: formattedItems,
          createdBy: createdBy || 'SYSTEM'
        });

        savedIssue = await newMaterialIssue.save();
      } catch (saveErr) {
        // MongoDB Duplicate Key Error Code = 11000
        if (saveErr.code === 11000) {
          attempts++;
          console.warn(`⚠️ Duplicate issueNo encountered, retrying (attempt ${attempts})...`);
        } else {
          throw saveErr;
        }
      }
    }

    if (!savedIssue) {
      return res.status(500).json({ message: "Failed to generate a unique Issue No after multiple attempts." });
    }

    console.log(`✅ [MANUAL ISSUE CREATED] ${savedIssue.issueNo} with ${savedIssue.items.length} items`);
    res.status(201).json(savedIssue);
  } catch (err) {
    console.error("❌ Error creating manual issue:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 4. SUBMIT FOR APPROVAL — specific path BEFORE /:id
router.post('/submit-approval/:id', async (req, res) => {
  const { createdBy } = req.body;
  try {
    const issue = await MaterialIssue.findById(req.params.id)
      .populate('salesOrder', 'orderRef')
      .populate('workflow');

    if (!issue) return res.status(404).json({ message: "Material Issue not found." });

    if (issue.status !== 'PENDING_ISSUE' && issue.status !== 'DRAFT') {
      return res.status(400).json({ message: "Only Draft/Pending issues can be submitted for approval." });
    }

    if (!issue.workflow) {
      return res.status(400).json({ message: "No workflow assigned. Please select a workflow when creating the issue." });
    }

    const targetApprover = await getApproverFromWorkflow(issue.workflow._id || issue.workflow);

    if (!targetApprover) {
      return res.status(400).json({ message: "No valid approver found in workflow. Please check workflow configuration." });
    }

    issue.status = 'Pending Approval';
    await issue.save();

    await Approval.deleteOne({ docId: issue._id, status: 'PENDING' });

    const newApproval = new Approval({
      documentType: 'Material Issue',
      docId: issue._id,
      docNo: issue.issueNo,
      requestedBy: createdBy || issue.createdBy || 'SYSTEM',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `Material Issue ${issue.issueNo} for Sales Order ${issue.salesOrder?.orderRef || 'N/A'} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    console.log(`✅ [MATERIAL ISSUE APPROVAL] ${issue.issueNo} → assigned to: ${targetApprover}`);

    res.json({ message: "Material Issue submitted for approval.", issue, approver: targetApprover });
  } catch (err) {
    console.error("❌ Submit approval error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 5. FINALIZE — specific path BEFORE generic /:id
router.put('/finalize/:id', async (req, res) => {
  const { warehouse } = req.body;
  try {
    const issue = await MaterialIssue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issuing record not found' });

    if (warehouse) {
      issue.warehouse = mongoose.Types.ObjectId.isValid(warehouse)
        ? new mongoose.Types.ObjectId(warehouse)
        : warehouse;
    }

    issue.status = 'ISSUED';
    await issue.save();

    // ✅ deduct stock
    await deductStockForIssue(issue);

    const updatedIssue = await MaterialIssue.findById(issue._id)
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .populate({ path: 'productionOrder', select: 'productionOrderNo' })
      .populate({ path: 'warehouse', select: 'warehouseName' })
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' });

    console.log(`✅ [FINALIZED] ${issue._id} → ISSUED, stock deducted`);
    res.json(updatedIssue);
  } catch (err) {
    console.error("❌ Finalize Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 6. UPDATE ITEMS + WAREHOUSE — for editing draft
router.put('/update-items/:id', async (req, res) => {
  const { warehouse, items } = req.body;
  try {
    const updateData = {};

    if (warehouse) {
      updateData.warehouse = mongoose.Types.ObjectId.isValid(warehouse)
        ? new mongoose.Types.ObjectId(warehouse)
        : warehouse;
    }

    if (items && items.length > 0) {
      updateData.items = items.map(item => ({
        material: mongoose.Types.ObjectId.isValid(item.material) ? new mongoose.Types.ObjectId(item.material) : item.material,
        color: mongoose.Types.ObjectId.isValid(item.color) ? new mongoose.Types.ObjectId(item.color) : item.color,
        uom: item.uom || 'Pcs',
        allocatedQty: Number(item.allocatedQty || 0),
        issuedQty: Number(item.issuedQty || 0),
        value: Number(item.value || 0)
      }));
    }

    const updated = await MaterialIssue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: 'Issue not found' });

    console.log(`✅ [ISSUE UPDATED] ${req.params.id} — items and warehouse saved`);
    res.json(updated);
  } catch (err) {
    console.error("❌ Update items error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;