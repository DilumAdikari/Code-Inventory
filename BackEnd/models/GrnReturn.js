const mongoose = require('mongoose');

const GrnReturnSchema = new mongoose.Schema({
  returnNo: {
    type: String,
    required: true,
    unique: true
  },
  grnNo: {
    type: String,
    required: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true
  },
  approvalWorkflow: {
    type: String,
    required: true
  },
  returnDate: {
    type: Date,
    required: true
  },
 status: {
  type: String,
  enum: ['DRAFT', 'Draft', 'Pending Approval', 'COMPLETED', 'Completed'], // 🌟 'Pending Approval' මෙතැනට එකතු කරන්න
  default: 'DRAFT'
},
  items: [{
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Color',
      default: null
    },
    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Size',
      default: null
    },
    uom: {
      type: String,
      required: true
    },
    receivedQty: {
      type: Number,
      required: true
    },
    returnQty: {
      type: Number,
      required: true,
      default: 0
    }
  }],
  returnedBy: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('GrnReturn', GrnReturnSchema);