const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');

// 1. GET ALL SUPPLIERS
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER NEW SUPPLIER
router.post('/', async (req, res) => {
  const { supplierCode, name, companyName, email, phone, address, suppliedCategories } = req.body;
  try {
    const newSupplier = new Supplier({ supplierCode, name, companyName, email, phone, address, suppliedCategories });
    const savedSupplier = await newSupplier.save();
    res.status(201).json(savedSupplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;