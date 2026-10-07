const express = require('express');
const router = express.Router();
const Costing = require('../models/Costing');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');
const mongoose = require('mongoose');

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
    costingId, costingDate, salesOrder, workflowTemplate, items, 
    totalMaterialCost, cmCost, overheadCost, grandTotal, status, createdBy 
  } = req.body;

  try {
    let costingSheet = null;
    const validItems = items ? items.filter(item => item.material && item.material !== '') : [];

    if (costingId && mongoose.Types.ObjectId.isValid(costingId)) {
      costingSheet = await Costing.findByIdAndUpdate(
        costingId, 
        { costingDate, salesOrder, workflowTemplate, items: validItems, totalMaterialCost, cmCost, overheadCost, grandTotal, status, createdBy },
        { new: true, runValidators: true }
      );
    } 
    
    if (!costingSheet) {
      const count = await Costing.countDocuments();
      const nextNumber = count + 1;
      const generatedCostingNo = `CST-${String(nextNumber).padStart(4, '0')}`;

      costingSheet = new Costing({
        costingNo: generatedCostingNo,
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
      await costingSheet.save();
    }

    // ✅ ONLY runs when status is 'Pending Approval'
    if (status === 'Pending Approval') {
      await Approval.deleteOne({ docId: costingSheet._id });

      // ✅ Populate usersConfiguration.user to get username
      const wfDoc = await Workflow.findById(workflowTemplate)
        .populate('usersConfiguration.user', 'username');

      let targetApprover = null;

      if (wfDoc && wfDoc.usersConfiguration && wfDoc.usersConfiguration.length > 0) {
        
        // ✅ Filter APPROVER mode users and sort by order
        const approverConfigs = wfDoc.usersConfiguration
          .filter(config => config.mode === 'APPROVER')
          .sort((a, b) => a.order - b.order);

        if (approverConfigs.length > 0) {
          const firstApprover = approverConfigs[0];
          if (firstApprover.user && firstApprover.user.username) {
            targetApprover = firstApprover.user.username.trim().toUpperCase();
          }
        }

        // ✅ If no APPROVER found, fall back to RECEIVER
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
        console.error('❌ No valid approver found in workflow usersConfiguration. Approval not created.');
      } else {
        const newApproval = new Approval({
          documentType: 'Costing Template',
          docId: costingSheet._id,
          docNo: costingSheet.costingNo,
          requestedBy: createdBy || 'SYSTEM',
          approver: targetApprover,
          date: costingDate,
          summary: `Costing Sheet Matrix for Order Value LKR ${grandTotal.toLocaleString()}`,
          status: 'PENDING'
        });

        await newApproval.save();
        console.log(`✅ Approval assigned to workflow user: ${targetApprover}`);
      }
    }

    res.status(200).json(costingSheet);
  } catch (err) {
    console.error("❌ Database Save Error:", err);
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;