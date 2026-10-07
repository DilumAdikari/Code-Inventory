const express = require('express');
const TransactionType = require('../models/TransactionType');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { status, sourceType } = req.query;
        const query = {};
        if (status) query.status = status;
        if (sourceType) query.sourceType = sourceType;

        const types = await TransactionType.find(query).sort({ typeName: 1 });
        res.status(200).json({ success: true, count: types.length, data: types });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch", error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { code } = req.body;
        const existing = await TransactionType.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: "Transaction Code already exists" });
        }

        const item = await TransactionType.create({ ...req.body, createdBy: req.user?._id });
        res.status(201).json({ success: true, message: "Transaction Type registered successfully", data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to register transaction type", error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const item = await TransactionType.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: "Transaction Type not found" });

        if (req.body.code && req.body.code.toUpperCase() !== item.code) {
            const existing = await TransactionType.findOne({ code: req.body.code.toUpperCase() });
            if (existing) return res.status(400).json({ success: false, message: "Code exists" });
        }

        Object.assign(item, req.body);
        await item.save();
        res.status(200).json({ success: true, message: "Transaction Type updated successfully", data: item });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update", error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await TransactionType.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Transaction Type deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete", error: error.message });
    }
});

// 🌟 වැදගත්ම දේ: CommonJS වලට අදාළව මෙන්න මේ විදිහට export කරන්න ඕනේ:
module.exports = router;