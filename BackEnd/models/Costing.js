const mongoose = require('mongoose');

const CostingItemSchema = new mongoose.Schema({
  material: { type: String, required: true },
  uom: { type: String, default: 'Pcs' },
  consumption: { type: Number, default: 0 },
  wastagePercentage: { type: Number, default: 0 },
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  totalWithWastage: { type: Number, default: 0 }
});

const CostingSchema = new mongoose.Schema({
  // Letters, numbers, "-" and "/" only, max 20 characters, stored in uppercase, unique
  costingNo: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    maxlength: 20,
    match: [/^[A-Z0-9\-\/]{1,20}$/, 'Costing No can only contain letters, numbers, "-" and "/", and must be 20 characters or fewer']
  },

  costingDate: { type: String, required: true },
  salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  workflowTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  items: [CostingItemSchema],

  totalMaterialCost: { type: Number, default: 0 },
  cmCost: { type: Number, default: 0 },
  overheadCost: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  status: { type: String, enum: ['Draft', 'Pending Approval', 'Completed', 'Rejected'], default: 'Draft' },
  createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Costing', CostingSchema);