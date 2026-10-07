const express = require('express');
const router = express.Router();
const Workflow = require('../models/Workflow');

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
  const { code, description, permission, usersConfiguration } = req.body;
  try {
    const newWorkflow = new Workflow({ code, description, permission, usersConfiguration });
    const saved = await newWorkflow.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 3. DELETE WORKFLOW
router.delete('/:id', async (req, res) => {
  try {
    await Workflow.findByIdAndDelete(req.params.id);
    res.json({ message: 'Workflow configuration removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;