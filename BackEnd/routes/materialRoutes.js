const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Material = require('../models/Material');

// Finds every field that points to Material (ref: 'Material'), including fields inside item arrays
const findMaterialRefPaths = (schema, prefix = '', out = []) => {
  Object.entries(schema.paths).forEach(([p, type]) => {
    const ref = type.options?.ref || type.caster?.options?.ref;
    if (ref === 'Material') out.push(prefix + p);
  });
  (schema.childSchemas || []).forEach(({ schema: child, path }) => {
    findMaterialRefPaths(child, `${prefix}${path}.`, out);
  });
  return out;
};

// Returns the names of every model that still uses this material
const findMaterialUsage = async (materialId) => {
  const usedIn = [];
  for (const name of mongoose.modelNames()) {
    if (name === 'Material') continue;
    const Model = mongoose.model(name);
    const paths = findMaterialRefPaths(Model.schema);
    for (const p of paths) {
      const found = await Model.exists({ [p]: materialId });
      if (found) {
        usedIn.push(name);
        break;
      }
    }
  }
  return usedIn;
};

// 1. GET ALL MATERIALS WITH FULL POPULATE Matrix
router.get('/', async (req, res) => {
  try {
    const materials = await Material.find()
      .populate('uom')
      .populate('colors')
      .populate('sizes')
      .sort({ createdAt: -1 });
    res.json(materials || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. REGISTER NEW MATERIAL
router.post('/', async (req, res) => {
  const { itemCode, materialName, uom, colors, sizes } = req.body;

  try {
    const formattedSizes = Array.isArray(sizes) ? sizes : (sizes ? [sizes] : []);

    const newMaterial = new Material({
      itemCode,
      materialName,
      uom,
      colors,
      sizes: formattedSizes
    });

    const savedMaterial = await newMaterial.save();

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
      return res.status(404).json({ message: 'Material not found!' });
    }

    res.status(200).json(updatedMaterial);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 4. DELETE MATERIAL — refused if any other record still uses it
router.delete('/:id', async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ message: 'Material not found!' });
    }

    const usedIn = await findMaterialUsage(material._id);
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `"${material.materialName}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await Material.deleteOne({ _id: material._id });
    res.status(200).json({ message: 'Material deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;