const mongoose = require('mongoose');

const MaterialSchema = new mongoose.Schema({
  itemCode: { 
    type: String, 
    required: true, 
    unique: true, // 🌟 අලුත් එක විතරක් unique විය යුතුයි
    trim: true 
  },
  materialName: { 
    type: String, 
    required: true, 
    trim: true 
  },
  uom: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Uom', 
    required: true 
  },
  colors: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Color' 
  }],
  sizes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Size' 
  }]
}, { timestamps: true });

module.exports = mongoose.model('Material', MaterialSchema);