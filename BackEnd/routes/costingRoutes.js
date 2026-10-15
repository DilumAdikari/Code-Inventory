const express = require('express');
const router = express.Router();
const Costing = require('../models/Costing');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');
const mongoose = require('mongoose');

// Letters, numbers, "-" and "/" only, max 20 characters
const COSTING_NO_REGEX = /^[A-Z0-9\-\/]{1,20}$/;

// 1. GET ALL COSTING SHEETS
router.get('/', async (req, res) => {
  try {
    const costings = await Costing.find()
      .populate({ path: 'salesOrder', select: 'orderRef buyerName' })
      .sort({ createdAt: -1 });
    res.json(costings || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. SAVE OR UPDATE COSTING MATRIX
router.post('/save', async (req, res) => {
  const {
    costingId, costingNo, costingDate, salesOrder, workflowTemplate, items,
    totalMaterialCost, cmCost, overheadCost, grandTotal, status, createdBy
  } = req.body;

  try {
    const validItems = items ? items.filter(item => item.material && item.material !== '') : [];
    let costingSheet = null;

    if (costingId && mongoose.Types.ObjectId.isValid(costingId)) {
      // UPDATE: costingNo is never changed after creation
      costingSheet = await Costing.findByIdAndUpdate(
        costingId,
        { costingDate, salesOrder, workflowTemplate, items: validItems, totalMaterialCost, cmCost, overheadCost, grandTotal, status, createdBy },
        { new: true, runValidators: true }
      );

      if (!costingSheet) {
        return res.status(404).json({ message: 'Costing record not found' });
      }
    } else {
      // CREATE: costingNo must be provided by the user
      const normalizedNo = String(costingNo || '').trim().toUpperCase();

      if (!COSTING_NO_REGEX.test(normalizedNo)) {
        return res.status(400).json({
          message: 'Costing No can only contain letters, numbers, "-" and "/", and must be 20 characters or fewer'
        });
      }

      const exists = await Costing.exists({ costingNo: normalizedNo });
      if (exists) {
        return res.status(409).json({ message: `Costing No ${normalizedNo} already exists` });
      }

      costingSheet = new Costing({
        costingNo: normalizedNo,
        costingDate,
        salesOrder,
        workflowTemplate,
        items: validItems,
        totalMaterialCost,
        cmCost,
        overheadCost,
        grandTotal,
        status,
        createdBy
      });

      try {
        await costingSheet.save();
      } catch (saveErr) {
        // Two users saved the same number at the same time (unique index)
        if (saveErr.code === 11000) {
          return res.status(409).json({ message: `Costing No ${normalizedNo} already exists` });
        }
        throw saveErr;
      }
    }

    // ONLY runs when status is 'Pending Approval'
    if (status === 'Pending Approval') {
      await Approval.deleteOne({ docId: costingSheet._id });

      const wfDoc = await Workflow.findById(workflowTemplate)
        .populate('usersConfiguration.user', 'username');

      let targetApprover = null;

      if (wfDoc && wfDoc.usersConfiguration && wfDoc.usersConfiguration.length > 0) {
        const approverConfigs = wfDoc.usersConfiguration
          .filter(config => config.mode === 'APPROVER')
          .sort((a, b) => a.order - b.order);

        if (approverConfigs.length > 0) {
          const firstApprover = approverConfigs[0];
          if (firstApprover.user && firstApprover.user.username) {
            targetApprover = firstApprover.user.username.trim().toUpperCase();
          }
        }

        // Fall back to RECEIVER if no APPROVER is found
        if (!targetApprover) {
          const receiverConfigs = wfDoc.usersConfiguration
            .filter(config => config.mode === 'RECEIVER')
            .sort((a, b) => a.order - b.order);

          if (receiverConfigs.length > 0 && receiverConfigs[0].user && receiverConfigs[0].user.username) {
            targetApprover = receiverConfigs[0].user.username.trim().toUpperCase();
          }
        }
      }

      if (!targetApprover) {
        console.error('No valid approver found in workflow usersConfiguration. Approval not created.');
      } else {
        const newApproval = new Approval({
          documentType: 'Costing Template',
          docId: costingSheet._id,
          docNo: costingSheet.costingNo,
          requestedBy: createdBy || 'SYSTEM',
          approver: targetApprover,
          date: costingDate,
          summary: `Costing Sheet Matrix for Order Value LKR ${Number(grandTotal || 0).toLocaleString()}`,
          status: 'PENDING'
        });

        await newApproval.save();
        console.log(`Approval assigned to workflow user: ${targetApprover}`);
      }
    }

    res.status(200).json(costingSheet);
  } catch (err) {
    console.error('Database Save Error:', err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;