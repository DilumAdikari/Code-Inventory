const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Workflow = require('../models/Workflow');

// Finds every field that points to Workflow, including fields inside item arrays
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

// Returns the names of every model that still uses this workflow
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

// Only these fields can be saved from the request body
const pickFields = (body = {}) => {
  const { code, description, permission, usersConfiguration } = body;
  return { code, description, permission, usersConfiguration: usersConfiguration || [] };
};

// 1. GET ALL WORKFLOWS
router.get('/', async (req, res) => {
  try {
    const workflows = await Workflow.find().populate('usersConfiguration.user', 'username role');
    res.json(workflows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. CREATE NEW WORKFLOW TEMPLATE
router.post('/', async (req, res) => {
  try {
    const newWorkflow = new Workflow(pickFields(req.body));
    const saved = await newWorkflow.save();
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Workflow code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 3. EDIT / UPDATE WORKFLOW TEMPLATE (PUT)
router.put('/:id', async (req, res) => {
  try {
    const updated = await Workflow.findByIdAndUpdate(
      req.params.id,
      pickFields(req.body),
      { new: true, runValidators: true }
    ).populate('usersConfiguration.user', 'username role');

    if (!updated) {
      return res.status(404).json({ message: 'Workflow not found!' });
    }
    res.status(200).json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Workflow code already exists!' });
    }
    res.status(400).json({ message: err.message });
  }
});

// 4. DELETE WORKFLOW — refused if any other record still uses this workflow
router.delete('/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ message: 'Workflow not found!' });
    }

    const usedIn = await findUsage('Workflow', workflow._id, 'Workflow');
    if (usedIn.length > 0) {
      return res.status(409).json({
        message: `Workflow "${workflow.code}" cannot be deleted because it is used in: ${usedIn.join(', ')}.`
      });
    }

    await Workflow.deleteOne({ _id: workflow._id });
    res.json({ message: 'Workflow configuration removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;