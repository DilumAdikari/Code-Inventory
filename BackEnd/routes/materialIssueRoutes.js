const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MaterialIssue = require('../models/MaterialIssue');
const Stock = require('../models/Stock');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

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
      }
    }
  }
};

// GET ALL
router.get('/', async (req, res) => {
  try {
    const issues = await MaterialIssue.find()
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .populate({ path: 'productionOrder', select: 'productionOrderNo' })
      .populate({ path: 'warehouse', select: 'warehouseName warehouseCode' })
      .populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' }) // 🌟 model: 'Factory' එකතු කර ඇත[cite: 7]
      .populate({ path: 'workflow', select: 'code' })
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' })
      .sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET BOM FOR PRODUCTION ORDER
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

// CREATE MANUAL ISSUE
router.post('/manual-issue', async (req, res) => {
  const { salesOrderId, productionOrderId, workflowId, plantId, items, createdBy } = req.body;

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
          plant: plantId || null,
          workflow: workflowId || null,
          issueType: 'Manual',
          status: 'PENDING_ISSUE',
          items: formattedItems,
          createdBy: createdBy || 'SYSTEM'
        });

        savedIssue = await newMaterialIssue.save();
      } catch (saveErr) {
        if (saveErr.code === 11000) {
          attempts++;
        } else {
          throw saveErr;
        }
      }
    }

    if (!savedIssue) {
      return res.status(500).json({ message: "Failed to generate unique Issue No." });
    }

    res.status(201).json(savedIssue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// SUBMIT FOR APPROVAL
router.post('/submit-approval/:id', async (req, res) => {
  const { createdBy } = req.body;
  try {
    const issue = await MaterialIssue.findById(req.params.id)
      .populate('salesOrder', 'orderRef')
      .populate('workflow');

    if (!issue) return res.status(404).json({ message: "Material Issue not found." });

    const targetApprover = await getApproverFromWorkflow(issue.workflow._id || issue.workflow);
    if (!targetApprover) {
      return res.status(400).json({ message: "No valid approver found in workflow." });
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
      summary: `Material Issue ${issue.issueNo} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    res.json({ message: "Submitted for approval.", issue, approver: targetApprover });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// FINALIZE
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

    await deductStockForIssue(issue);

    const updatedIssue = await MaterialIssue.findById(issue._id)
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .populate({ path: 'productionOrder', select: 'productionOrderNo' })
      .populate({ path: 'warehouse', select: 'warehouseName' })
      .populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' }) // 🌟 model: 'Factory' එකතු කර ඇත[cite: 7]
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' });

    res.json(updatedIssue);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE PLANT / FACTORY on existing issue
router.put('/update-plant/:id', async (req, res) => {
  const { plantId } = req.body;
  try {
    if (!plantId) return res.status(400).json({ message: 'plantId is required' });

    const updated = await MaterialIssue.findByIdAndUpdate(
      req.params.id,
      { plant: mongoose.Types.ObjectId.isValid(plantId) ? new mongoose.Types.ObjectId(plantId) : plantId },
      { new: true }
    ).populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' }); //[cite: 7]

    if (!updated) return res.status(404).json({ message: 'Issue not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE ITEMS
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

    const updated = await MaterialIssue.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ message: 'Issue not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;