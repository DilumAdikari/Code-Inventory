const mongoose = require('mongoose');

const GRNItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  color: { type: mongoose.Schema.Types.ObjectId, ref: 'Color', default: null },
  
  // 🌟 ✅ FIXED: GRN ලයින් අයිතමයට අදාළ Size එක සේව් වීමට එකතු කළ කොටස
  size: { type: mongoose.Schema.Types.ObjectId, ref: 'Size', default: null },

  uom: { type: String, default: 'Pcs' },
  orderedQty: { type: Number, default: 0 },
  receivedQty: { type: Number, required: true },
  unitPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
  storeLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null }
});

const GRNSchema = new mongoose.Schema({
  grnNo: { type: String, required: true, unique: true },
  grnDate: { type: String, required: true },

  grnType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionType',
    required: true
  },

  // ✅ NEW — workflow for approval routing
  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    default: null
  },

  purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  materialIssuing: { type: mongoose.Schema.Types.ObjectId, ref: 'MaterialIssuing', default: null },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },

  invoiceNo: { type: String, required: true },
  vehicleNo: { type: String },
  items: [GRNItemSchema],
  grandTotal: { type: Number, default: 0 },
  remarks: { type: String },

  status: {
    type: String,
    enum: ['Draft', 'Pending Approval', 'Completed'],
    default: 'Draft'
  },
  createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GRN', GRNSchema);