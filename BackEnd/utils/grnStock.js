// BackEnd/utils/grnStock.js
// Shared GRN helpers: variant rules (colour / size) and stock updates.
//
// Rule: a material with an empty colors[] is colourless, and a material with an
// empty sizes[] is sizeless. For those rows the colour / size is stored as null
// and the stock row is matched with null.

const mongoose = require('mongoose');
const Material = require('../models/Material');
const FinishedGood = require('../models/FinishedGood');
const Stock = require('../models/Stock');

const toObjectIdOrNull = (value) => {
  const raw = value?._id || value;
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

// Returns Map: materialId (string) -> { hasColors, hasSizes }
const getVariantFlags = async (materialIds) => {
  const ids = [...new Set(materialIds.filter(Boolean).map(String))];
  const flags = new Map();
  if (ids.length === 0) return flags;

  const [materials, finishedGoods] = await Promise.all([
    Material.find({ _id: { $in: ids } }).select('colors sizes').lean(),
    FinishedGood.find({ _id: { $in: ids } }).select('colors sizes').lean()
  ]);

  [...materials, ...finishedGoods].forEach((doc) => {
    flags.set(String(doc._id), {
      hasColors: Array.isArray(doc.colors) && doc.colors.length > 0,
      hasSizes: Array.isArray(doc.sizes) && doc.sizes.length > 0
    });
  });
  return flags;
};

// Cleans GRN rows against each material's variant setup.
// Returns the cleaned rows and a list of problems (missing required data).
// Unknown materials are treated as having variants, so the old checks still apply.
const normalizeGrnItems = async (rows) => {
  const flagsMap = await getVariantFlags(rows.map(r => r.material));
  const missing = [];

  const items = rows.map((row, index) => {
    const flags = flagsMap.get(String(row.material)) || { hasColors: true, hasSizes: true };
    const color = flags.hasColors ? toObjectIdOrNull(row.color) : null;
    const size = flags.hasSizes ? toObjectIdOrNull(row.size) : null;

    if (flags.hasColors && !color) missing.push(`Row ${index + 1}: colour is required`);
    if (flags.hasSizes && !size) missing.push(`Row ${index + 1}: size is required`);
    if (!row.storeLocation) missing.push(`Row ${index + 1}: store location is required`);

    return { ...row, color, size };
  });

  return { items, missing };
};

// Adds the received qty to Stock for a Completed GRN.
const processGrnStockUpdate = async (grnDoc) => {
  if (grnDoc.status !== 'Completed' || !grnDoc.items || grnDoc.items.length === 0) return;

  for (const item of grnDoc.items) {
    if (!item.material || !item.storeLocation) continue;

    const qty = Number(item.receivedQty || 0);

    await Material.findByIdAndUpdate(item.material, { $inc: { stockBalance: qty } }).catch(() => {});
    await FinishedGood.findByIdAndUpdate(item.material, { $inc: { stockBalance: qty } }).catch(() => {});

    await Stock.findOneAndUpdate(
      {
        material: item.material,
        color: item.color || null,
        size: item.size || null,
        warehouse: item.storeLocation,
        unitPrice: Number(item.unitPrice || 0)
      },
      { $inc: { qty } },
      { upsert: true, new: true }
    );
  }
};

module.exports = {
  toObjectIdOrNull,
  getVariantFlags,
  normalizeGrnItems,
  processGrnStockUpdate
};
