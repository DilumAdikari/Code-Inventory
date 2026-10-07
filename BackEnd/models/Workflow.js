const mongoose = require('mongoose');

const WorkflowUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mode: { type: String, enum: ['RECEIVER', 'APPROVER'], default: 'APPROVER' },
  order: { type: Number, required: true } // Level 1, Level 2, Level 3...
});

const WorkflowSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true }, // e.g., "Costing Approval - Corewear"
  description: { type: String, trim: true },
  permission: { type: String, enum: ['NEED_ALL', 'ANY_ONE'], default: 'NEED_ALL' },
  usersConfiguration: [WorkflowUserSchema]
}, { timestamps: true });

module.exports = mongoose.model('Workflow', WorkflowSchema);