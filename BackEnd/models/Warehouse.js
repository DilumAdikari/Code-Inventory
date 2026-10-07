const mongoose = require('mongoose');

const WarehouseSchema = new mongoose.Schema({
  warehouseCode: { type: String, required: true, unique: true }, // e.g., MFS-01, ACC-02
  warehouseName: { type: String, required: true }, // e.g., Main Fabric Store, Accessories Store
  location: { type: String }, // e.g., Veyangoda Factory, Negombo Plant
  remarks: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

module.exports = mongoose.model('Warehouse', WarehouseSchema);