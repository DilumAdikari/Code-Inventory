const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Supplier = require('../models/Supplier');

// Finds every field that points to Supplier, including fields inside item arrays
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

// Returns the names of every model that still uses this supplier
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
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Supplier code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 3. EDIT / UPDATE SUPPLIER (PUT)
router.put('/:id', async (req, res) => {
  const { supplierCode, name, companyName, email, phone, address, suppliedCategories } = req.body;
  try {
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { supplierCode, name, companyName, email, phone, address, suppliedCategories },
      { new: true, runValidators: true }
    );
    if (!updatedSupplier) {
      return res.status(404).json({ message: 'Supplier not found!' });
    }
    res.status(200).json(updatedSupplier);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Supplier code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 4. DELETE SUPPLIER — refused if any other record still uses this supplier
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found!' });
    }

    const usedIn = await findUsage('Supplier', supplier._id, 'Supplier');
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `"${supplier.companyName || supplier.name}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await Supplier.deleteOne({ _id: supplier._id });
    res.status(200).json({ message: 'Supplier deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;