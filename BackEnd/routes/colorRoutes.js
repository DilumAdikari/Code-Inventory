const express = require('express');
const router = express.Router();
const Color = require('../models/Color');


router.get('/', async (req, res) => {
  try {
    const colors = await Color.find().sort({ name: 1 });
    res.json(colors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/', async (req, res) => {
  const { name, code } = req.body;
  try {
    const newColor = new Color({ name, code });
    const savedColor = await newColor.save();
    res.status(201).json(savedColor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;