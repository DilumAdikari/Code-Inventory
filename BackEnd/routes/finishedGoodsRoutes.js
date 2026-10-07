const express = require('express');
const router = express.Router();
const FinishedGood = require('../models/FinishedGood');

// 1. සියලුම Finished Goods ලබා ගැනීම (GET - Populate සහිතව නිවැරදිව)
router.get('/', async (req, res) => {
  try {
    const products = await FinishedGood.find()
      .populate('uom')     // 🌟 UOM ඩේටා සම්පූර්ණයෙන් ගෙන ඒමට
      .populate('sizes')   // 🌟 Multiple Sizes ඩේටා සම්පූර්ණයෙන් ගෙන ඒමට
      .populate('colors')  // 🌟 Colors ඩේටා සම්පූර්ණයෙන් ගෙන ඒමට
      .sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error("❌ Get Finished Goods Error:", err.message);
    res.status(500).json({ message: "Error fetching finished goods", error: err.message });
  }
});

// 2. අලුත් Finished Good එකක් Save කිරීම (POST)
router.post('/create', async (req, res) => {
  try {
    const { itemCode, itemName, uom, sizes, colors, ...rest } = req.body;
    
    const newProduct = new FinishedGood({
      itemCode,
      itemName,
      uom,
      sizes: sizes || [],      // 🌟 බහු සයිස් අරේ එක ලබා දීම
      colors: colors || [],    // 🌟 කලර්ස් අරේ එක ලබා දීම
      ...rest
    });

    await newProduct.save();
    
    // 🌟 සේව් වුණු වහාම populate කර රිස්පොන්ස් එක යැවීම
    const populatedProduct = await FinishedGood.findById(newProduct._id)
      .populate('uom')
      .populate('sizes')
      .populate('colors');

    res.status(201).json(populatedProduct);
  } catch (err) {
    console.error("❌ Create Finished Good Error:", err.message);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Item Code already exists!" });
    }
    res.status(500).json({ message: "Error creating finished good", error: err.message });
  }
});

// 3. Finished Good එකක් Edit/Update කිරීම (PUT)
router.put('/:id', async (req, res) => {
  try {
    const { itemCode, itemName, uom, sizes, colors, ...rest } = req.body;

    const updatedProduct = await FinishedGood.findByIdAndUpdate(
      req.params.id,
      {
        itemCode,
        itemName,
        uom,
        sizes: sizes || [],
        colors: colors || [],
        ...rest
      },
      { new: true, runValidators: true }
    )
    .populate('uom')
    .populate('sizes')
    .populate('colors');

    if (!updatedProduct) {
      return res.status(404).json({ message: "Finished Good not found!" });
    }

    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error("❌ Update Finished Good Error:", err.message);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Item Code already exists!" });
    }
    res.status(500).json({ message: "Error updating finished good", error: err.message });
  }
});

module.exports = router;