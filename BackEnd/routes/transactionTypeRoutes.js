const express = require('express');
const mongoose = require('mongoose');
const TransactionType = require('../models/TransactionType');

const router = express.Router();

// Only these fields can be saved from the request body
const ALLOWED_FIELDS = [
  'code',
  'typeName',
  'description',
  'sourceType',
  'requiresPO',
  'requiresSupplier',
  'requiresIssuing',
  'requiresQC',
  'allowsPartialReceipt',
  'status',
];

const pickFields = (body = {}) => {
  const out = {};
  ALLOWED_FIELDS.forEach((key) => {
    if (body[key] !== undefined) out[key] = body[key];
  });
  if (typeof out.code === 'string') out.code = out.code.trim().toUpperCase();
  return out;
};

// Finds every field that points to TransactionType, including fields inside item arrays
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

// Returns the names of every model that still uses this transaction type
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

router.get('/', async (req, res) => {
  try {
    const { status, sourceType } = req.query;
    const query = {};
    if (status) query.status = status;
    if (sourceType) query.sourceType = sourceType;

    const types = await TransactionType.find(query).sort({ typeName: 1 });
    res.status(200).json({ success: true, count: types.length, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = pickFields(req.body);
    if (!data.code) {
      return res.status(400).json({ success: false, message: 'Transaction Code is required' });
    }

    const existing = await TransactionType.findOne({ code: data.code });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Transaction Code already exists' });
    }

    const item = await TransactionType.create({ ...data, createdBy: req.user?._id });
    res.status(201).json({ success: true, message: 'Transaction Type registered successfully', data: item });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Transaction Code already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to register transaction type', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Transaction Type not found' });
    }

    const item = await TransactionType.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Transaction Type not found' });
    }

    const data = pickFields(req.body);
    if (data.code && data.code !== item.code) {
      const existing = await TransactionType.findOne({ code: data.code });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Transaction Code already exists' });
      }
    }

    Object.assign(item, data);
    await item.save();
    res.status(200).json({ success: true, message: 'Transaction Type updated successfully', data: item });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Transaction Code already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update', error: error.message });
  }
});

// DELETE — refused if any other record still uses this transaction type
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Transaction Type not found' });
    }

    const item = await TransactionType.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Transaction Type not found' });
    }

    const usedIn = await findUsage('TransactionType', item._id, 'TransactionType');
    if (usedIn.length > 0) {
      return res.status(409).json({
        success: false,
        message: `"${item.code}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`,
      });
    }

    await TransactionType.deleteOne({ _id: item._id });
    res.status(200).json({ success: true, message: 'Transaction Type deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete', error: error.message });
  }
});

module.exports = router;