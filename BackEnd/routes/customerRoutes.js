const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Customer = require('../models/Customer');

// Only these fields can be saved from the request body
const pickFields = (body = {}) => {
  const { customerName, email, phone, address } = body;
  return { customerName, email, phone, address };
};

// Finds every field that points to Customer, including fields inside item arrays
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

// Returns the names of every model that still uses this customer
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

// GET all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new customer
router.post('/', async (req, res) => {
  try {
    const newCustomer = new Customer(pickFields(req.body));
    await newCustomer.save();
    res.status(201).json(newCustomer);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT edit customer
router.put('/:id', async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      pickFields(req.body),
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Customer not found!' });
    }
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE customer — refused if any other record still uses this customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found!' });
    }

    const usedIn = await findUsage('Customer', customer._id, 'Customer');
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `"${customer.customerName}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await Customer.deleteOne({ _id: customer._id });
    res.status(200).json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;