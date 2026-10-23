const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const FinishedGood = require('../models/FinishedGood');

// Finds every field that points to FinishedGood, including fields inside item arrays
const findRefPaths = (schema, refName, prefix = '', out = []) => {
  Object.entries(schema.paths).forEach(([p, type]) => {
    const ref = type.options?.ref || type.caster?.options?.ref;
    if (ref === refName) out.push(prefix + p);
  });
  (schema.childSchemas || []).forEach(({ schema: child, path }) => {
    findRefPaths(child, refName, `${prefix}${path}.`, out);
  });
  return out;
};

// Returns the names of every model that still uses this finished good
const findUsage = async (refName, id, ownModelName) => {
  const usedIn = [];
  for (const name of mongoose.modelNames()) {
    if (name === ownModelName) continue;
    const Model = mongoose.model(name);
    for (const p of findRefPaths(Model.schema, refName)) {
      if (await Model.exists({ [p]: id })) {
        usedIn.push(name);
        break;
      }
    }
  }
  return usedIn;
};

// 1. GET ALL
router.get('/', async (req, res) => {
  try {
    const products = await FinishedGood.find()
      .populate('uom')
      .populate('sizes')
      .populate('colors')
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
      sizes: sizes || [],
      colors: colors || [],
      ...rest
    });

    await newProduct.save();

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

// 3. UPDATE (PUT)
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

// 4. DELETE — refused if any other record still uses this finished good
router.delete('/:id', async (req, res) => {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Finished Good not found!" });
    }

    const usedIn = await findUsage('FinishedGood', item._id, 'FinishedGood');
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `"${item.itemName}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await FinishedGood.deleteOne({ _id: item._id });
    res.status(200).json({ message: "Finished good deleted successfully." });
  } catch (err) {
    console.error("❌ Delete Finished Good Error:", err.message);
    res.status(500).json({ message: "Error deleting finished good", error: err.message });
  }
});

module.exports = router;