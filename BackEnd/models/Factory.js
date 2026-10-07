const mongoose = require('mongoose');

const FactorySchema = new mongoose.Schema({
  factoryCode: { type: String, required: true, unique: true, trim: true }, // e.g., "FAC-001"
  name: { type: String, required: true, trim: true }, // e.g., "Kandy Plant"
  location: { type: String, required: true, trim: true },
  contactPerson: { type: String, trim: true },
  phone: { type: String, required: true },
  email: { type: String, trim: true },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Factory', FactorySchema);