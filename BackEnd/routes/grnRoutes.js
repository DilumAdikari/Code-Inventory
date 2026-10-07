const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const GRN = require('../models/GRN');
const Material = require('../models/Material');
const FinishedGood = require('../models/FinishedGood');
const Stock = require('../models/Stock');
const TransactionType = require('../models/TransactionType');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');

// Safe model loading to prevent crashes
let PurchaseOrder = null;
try { PurchaseOrder = mongoose.models.PurchaseOrder || require('../models/PurchaseOrder'); } catch (e) { PurchaseOrder = null; }

let MaterialIssuing = null;
try { MaterialIssuing = mongoose.models.MaterialIssuing || require('../models/MaterialIssuing'); } catch (e) { MaterialIssuing = null; }

// ✅ HELPER: Process Stock Update (Reusable function when any GRN becomes Completed)
const processGrnStockUpdate = async (grnDoc) => {
  if (grnDoc.status === 'Completed' && grnDoc.items && grnDoc.items.length > 0) {
    for (let item of grnDoc.items) {
      if (item.material && item.storeLocation) {
        await Material.findByIdAndUpdate(item.material, { $inc: { stockBalance: Number(item.receivedQty || 0) } }).catch(() => {});
        await FinishedGood.findByIdAndUpdate(item.material, { $inc: { stockBalance: Number(item.receivedQty || 0) } }).catch(() => {});
        
        console.log('📌 SAVING STOCK FOR ITEM (Size Check):', {
          material: item.material,
          color: item.color,
          size: item.size, // මෙතන ObjectId එකක් තියෙනවද බලමු
          warehouse: item.storeLocation,
          unitPrice: Number(item.unitPrice || 0),
          qty: Number(item.receivedQty || 0)
        });

        // 🌟 Stock එකට Size එක සමඟ නිවැරදිව රෙකෝඩ් කිරීම
        await Stock.findOneAndUpdate(
          { 
            material: item.material, 
            color: item.color, 
            size: item.size || null, 
            warehouse: item.storeLocation, 
            unitPrice: Number(item.unitPrice || 0) 
          },
          { $inc: { qty: Number(item.receivedQty || 0) } },
          { upsert: true, new: true }
        );
      }
    }
  }
};

