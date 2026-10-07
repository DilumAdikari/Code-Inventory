const mongoose = require('mongoose');

const SizeSchema = new mongoose.Schema({
  sizeCode: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true 
  },
  sizeDescription: { 
    type: String, 
    trim: true 
  }, 
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Size', SizeSchema);