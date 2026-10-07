const mongoose = require('mongoose');

const ProductionOrderSchema = new mongoose.Schema({
  productionOrderNo: {
    type: String,
    required: true,
    unique: true,
    default: () => 'PO-' + Math.floor(100000 + Math.random() * 900000)
  },
  targetDate: {
    type: Date,
    required: true
  },
  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true
  },
  salesOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesOrder',
    required: true
  },
  costing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Costing',
    required: true
  },
  status: {
    type: String,
    // ✅ FIX — added 'Pending Approval' to enum
    enum: ['Draft', 'Pending Approval', 'Planned', 'In-Production', 'Completed', 'Cancelled'],
    default: 'Draft'
  },
  isPoCreated: {
    type: Boolean,
    default: false
  },
  garmentQuantities: [{
    size: { type: String, required: true },
    orderQty: { type: Number, required: true }
  }],
  bomItems: [{
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Color'
    },
    size: {
      type: String,
      default: 'M'
    },
    unitCost: {
      type: Number,
      default: 0
    },
    requiredQty: {
      type: Number,
      required: true
    },
    availableStockQty: {
      type: Number,
      default: 0
    },
    shortageQty: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Pending', 'Partially_Issued', 'Fully_Issued'],
      default: 'Pending'
    },
    // ✅ added these fields to store names for BOM display after save
    materialName: { type: String, default: '' },
    itemCode: { type: String, default: '' },
    colorName: { type: String, default: '' },
    consumption: { type: Number, default: 0 },
    wastage: { type: Number, default: 0 }
  }],
  remarks: String
}, { timestamps: true });

module.exports = mongoose.model('ProductionOrder', ProductionOrderSchema);