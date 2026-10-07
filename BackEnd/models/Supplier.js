const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  supplierCode: { type: String, required: true, unique: true, trim: true }, // e.g., "SUP-001"
  name: { type: String, required: true, trim: true },
  companyName: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, required: true },
  address: { type: String },
  // සප්ලයර් සපයන ප්‍රධාන ද්‍රව්‍ය වර්ග (Fabric, Thread වගේ tag කරන්න පුළුවන්)
  suppliedCategories: [{ type: String }], 
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', SupplierSchema);