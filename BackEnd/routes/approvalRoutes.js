const express = require('express');
const router = express.Router();
const Approval = require('../models/Approval');
const SalesOrder = require('../models/SalesOrder');
const Costing = require('../models/Costing');
const ProductionOrder = require('../models/ProductionOrder');
const PurchaseOrder = require('../models/PurchaseOrder');
const GRN = require('../models/GRN');
const Stock = require('../models/Stock');
const MaterialIssue = require('../models/MaterialIssue');
const Invoice = require('../models/Invoice');
const GrnReturn = require('../models/GrnReturn'); // 🌟 අමතක නොశව GrnReturn මොඩල් එක රික්වයර් කිරීම

// 1. GET PENDING APPROVALS
router.get('/pending', async (req, res) => {
  const { username } = req.query;
  try {
    if (!username) {
      return res.status(400).json({ message: 'Username query parameter is required.' });
    }

    const allPending = await Approval.find({ status: 'PENDING' });

    const filteredApprovals = allPending.filter(app => {
      const targetUser = app.approver;
      if (!targetUser) return false;
      const loggedInUser = username.trim().toUpperCase();
      const dbApprover = targetUser.trim().toUpperCase();
      return dbApprover === loggedInUser;
    });

    res.json(filteredApprovals || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. APPROVAL ACTION
router.post('/:id/action', async (req, res) => {
  const { status } = req.body;
  try {
    console.log("🔍 Action Request - ID:", req.params.id, "Status:", status);

    const approval = await Approval.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true }
    );

    if (!approval) return res.status(404).json({ message: 'Approval request not found' });

    console.log("🔍 Found Approval Doc:", approval.documentType, "DocID:", approval.docId);

    const isApproved = status && status.toString().toUpperCase() === 'APPROVED';

    // ✅ 1. Sales Order
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('sales order')) {
      const finalStatus = isApproved ? 'Completed' : 'Draft';
      await SalesOrder.findByIdAndUpdate(approval.docId, { status: finalStatus }, { new: true });
      console.log(`✅ Sales Order (${approval.docId}) → ${finalStatus}`);
    }

    // ✅ 2. Costing Template
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('costing')) {
      const finalCostingStatus = isApproved ? 'Completed' : 'Draft';
      await Costing.findByIdAndUpdate(approval.docId, { status: finalCostingStatus }, { new: true });

      if (isApproved) {
        const costingDoc = await Costing.findById(approval.docId);
        if (costingDoc && costingDoc.salesOrder) {
          await SalesOrder.findByIdAndUpdate(costingDoc.salesOrder, { status: 'Costed & Approved' });
        }
      }
      console.log(`✅ Costing (${approval.docId}) → ${finalCostingStatus}`);
    }

    // ✅ 3. Production Order
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('production')) {
      const finalPOStatus = isApproved ? 'Completed' : 'Draft';
      await ProductionOrder.findByIdAndUpdate(approval.docId, { status: finalPOStatus }, { new: true });
      console.log(`✅ Production Order (${approval.docId}) → ${finalPOStatus}`);
    }

    // ✅ 4. Purchase Order
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('purchase')) {
      const finalPurchaseStatus = isApproved ? 'Approved' : 'Draft';
      await PurchaseOrder.findByIdAndUpdate(approval.docId, { status: finalPurchaseStatus }, { new: true });
      console.log(`✅ Purchase Order (${approval.docId}) → ${finalPurchaseStatus}`);
    }

    // ✅ 5. GRN
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('grn') && !approval.documentType.toString().toLowerCase().includes('return')) {
      const finalGRNStatus = isApproved ? 'Completed' : 'Draft';
      await GRN.findByIdAndUpdate(approval.docId, { status: finalGRNStatus }, { new: true });

      if (isApproved) {
        const grnDoc = await GRN.findById(approval.docId);
        if (grnDoc && grnDoc.items && grnDoc.items.length > 0) {
          for (let item of grnDoc.items) {
            if (item.material && item.storeLocation) {
              await Stock.findOneAndUpdate(
                {
                  material: item.material,
                  color: item.color,
                  size: item.size || null,
                  warehouse: item.storeLocation,
                  unitPrice: Number(item.unitPrice || 0)
                },
                {
                  $inc: { qty: Number(item.receivedQty || 0) },
                  $setOnInsert: { itemType: 'Material' }
                },
                { upsert: true, new: true }
              );
            }
          }
        }
      }
      console.log(`✅ GRN (${approval.docId}) → ${finalGRNStatus}`);
    }

    // ✅ 5.1 GRN Return (අනුමත කළ පසු ස්ටොක් අඩු වීම සහ Completed වීම) —— [මෙතැනට නිවැරදිව ඇතුළත් කළා]
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('grn return')) {
      const finalReturnStatus = isApproved ? 'Completed' : 'Draft';

      const returnDoc = await GrnReturn.findByIdAndUpdate(
        approval.docId, 
        { status: finalReturnStatus }, 
        { new: true }
      );

      if (isApproved && returnDoc && returnDoc.items && returnDoc.items.length > 0) {
        for (let item of returnDoc.items) {
          const returnQty = Number(item.returnQty || 0);
          if (returnQty > 0 && item.material) {
            await Stock.findOneAndUpdate(
              {
                material: item.material,
                color: item.color || null,
                size: item.size || null,
                ...(returnDoc.warehouse ? { warehouse: returnDoc.warehouse } : {})
              },
              { $inc: { qty: -returnQty } },
              { new: true }
            );
          }
        }
        console.log(`✅ GRN Return (${approval.docId}) → Completed, stock deducted successfully.`);
      }
    }

    // ✅ 6. Material Issue
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('material issue')) {
      const finalIssueStatus = isApproved ? 'ISSUED' : 'PENDING_ISSUE';

      await MaterialIssue.findByIdAndUpdate(
        approval.docId,
        { status: finalIssueStatus },
        { new: true }
      );

      if (isApproved) {
        const issueDoc = await MaterialIssue.findById(approval.docId);
        if (issueDoc && issueDoc.items && issueDoc.items.length > 0) {
          for (let item of issueDoc.items) {
            if (item.material && issueDoc.warehouse) {
              const issuedQty = Number(item.issuedQty || item.allocatedQty || 0);
              if (issuedQty > 0) {
                await Stock.findOneAndUpdate(
                  {
                    material: item.material,
                    color: item.color || null,
                    warehouse: issueDoc.warehouse
                  },
                  { $inc: { qty: -issuedQty } },
                  { new: true }
                );
              }
            }
          }
          console.log(`✅ Material Issue (${approval.docId}) → ISSUED, stock deducted`);
        }
      }
    }

    // ✅ 7. Invoice
    if (approval.documentType && approval.documentType.toString().toLowerCase().includes('invoice')) {
      const finalInvoiceStatus = isApproved ? 'Completed' : 'Draft';

      await Invoice.findByIdAndUpdate(
        approval.docId,
        { status: finalInvoiceStatus },
        { new: true }
      );

      if (isApproved) {
        const invoiceDoc = await Invoice.findById(approval.docId);
        if (invoiceDoc && invoiceDoc.items && invoiceDoc.items.length > 0) {
          for (let item of invoiceDoc.items) {
            if (item.material && item.storeLocation) {
              const issuedQty = Number(item.issuedQty || 0);
              if (issuedQty > 0) {
                await Stock.findOneAndUpdate(
                  {
                    material: item.material,
                    color: item.color || null,
                    warehouse: item.storeLocation
                  },
                  { $inc: { qty: -issuedQty } },
                  { new: true }
                );
              }
            }
          }
          console.log(`✅ Invoice (${approval.docId}) → Completed, stock deducted`);
        }
      }
    }

    // ✅ Response එක සියලුම if ਬ୍ලොක්ස් වලට පස්සේ හරියටම ක්‍රියාත්මක වේ
    res.json({ message: `Document action processed successfully!`, approval });

  } catch (err) {
    console.error("❌ Approval Action Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;