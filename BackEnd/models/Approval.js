const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema({
  documentType: { type: String, required: true }, // e.g., 'Sales Order', 'Costing Template'
  docId: { type: mongoose.Schema.Types.ObjectId, required: true },
  docNo: { type: String, required: true },
  requestedBy: { type: String, required: true },
  
  // 🌟 ✅ මෙන්න මේ පේළිය අනිවාර්යයෙන්ම තිබිය යුතුයි! 
  // එතකොට තමයි ඩේටාබේස් එක මේ ෆීල්ඩ් එක පිළිගන්නේ.
  approver: { type: String, required: true, default: 'DILUM' }, 
  
  date: { type: String, required: true },
  summary: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  approvedBy: { type: String },
  actionDate: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Approval', ApprovalSchema);