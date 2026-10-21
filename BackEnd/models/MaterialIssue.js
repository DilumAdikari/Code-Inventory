const mongoose = require('mongoose');

const MaterialIssueSchema = new mongoose.Schema({
  issueNo: { type: String, required: false, unique: true, sparse: true },
  salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  productionOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionOrder', required: false },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  
  // 🌟 NEW — Plant (Supplier Master) field eka ekathu kala
  plant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },

  // workflow for approval routing
  workflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    default: null
  },

  issueType: { type: String, enum: ['Auto', 'Manual'], default: 'Auto' },

  status: {
    type: String,
    enum: ['PENDING_ISSUE', 'Pending Approval', 'ISSUED', 'DRAFT'],
    default: 'DRAFT'
  },

  items: [{
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
    color: { type: mongoose.Schema.Types.ObjectId, ref: 'Color', default:null },
    uom: { type: String, default: 'Pcs' },
    allocatedQty: { type: Number, required: true },
    issuedQty: { type: Number, required: true },
    value: { type: Number, default: 0 }
  }],

  remarks: { type: String },
  createdBy: { type: String, default: 'SYSTEM' }
}, { timestamps: true });

module.exports = mongoose.model('MaterialIssue', MaterialIssueSchema);