const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Material = require('../models/Material');
const FinishedGood = require('../models/FinishedGood');
const Uom = require('../models/Uom');
const Stock = require('../models/Stock');
const Approval = require('../models/Approval');
const Workflow = require('../models/Workflow');
const mongoose = require('mongoose');

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

// ✅ 1. GET ALL
router.get('/', async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate({ 
        path: 'items.material', 
        select: 'materialName materialCode itemName itemCode uom', 
        populate: { path: 'uom', select: 'name abbreviation' },
        options: { strictPopulate: false } 
      })
      .populate({ path: 'items.color', select: 'colorName colorCode name nameS code', options: { strictPopulate: false } })
      .populate({ path: 'items.size', select: 'sizeCode sizeDescription name', options: { strictPopulate: false } }) 
      .populate({ path: 'items.storeLocation', select: 'warehouseName warehouseCode', options: { strictPopulate: false } })
      .populate({ path: 'workflow', select: 'code name', options: { strictPopulate: false } })
      .sort({ createdAt: -1 });

    const processedInvoices = await Promise.all(invoices.map(async (inv) => {
      const invObj = inv.toObject();
      if (invObj.items) {
        invObj.items = await Promise.all(invObj.items.map(async (it) => {
          let resolvedUom = 'Pcs';

          if (it.material && typeof it.material === 'object') {
            it.resolvedName = it.material.itemName || it.material.materialName || 'Item';
            it.resolvedCode = it.material.itemCode || it.material.materialCode || '';
            
            // Material හෝ FinishedGood එකේ populate වූ uom එකෙන් abbreviation ලබා ගැනීම
            if (it.material.uom) {
              if (typeof it.material.uom === 'object' && it.material.uom.abbreviation) {
                resolvedUom = it.material.uom.abbreviation;
              } else if (mongoose.Types.ObjectId.isValid(it.material.uom)) {
                const uomDoc = await Uom.findById(it.material.uom).lean();
                if (uomDoc) resolvedUom = uomDoc.abbreviation || resolvedUom;
              }
            }
          } else if (it.material && mongoose.Types.ObjectId.isValid(it.material)) {
            let foundItem = await FinishedGood.findById(it.material).populate('uom').lean();
            if (!foundItem) foundItem = await Material.findById(it.material).populate('uom').lean();
            if (foundItem) {
              it.resolvedName = foundItem.itemName || foundItem.materialName || 'Item';
              it.resolvedCode = foundItem.itemCode || foundItem.materialCode || '';
              if (foundItem.uom) {
                if (typeof foundItem.uom === 'object' && foundItem.uom.abbreviation) {
                  resolvedUom = foundItem.uom.abbreviation;
                } else if (mongoose.Types.ObjectId.isValid(foundItem.uom)) {
                  const uomDoc = await Uom.findById(foundItem.uom).lean();
                  if (uomDoc) resolvedUom = uomDoc.abbreviation || resolvedUom;
                }
              }
            }
          }

          // ඉන්වොයිස් අයිතමයේ uom එක අයිඩී එකක් නම් හෝ නැත්නම් නිවැරදි UOM එක යොදනු ලැබේ
          if (!it.uom || String(it.uom).startsWith('6') || String(it.uom).length > 10) {
            it.uom = resolvedUom;
          } else if (typeof it.uom === 'object') {
            it.uom = it.uom.abbreviation || it.uom.name || 'Pcs';
          }

          return it;
        }));
      }
      return invObj;
    }));

    res.json(processedInvoices || []);
  } catch (err) {
    console.error("❌ Invoice GET Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ 2. SUBMIT FOR APPROVAL
router.post('/submit-approval/:id', async (req, res) => {
  const { createdBy } = req.body;
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });

    if (invoice.status !== 'Draft') {
      return res.status(400).json({ message: "Only Draft invoices can be submitted." });
    }

    if (!invoice.workflow) {
      return res.status(400).json({ message: "No workflow assigned." });
    }

    if (invoice.items && invoice.items.length > 0) {
      for (let item of invoice.items) {
        if (item.material && item.storeLocation) {
          const stockCheck = await Stock.findOne({
            material: item.material,
            color: item.color || null,
            size: item.size || null, 
            warehouse: item.storeLocation
          });

          const availableQty = stockCheck ? Number(stockCheck.qty || 0) : 0;
          const requestedQty = Number(item.issuedQty || 0);

          if (availableQty <= 0) {
            return res.status(400).json({
              message: `No stock available for one or more items (with selected color/size).`
            });
          }

          if (requestedQty > availableQty) {
            return res.status(400).json({
              message: `Insufficient stock. Available: ${availableQty}, Requested: ${requestedQty}`
            });
          }
        }
      }
    }

    const targetApprover = await getApproverFromWorkflow(invoice.workflow);
    if (!targetApprover) {
      return res.status(400).json({ message: "No valid approver found in workflow." });
    }

    invoice.status = 'Pending Approval';
    await invoice.save();

    await Approval.deleteOne({ docId: invoice._id, status: 'PENDING' }).catch(() => {});

    const newApproval = new Approval({
      documentType: 'Invoice',
      docId: invoice._id,
      docNo: invoice.invoiceNo,
      requestedBy: createdBy || invoice.createdBy || 'SYSTEM',
      approver: targetApprover,
      date: new Date().toISOString().split('T')[0],
      summary: `Invoice ${invoice.invoiceNo} — Customer: ${invoice.customerName} — Total: LKR ${invoice.grandTotal?.toLocaleString()} submitted for approval.`,
      status: 'PENDING'
    });

    await newApproval.save();
    res.json({ message: "Invoice submitted for approval.", invoice, approver: targetApprover });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ 3. SAVE OR UPDATE
router.post('/save', async (req, res) => {
  const { invoiceId, invoiceDate, customerName, workflow, items, grandTotal, status, createdBy, globalWarehouse } = req.body;

  try {
    let invoiceDoc = null;

    const targetGlobalWarehouse = mongoose.Types.ObjectId.isValid(globalWarehouse)
      ? new mongoose.Types.ObjectId(globalWarehouse)
      : null;

    const workflowId = mongoose.Types.ObjectId.isValid(workflow)
      ? new mongoose.Types.ObjectId(workflow)
      : null;

    const formattedItems = items ? items.map(item => {
      let cleanUom = 'Pcs';
      if (item.uom) {
        if (typeof item.uom === 'object') {
          cleanUom = item.uom.abbreviation || item.uom.name || 'Pcs';
        } else if (typeof item.uom === 'string' && !item.uom.startsWith('6') && item.uom.length < 10) {
          cleanUom = item.uom;
        }
      }

      return {
        material: mongoose.Types.ObjectId.isValid(item.material?._id || item.material)
          ? new mongoose.Types.ObjectId(item.material?._id || item.material) : null,
        color: mongoose.Types.ObjectId.isValid(item.color?._id || item.color)
          ? new mongoose.Types.ObjectId(item.color?._id || item.color) : null,
        size: mongoose.Types.ObjectId.isValid(item.size?._id || item.size)
          ? new mongoose.Types.ObjectId(item.size?._id || item.size) : null, 
        storeLocation: mongoose.Types.ObjectId.isValid(item.storeLocation?._id || item.storeLocation)
          ? new mongoose.Types.ObjectId(item.storeLocation?._id || item.storeLocation)
          : targetGlobalWarehouse,
        uom: cleanUom,
        issuedQty: Number(item.issuedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0)
      };
    }).filter(item => item.material !== null) : [];

    if (status === 'Completed' || status === 'Pending Approval') {
      for (let item of formattedItems) {
        if (item.material && item.storeLocation) {
          const stockCheck = await Stock.findOne({
            material: item.material,
            color: item.color || null,
            size: item.size || null, 
            warehouse: item.storeLocation
          });

          const availableQty = stockCheck ? Number(stockCheck.qty || 0) : 0;
          const requestedQty = Number(item.issuedQty || 0);

          if (availableQty <= 0) {
            return res.status(400).json({
              message: `No stock available for one or more items in the selected warehouse and size.`
            });
          }

          if (requestedQty > availableQty) {
            return res.status(400).json({
              message: `Insufficient stock. Available: ${availableQty}, Requested: ${requestedQty}`
            });
          }
        }
      }
    }

    if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
      invoiceDoc = await Invoice.findByIdAndUpdate(
        invoiceId,
        {
          invoiceDate,
          customerName,
          workflow: workflowId,
          items: formattedItems,
          grandTotal: Number(grandTotal || 0),
          status
        },
        { new: true, runValidators: false }
      );
    }

    if (!invoiceDoc) {
      const count = await Invoice.countDocuments();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
      const generatedInvoiceNo = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

      invoiceDoc = new Invoice({
        invoiceNo: generatedInvoiceNo,
        invoiceDate,
        customerName,
        workflow: workflowId,
        items: formattedItems,
        grandTotal: Number(grandTotal || 0),
        status: status || 'Draft',
        createdBy: createdBy || 'SYSTEM'
      });
      await invoiceDoc.save();
    }

    return res.status(200).json(invoiceDoc);
  } catch (err) {
    console.error("❌ Invoice Save Error:", err);
    return res.status(400).json({ message: err.message });
  }
});

module.exports = router;