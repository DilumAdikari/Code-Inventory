const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'items.itemModel'
  },
  itemModel: {
    type: String,
    required: true,
    enum: ['Material', 'FinishedGood'],
    default: 'FinishedGood'
  },
  color: { type: mongoose.Schema.Types.ObjectId, ref: 'Color', required: false },
  // 🌟 ✅ FIXED: Size එක ඉන්වොයිස් අයිතමයට එකතු කළා
  size: { type: mongoose.Schema.Types.ObjectId, ref: 'Size', default: null },
  storeLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: false },
  uom: { type: String, default: 'Pcs' },
  issuedQty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  invoiceDate: { type: String, required: true },
  customerName: { type: String, required: true },

  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    default: null
  },

  items: [invoiceItemSchema],
  grandTotal: { type: Number, required: true },

  status: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Completed'],
    default: 'Draft'
  },
  createdBy: { type: String, default: 'SYSTEM' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);