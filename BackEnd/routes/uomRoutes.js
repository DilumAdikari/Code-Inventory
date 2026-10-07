const express = require('express');
const router = express.Router();
const Uom = require('../models/Uom');

// 1. GET ALL UOMS
router.get('/', async (req, res) => {
  try {
    const uoms = await Uom.find().sort({ name: 1 });
    res.json(uoms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. ADD NEW UOM
router.post('/', async (req, res) => {
  const { name, abbreviation } = req.body;
  try {
    const newUom = new Uom({ name, abbreviation });
    const savedUom = await newUom.save();
    res.status(201).json(savedUom);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;