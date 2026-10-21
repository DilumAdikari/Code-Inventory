const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MaterialIssue = require('../models/MaterialIssue');
const Stock = require('../models/Stock');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

// Converts a value to an ObjectId, or null when it is empty or invalid
const toObjectIdOrNull = (value) => {
  const raw = value?._id || value;
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

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

// Stock rows that belong to one issue row (material + colour + size + warehouse).
// Colourless / sizeless rows match only stock stored with null colour / size.
const stockQueryFor = (item, warehouse) => ({
  material: item.material,
  color: item.color || null,
  size: item.size || null,
  warehouse
});

// Short label for error messages
const itemLabel = async (item) => {
  const mat = await mongoose.model('Material').findById(item.material).select('itemCode materialName').lean();
  return mat ? `${mat.itemCode || 'MAT'} ${mat.materialName || ''}`.trim() : 'material';
};

// Checks that every row has enough stock. Returns an error message, or null when all rows are fine.
const checkStockForIssue = async (issue) => {
  for (const item of issue.items || []) {
    const needed = Number(item.issuedQty || 0);
    if (needed <= 0) continue;

    const rows = await Stock.find(stockQueryFor(item, issue.warehouse)).lean();
    const available = rows.reduce((total, r) => total + Number(r.qty || 0), 0);

    if (available < needed) {
      const label = await itemLabel(item);
      return `Insufficient stock for ${label}. Available: ${available}, Issue Qty: ${needed}.`;
    }
  }
  return null;
};

// Deducts the issued qty from the matching stock rows (oldest first).
// Throws when the stock is not enough, so stock never goes negative.
const deductStockForIssue = async (issue) => {
  for (const item of issue.items || []) {
    let remaining = Number(item.issuedQty || 0);
    if (remaining <= 0) continue;

    const rows = await Stock.find(stockQueryFor(item, issue.warehouse)).sort({ _id: 1 });
    for (const row of rows) {
      if (remaining <= 0) break;
      const take = Math.min(Number(row.qty || 0), remaining);
      if (take <= 0) continue;

      row.qty = Number(row.qty || 0) - take;
      await row.save();
      remaining -= take;
    }

    if (remaining > 0) {
      const label = await itemLabel(item);
      throw new Error(`Insufficient stock for ${label} while issuing.`);
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
      .populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' })
      .populate({ path: 'workflow', select: 'code' })
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' })
      .populate({ path: 'items.size', select: 'sizeCode sizeDescription' })
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

        // Colourless / sizeless rows keep colour / size as null (no fallback colour)
        const formattedItems = (items || []).map(item => {
          const qty = Number(item.requiredQty || item.qty || 0);
          return {
            material: toObjectIdOrNull(item.material) || item.material,
            color: toObjectIdOrNull(item.color),
            size: toObjectIdOrNull(item.size),
            uom: item.uom || 'Pcs',
            allocatedQty: qty,
            issuedQty: qty,
            value: Number(item.value || 0)
          };
        });

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

    if (!issue.workflow) {
      return res.status(400).json({ message: "No workflow assigned to this issue." });
    }

    // Stock must cover every row before the issue goes for approval
    const stockError = await checkStockForIssue(issue);
    if (stockError) return res.status(400).json({ message: stockError });

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
      issue.warehouse = toObjectIdOrNull(warehouse) || warehouse;
    }

    // Check stock first, then deduct, then mark the issue as ISSUED
    const stockError = await checkStockForIssue(issue);
    if (stockError) return res.status(400).json({ message: stockError });

    try {
      await deductStockForIssue(issue);
    } catch (deductErr) {
      return res.status(400).json({ message: deductErr.message });
    }

    issue.status = 'ISSUED';
    await issue.save();

    const updatedIssue = await MaterialIssue.findById(issue._id)
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .populate({ path: 'productionOrder', select: 'productionOrderNo' })
      .populate({ path: 'warehouse', select: 'warehouseName' })
      .populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' })
      .populate({ path: 'items.material', select: 'materialName itemCode' })
      .populate({ path: 'items.color', select: 'name colorName code' })
      .populate({ path: 'items.size', select: 'sizeCode sizeDescription' });

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
      { plant: toObjectIdOrNull(plantId) || plantId },
      { new: true }
    ).populate({ path: 'plant', model: 'Factory', select: 'name factoryCode location' });

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
      updateData.warehouse = toObjectIdOrNull(warehouse) || warehouse;
    }
    if (items && items.length > 0) {
      updateData.items = items.map(item => ({
        material: toObjectIdOrNull(item.material) || item.material,
        // Colourless / sizeless rows are saved with null colour / size
        color: toObjectIdOrNull(item.color),
        size: toObjectIdOrNull(item.size),
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