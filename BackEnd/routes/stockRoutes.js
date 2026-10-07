const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Stock = require('../models/Stock');
const Material = require('../models/Material');
const FinishedGood = require('../models/FinishedGood');
const Color = require('../models/Color');

let Size = null;
try { Size = mongoose.models.Size || require('../models/Size'); } catch (e) { Size = null; }

let Warehouse = null;
try { Warehouse = mongoose.models.Warehouse || require('../models/Warehouse'); } catch (e) { Warehouse = null; }

// GET LIVE STOCK MATRIX
router.get('/', async (req, res) => {
  try {
    // 🌟 Stock ඩේටා එකත් සමඟ Color, Size, සහ Warehouse ඩේටා එකපාර Populate කර ගැනීම
    const liveStock = await Stock.find()
      .populate({ path: 'color', select: 'colorName colorCode name nameS code', options: { strictPopulate: false } })
      .populate({ path: 'size', select: 'sizeCode sizeDescription name', options: { strictPopulate: false } })
      .populate({ path: 'warehouse', select: 'warehouseName warehouseCode', options: { strictPopulate: false } })
      .lean()
      .sort({ updatedAt: -1 });

    const populatedStock = await Promise.all(liveStock.map(async (stock) => {
      // ID එක ලබා ගැනීම
      const targetId = stock.material || stock.finishedGood || stock.item || stock.product;
      
      if (!targetId) return stock;

      let itemDoc = null;

      // 1. Material කලෙක්ෂන් එකෙන් සෙවීම (uom එකත් සමඟ populate කරයි)
      try {
        itemDoc = await Material.findById(targetId).populate('uom').lean();
      } catch (err) { itemDoc = null; }
      
      if (itemDoc) {
        stock.material = {
          ...itemDoc,
          itemName: itemDoc.materialName || itemDoc.itemName || 'Material Item',
          itemCode: itemDoc.materialCode || itemDoc.itemCode || 'MAT',
          uom: itemDoc.uom // UOM නම/ඔබ්ජෙක්ට් එක නිවැරදිව ලබා දීම
        };
      } else {
        // 2. FinishedGood කලෙක්ෂන් එකෙන් සෙවීම
        try {
          itemDoc = await FinishedGood.findById(targetId).populate('uom').lean();
        } catch (err) { itemDoc = null; }

        if (itemDoc) {
          stock.material = {
            ...itemDoc,
            itemName: itemDoc.itemName || itemDoc.name || 'Finished Good',
            itemCode: itemDoc.itemCode || itemDoc.styleNo || 'FG',
            uom: itemDoc.uom // UOM නම/ඔබ්ජෙක්ට් එක නිවැරදිව ලබා දීම
          };
        } else {
          // 3. කොහේවත් නැත්නම්
          stock.material = {
            itemName: 'Unnamed Item',
            itemCode: 'N/A'
          };
        }
      }

      return stock;
    }));

    res.json(populatedStock || []);
  } catch (err) {
    console.error("❌ Stock Fetch Error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;