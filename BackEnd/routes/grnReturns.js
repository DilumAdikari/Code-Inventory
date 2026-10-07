const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const GrnReturn = require('../models/GrnReturn');
const Material = require('../models/Material');
const FinishedGood = require('../models/FinishedGood');
const Workflow = require('../models/Workflow');
const Approval = require('../models/Approval');

// ✅ HELPER: Workflow එක ID එකෙන් හෝ නමෙන් (Code / Name) සොයා Approver ලබා ගැනීම
const getApproverFromWorkflow = async (workflowInput) => {
  if (!workflowInput) return null;
  
  let wfDoc = null;
  // 1. දාලා තියෙන්නේ නිවැරදි ObjectId එකක් නම් ඒකෙන් සෙවීම
  if (mongoose.Types.ObjectId.isValid(workflowInput)) {
    wfDoc = await Workflow.findById(workflowInput)
      .populate('usersConfiguration.user', 'username').catch(() => null);
  }
  
  // 2. නැත්නම් වර්ක්ෆ්ලෝ එකේ කෝඩ් එකෙන් හෝ නමෙන් සෙවීම
  if (!wfDoc) {
    wfDoc = await Workflow.findOne({
      $or: [
        { code: workflowInput },
        { workflowName: workflowInput },
        { name: workflowInput }
      ]
    }).populate('usersConfiguration.user', 'username').catch(() => null);
  }

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

// ✅ සියලුම GRN Returns ලබා ගැනීම සහ Material / FinishedGood දෙකේ නම නිවැරදිව රිසොව් කිරීම
router.get('/', async (req, res) => {
  try {
    const returns = await GrnReturn.find()
      .populate('items.color items.size')
      .sort({ createdAt: -1 })
      .lean();

    for (let ret of returns) {
      if (ret.items && ret.items.length > 0) {
        for (let item of ret.items) {
          if (!item.itemName || item.itemName === 'Material Item' || item.itemName === 'Item') {
            if (item.material) {
              let matDoc = await Material.findById(item.material).lean();
              if (matDoc) {
                item.itemName = matDoc.materialName || matDoc.itemName || 'Material Item';
              } else {
                let fgDoc = await FinishedGood.findById(item.material).lean();
                if (fgDoc) {
                  item.itemName = fgDoc.itemName || fgDoc.name || 'Finished Good';
                }
              }
            }
          }
        }
      }
    }
    res.status(200).json(returns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ GRN Return එකක් DRAFT ලෙස Initialize කිරීම (Save Draft)
router.post('/initialize', async (req, res) => {
  const { grnNo, warehouse, approvalWorkflow, returnDate, items, returnedBy, reason } = req.body;
  
  try {
    const lastReturn = await GrnReturn.findOne().sort({ createdAt: -1 });
    let nextNo = 1;
    if (lastReturn && lastReturn.returnNo) {
      const parts = lastReturn.returnNo.split('-');
      if (parts.length === 2) {
        nextNo = parseInt(parts[1], 10) + 1;
      }
    }
    const returnNo = `RTN-${String(nextNo).padStart(5, '0')}`;

    const itemsToSave = [];
    for (let item of (items || [])) {
      const matId = item.material?._id || item.material;
      let resolvedItemName = item.itemName;

      if (!resolvedItemName || resolvedItemName === 'Material Item' || resolvedItemName === 'Item') {
        let matDoc = await Material.findById(matId).lean();
        if (matDoc) {
          resolvedItemName = matDoc.materialName || matDoc.itemName;
        } else {
          let fgDoc = await FinishedGood.findById(matId).lean();
          if (fgDoc) {
            resolvedItemName = fgDoc.itemName || fgDoc.name;
          }
        }
      }

      itemsToSave.push({
        material: matId,
        color: item.color?._id || item.color || null,
        size: item.size?._id || item.size || null,
        uom: item.uom || 'Pcs',
        itemName: resolvedItemName || 'Material Item',
        colorName: item.colorName || '-',
        sizeName: item.sizeName || '-',
        receivedQty: item.receivedQty || item.qty || 0,
        returnQty: item.returnQty || 0
      });
    }

    const newGrnReturn = new GrnReturn({
      returnNo,
      grnNo,
      warehouse: warehouse || null,
      approvalWorkflow,
      returnDate: returnDate || new Date(),
      status: 'DRAFT',
      items: itemsToSave,
      reason: reason || "GRN Return Draft",
      returnedBy: returnedBy || "ADMIN"
    });

    await newGrnReturn.save();
    res.status(200).json({ message: "GRN Return saved successfully.", returnNo });

  } catch (err) {
    console.error("❌ GRN Return Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ SUBMIT FOR APPROVAL: ස්ටොක් එක එකපාර අඩු නොවී, Workflow එක හරහා Approval එකට යැවීම
router.post(['/return', '/initialize/return'], async (req, res) => {
  const { grnNo, warehouse, approvalWorkflow, returnDate, items, returnedBy, reason } = req.body;
  
  try {
    let returnDoc = await GrnReturn.findOne({ grnNo, status: { $in: ['DRAFT', 'Pending Approval'] } });
    
    if (returnDoc) {
      returnDoc.status = 'Pending Approval';
      returnDoc.approvalWorkflow = approvalWorkflow || returnDoc.approvalWorkflow;
      returnDoc.items = items;
      await returnDoc.save();
    } else {
      const lastReturn = await GrnReturn.findOne().sort({ createdAt: -1 });
      let nextNo = 1;
      if (lastReturn && lastReturn.returnNo) {
        const parts = lastReturn.returnNo.split('-');
        if (parts.length === 2) nextNo = parseInt(parts[1], 10) + 1;
      }
      const returnNo = `RTN-${String(nextNo).padStart(5, '0')}`;

      returnDoc = new GrnReturn({
        returnNo,
        grnNo,
        warehouse: warehouse || null,
        approvalWorkflow,
        returnDate: returnDate || new Date(),
        status: 'Pending Approval',
        items,
        reason: reason || "GRN Return Approval Submission",
        returnedBy: returnedBy || "ADMIN"
      });
      await returnDoc.save();
    }

    // 🌟 Workflow එකෙන් Approver කෙනෙක් සොයා ගැනීම (ID හෝ නම මඟින්)
    const targetApprover = await getApproverFromWorkflow(approvalWorkflow);
    if (!targetApprover) {
      return res.status(400).json({ message: "No valid approver found in workflow. Please check workflow configuration." });
    }

    // පැරණි පෙන්ඩින් ඇපෲවල් එකක් ඇත්නම් ඉවත් කිරීම
    await Approval.deleteOne({ docId: returnDoc._id, status: 'PENDING' }).catch(() => {});

    // අලුතින් Approval එකට රෙකෝඩ් එකක් සේව් කිරීම
    const newApproval = new Approval({
      documentType: 'GRN Return',
      docId: returnDoc._id,
      docNo: returnDoc.returnNo,
      requestedBy: returnedBy || 'ADMIN',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `GRN Return ${returnDoc.returnNo} for GRN: ${grnNo} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();

    res.status(200).json({ 
      message: "GRN Return submitted for approval successfully!", 
      returnDoc,
      approver: targetApprover 
    });

  } catch (err) {
    console.error("❌ GRN Return Submit Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;