// ✅ HELPER
const getApproverFromWorkflow = async (workflowId) => {
  if (!workflowId) return null;
  const wfDoc = await Workflow.findById(workflowId)
    .populate('usersConfiguration.user', 'username').catch(() => null);
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

// ✅ 1. GET ALL
router.get('/', async (req, res) => {
  try {
    const grnList = await GRN.find()
      .populate({ path: 'supplier', select: 'supplierName', options: { strictPopulate: false } })
      .populate({ path: 'grnType', select: 'typeName typeCode sourceType', options: { strictPopulate: false } })
      .populate({ path: 'workflow', select: 'code', options: { strictPopulate: false } })
      .populate({ path: 'purchaseOrder', options: { strictPopulate: false } })
      .populate({ path: 'materialIssuing', options: { strictPopulate: false } })
      .populate({ path: 'items.material', select: 'materialName materialCode itemName itemCode colors uom sizes', options: { strictPopulate: false } })
      .populate({ path: 'items.color', select: 'colorName colorCode name nameS code', options: { strictPopulate: false } })
      .populate({ path: 'items.size', select: 'sizeCode sizeDescription name', options: { strictPopulate: false } })
      .populate({ path: 'items.storeLocation', select: 'warehouseName warehouseCode', options: { strictPopulate: false } })
      .sort({ createdAt: -1 });
    res.json(grnList || []);
  } catch (err) {
    console.error("❌ GRN GET Error:", err.message);
    try {
      const fallbackList = await GRN.find().sort({ createdAt: -1 });
      return res.json(fallbackList || []);
    } catch (innerErr) {
      res.status(500).json({ message: innerErr.message });
    }
  }
});

// ✅ 2. ALL ITEMS SEARCH
router.get('/all-items-search', async (req, res) => {
  try {
    const rawMaterials = await Material.find().populate('sizes').lean();
    const finishedGoods = await FinishedGood.find().populate('sizes').lean();
    const combinedItems = [
      ...rawMaterials.map(m => ({
        _id: m._id,
        itemCode: m.materialCode || m.itemCode || 'MAT',
        itemName: m.materialName || m.itemName || 'Material',
        uom: m.uom || 'Pcs',
        colors: m.colors || [],
        sizes: m.sizes || [],
        unitPrice: m.unitCost || m.unitPrice || 0,
        itemType: 'Raw Material'
      })),
      ...finishedGoods.map(f => ({
        _id: f._id,
        itemCode: f.itemCode || f.code || 'FG',
        itemName: f.itemName || f.name || 'Finished Good',
        uom: f.uom || 'Pcs',
        colors: f.colors || [],
        sizes: f.sizes || [],
        unitPrice: f.unitCost || f.unitPrice || 0,
        itemType: 'Finished Good'
      }))
    ];
    res.json(combinedItems);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 3. APPROVED POs
router.get('/approved-pos', async (req, res) => {
  try {
    if (!PurchaseOrder) return res.json([]);
    const existingGRNs = await GRN.find({ purchaseOrder: { $ne: null } }).select('purchaseOrder');
    const usedPoIds = existingGRNs.map(g => String(g.purchaseOrder));
    const pos = await PurchaseOrder.find({})
      .populate({ path: 'items.material', model: 'Material', options: { strictPopulate: false } })
      .populate({ path: 'items.color', model: 'Color', options: { strictPopulate: false } })
      .sort({ createdAt: -1 });
    const availablePOs = (pos || []).filter(po => !usedPoIds.includes(String(po._id)));
    res.json(availablePOs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 4. ISSUING RECORDS
router.get('/issuing-records', async (req, res) => {
  try {
    if (!MaterialIssuing) return res.json([]);
    const issuings = await MaterialIssuing.find()
      .populate({ path: 'warehouse', options: { strictPopulate: false } });
    res.json(issuings || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 5. SAVE OR UPDATE GRN
router.post('/save', async (req, res) => {
  const {
    grnId, grnDate, grnType, workflow, purchaseOrder, materialIssuing,
    supplier, invoiceNo, vehicleNo, items, grandTotal, remarks,
    created_by, createdBy, status, globalWarehouse
  } = req.body;

  try {
    let grnDoc = null;

    const formattedItems = items ? items.map(item => ({
      material: mongoose.Types.ObjectId.isValid(item.material?._id || item.material)
        ? new mongoose.Types.ObjectId(item.material?._id || item.material) : null,
      color: mongoose.Types.ObjectId.isValid(item.color?._id || item.color)
        ? new mongoose.Types.ObjectId(item.color?._id || item.color) : null,
      size: mongoose.Types.ObjectId.isValid(item.size?._id || item.size)
        ? new mongoose.Types.ObjectId(item.size?._id || item.size) : null,
      uom: item.uom || 'Pcs',
      orderedQty: Number(item.orderedQty || 0),
      receivedQty: Number(item.receivedQty || 0),
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
      storeLocation: mongoose.Types.ObjectId.isValid(item.storeLocation?._id || item.storeLocation)
        ? new mongoose.Types.ObjectId(item.storeLocation?._id || item.storeLocation)
        : (mongoose.Types.ObjectId.isValid(globalWarehouse) ? new mongoose.Types.ObjectId(globalWarehouse) : null)
    })).filter(item => item.material !== null) : [];

    const grnTypeId = mongoose.Types.ObjectId.isValid(grnType) ? new mongoose.Types.ObjectId(grnType) : null;
    const workflowId = mongoose.Types.ObjectId.isValid(workflow) ? new mongoose.Types.ObjectId(workflow) : null;
    const poId = mongoose.Types.ObjectId.isValid(purchaseOrder) ? new mongoose.Types.ObjectId(purchaseOrder) : null;
    const issuingId = mongoose.Types.ObjectId.isValid(materialIssuing) ? new mongoose.Types.ObjectId(materialIssuing) : null;
    const supplierId = mongoose.Types.ObjectId.isValid(supplier) ? new mongoose.Types.ObjectId(supplier) : null;
    const finalCreator = createdBy || created_by || 'SYSTEM';

    if (!grnTypeId) {
      return res.status(400).json({ message: 'Transaction Type is required for GRN.' });
    }

    if (status === 'Completed') {
      for (let item of formattedItems) {
        if (!item.color || !item.storeLocation || !item.size) {
          return res.status(400).json({ message: 'Color shade, Size and Store location are required before completing GRN.' });
        }
      }
    }

    if (grnId && mongoose.Types.ObjectId.isValid(grnId)) {
      grnDoc = await GRN.findByIdAndUpdate(
        grnId,
        {
          grnDate, grnType: grnTypeId, workflow: workflowId,
          purchaseOrder: poId, materialIssuing: issuingId,
          supplier: supplierId, invoiceNo, vehicleNo,
          items: formattedItems, grandTotal: Number(grandTotal || 0),
          remarks, status
        },
        { new: true, runValidators: true }
      );
    }

    if (!grnDoc) {
      const count = await GRN.countDocuments();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
      const generatedGrnNo = `GRN-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      grnDoc = new GRN({
        grnNo: generatedGrnNo,
        grnDate, grnType: grnTypeId, workflow: workflowId,
        purchaseOrder: poId, materialIssuing: issuingId,
        supplier: supplierId, invoiceNo: invoiceNo || 'N/A',
        vehicleNo, items: formattedItems,
        grandTotal: Number(grandTotal || 0), remarks,
        status: status || 'Draft', createdBy: finalCreator
      });
      await grnDoc.save();
    }

    // 🌟 If saved directly as Completed, update stock
    await processGrnStockUpdate(grnDoc);

    return res.status(200).json(grnDoc);
  } catch (err) {
    console.error("❌ GRN Save Error:", err);
    return res.status(400).json({ message: err.message });
  }
});

// ✅ 6. SUBMIT FOR APPROVAL
const submitApprovalHandler = async (req, res) => {
  const { createdBy } = req.body;
  try {
    const grn = await GRN.findById(req.params.id);
    if (!grn) return res.status(404).json({ message: "GRN not found." });

    if (grn.status !== 'Draft') {
      return res.status(400).json({ message: "Only Draft GRNs can be submitted for approval." });
    }

    if (!grn.workflow) {
      return res.status(400).json({ message: "No workflow assigned to this GRN. Please select a workflow when creating the GRN." });
    }

    const targetApprover = await getApproverFromWorkflow(grn.workflow);

    if (!targetApprover) {
      return res.status(400).json({ message: "No valid approver found in workflow. Please check workflow configuration." });
    }

    grn.status = 'Pending Approval';
    await grn.save();

    await Approval.deleteOne({ docId: grn._id, status: 'PENDING' }).catch(() => {});

    const newApproval = new Approval({
      documentType: 'GRN',
      docId: grn._id,
      docNo: grn.grnNo,
      requestedBy: createdBy || grn.createdBy || 'SYSTEM',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `GRN ${grn.grnNo} — Invoice: ${grn.invoiceNo} — Total: LKR ${grn.grandTotal?.toLocaleString()} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    res.json({ message: "GRN submitted for approval.", grn, approver: targetApprover });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

router.post('/submit-approval/:id', submitApprovalHandler);
router.post('/submit/:id', submitApprovalHandler);

// 🌟 NOTE: Whenever an approval is accepted elsewhere and GRN status becomes 'Completed', 
// ensure processGrnStockUpdate(grnDoc) is triggered there if managed in approvals route.

module.exports = router;