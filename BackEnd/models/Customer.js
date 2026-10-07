const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  contactPerson: String,
  email: { type: String, required: true },
  phone: String,
  address: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);