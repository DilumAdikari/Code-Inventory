const mongoose = require('mongoose');

const FinishedGoodSchema = new mongoose.Schema({
  itemCode: { 
    type: String, 
    required: true, 
    unique: true 
  },
  itemName: { 
    type: String, 
    required: true 
  },
  uom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Uom',
    required: true 
  },
  sizes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Size' 
  }], 
  colors: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Color' 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('FinishedGood', FinishedGoodSchema);