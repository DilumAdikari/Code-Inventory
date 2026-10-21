const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
  material: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'itemType'
  },
  itemType: {
    type: String,
    required: true,
    enum: ['Material', 'FinishedGood'],
    default: 'Material'
  },
  // Null for materials that have no colour variants
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Color',
    default: null
  },
  // Null for materials that have no size variants
  size: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Size',
    default: null
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  unitPrice: {
    type: Number,
    default: 0,
    required: true
  },
  qty: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Unique index stays the same. MongoDB treats null values as equal,
// so a colourless material has only one stock row per warehouse and price.
StockSchema.index({ material: 1, color: 1, size: 1, warehouse: 1, unitPrice: 1 }, { unique: true });

module.exports = mongoose.model('Stock', StockSchema);