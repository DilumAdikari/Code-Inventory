const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, default: 'User' }, // Default Admin seeding වැඩ සඳහා පමණක් පවතී
  permissions: {
    dashboard: { type: Boolean, default: true },
    salesOrders: { type: Boolean, default: false },
    costing: { type: Boolean, default: false },
    materialIssuing: { type: Boolean, default: false },
    grnHistory: { type: Boolean, default: false },
    materialRegistry: { type: Boolean, default: false },
    partners: { type: Boolean, default: false },
    settings: { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);