const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  documentType: { type: String, required: true },
  docId: { type: mongoose.Schema.Types.ObjectId, required: true },
  docNo: { type: String, required: true },
  requestedBy: { type: String, required: true },
  

  approver: { type: String, required: true, default: 'DILUM' }, 
  
  date: { type: String, required: true },
  summary: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvedBy: { type: String },
  actionDate: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Approval', ApprovalSchema);