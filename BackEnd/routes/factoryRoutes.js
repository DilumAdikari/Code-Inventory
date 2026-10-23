const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Factory = require('../models/Factory');

// Finds every field that points to Factory, including fields inside item arrays
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

// Returns the names of every model that still uses this factory
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
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Factory code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 3. EDIT / UPDATE FACTORY (PUT)
router.put('/:id', async (req, res) => {
  const { factoryCode, name, location, contactPerson, phone, email } = req.body;
  try {
    const updatedFactory = await Factory.findByIdAndUpdate(
      req.params.id,
      { factoryCode, name, location, contactPerson, phone, email },
      { new: true, runValidators: true }
    );
    if (!updatedFactory) {
      return res.status(404).json({ message: 'Factory not found!' });
    }
    res.status(200).json(updatedFactory);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Factory code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 4. DELETE FACTORY — refused if any other record still uses this factory
router.delete('/:id', async (req, res) => {
  try {
    const factory = await Factory.findById(req.params.id);
    if (!factory) {
      return res.status(404).json({ message: 'Factory not found!' });
    }

    const usedIn = await findUsage('Factory', factory._id, 'Factory');
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `"${factory.name}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await Factory.deleteOne({ _id: factory._id });
    res.status(200).json({ message: 'Factory deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;