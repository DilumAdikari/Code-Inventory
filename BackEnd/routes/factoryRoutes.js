const express = require('express');
const router = express.Router();
const Factory = require('../models/Factory');

// 1. GET ALL FACTORIES
router.get('/', async (req, res) => {
  try {
    const factories = await Factory.find().sort({ name: 1 });
    res.json(factories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER NEW FACTORY
router.post('/', async (req, res) => {
  const { factoryCode, name, location, contactPerson, phone, email } = req.body;
  try {
    const newFactory = new Factory({ factoryCode, name, location, contactPerson, phone, email });
    const savedFactory = await newFactory.save();
    res.status(201).json(savedFactory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;