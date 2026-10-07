const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');

// 1. GET ALL WAREHOUSES
router.get('/', async (req, res) => {
  try {
    const warehouses = await Warehouse.find().sort({ createdAt: -1 });
    res.json(warehouses || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER NEW WAREHOUSE
router.post('/register', async (req, res) => {
  const { warehouseCode, warehouseName, location, remarks } = req.body;
  try {
    const newWarehouse = new Warehouse({
      warehouseCode: warehouseCode.trim().toUpperCase(),
      warehouseName,
      location,
      remarks
    });
    const savedWarehouse = await newWarehouse.save();
    res.status(201).json(savedWarehouse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;