const express = require('express');
const router = express.Router();
const Size = require('../models/Size');

// 1. GET ALL SIZES
router.get('/', async (req, res) => {
  try {
    const sizes = await Size.find().sort({ createdAt: -1 });
    res.json(sizes || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE NEW SIZE
router.post('/save', async (req, res) => {
  const { sizeId, sizeCode, sizeDescription, status } = req.body;
  try {
    let sizeDoc;
    if (sizeId) {
      // Update Existing
      sizeDoc = await Size.findByIdAndUpdate(
        sizeId,
        { sizeCode, sizeDescription, status },
        { new: true, runValidators: true }
      );
    } else {
      // Create New
      sizeDoc = new Size({ sizeCode, sizeDescription, status });
      await sizeDoc.save();
    }
    res.status(200).json(sizeDoc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 3. DELETE SIZE
router.delete('/:id', async (req, res) => {
  try {
    const sizeDoc = await Size.findById(req.params.id);
    if (!sizeDoc) return res.status(404).json({ message: 'Size not found' });
    await Size.findByIdAndDelete(req.params.id);
    res.json({ message: 'Size deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;