const express = require('express');
const router = express.Router();
const Material = require('../models/Material');

// 1. GET ALL MATERIALS WITH FULL POPULATE Matrix
router.get('/', async (req, res) => {
  try {
    // 🌟 ✅ FIXED: sizeId වෙනුවට multiple sizes array එක populate කිරීමට sizes පාවිච්චි කිරීම
    const materials = await Material.find()
      .populate('uom')
      .populate('colors')
      .populate('sizes') // 🌟 බහු සයිස් දත්ත (sizeCode/sizeDescription) ඔටෝම ඇදලා ගැනීමට
      .sort({ createdAt: -1 });
    res.json(materials || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER NEW MATERIAL 
router.post('/', async (req, res) => {
  // 🌟 ✅ FIXED: sizeId වෙනුවට sizes (array එකක්) destructure කරගැනීම
  const { itemCode, materialName, uom, colors, sizes } = req.body;

  try {
    // 🌟 ✅ CRITICAL VALIDATION: sizes array එකක් ලෙස ලැබෙන නිසා, එය හිස් නම් හිස් අරේ එකක් ලෙස යැවීම
    const formattedSizes = Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []);

    const newMaterial = new Material({
      itemCode,      
      materialName,  
      uom,
      colors,
      sizes: formattedSizes // 🌟 ✅ FIXED: බහු සයිස් අරේ එක මොඩල් එකට ඇතුළත් කළා
    });

    const savedMaterial = await newMaterial.save();
    
    // සේව් වූ වහාම populate කර රිස්පොන්ස් එක යැවීම
    const populatedMaterial = await Material.findById(savedMaterial._id)
      .populate('uom')
      .populate('colors')
      .populate('sizes');

    res.status(201).json(populatedMaterial);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 3. EDIT / UPDATE MATERIAL (PUT)
router.put('/:id', async (req, res) => {
  const { itemCode, materialName, uom, colors, sizes } = req.body;

  try {
    const formattedSizes = Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []);

    const updatedMaterial = await Material.findByIdAndUpdate(
      req.params.id,
      {
        itemCode,
        materialName,
        uom,
        colors,
        sizes: formattedSizes
      },
      { new: true, runValidators: true }
    )
    .populate('uom')
    .populate('colors')
    .populate('sizes');

    if (!updatedMaterial) {
      return res.status(404).json({ message: "Material not found!" });
    }

    res.status(200).json(updatedMaterial);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;