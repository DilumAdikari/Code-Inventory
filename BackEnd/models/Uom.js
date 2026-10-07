const mongoose = require('mongoose');

const UomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // එකම UOM එක දෙපාරක් බෑ (e.g., Meters)
    trim: true
  },
  abbreviation: {
    type: String,
    required: true,
    unique: true, // e.g., "M", "Pcs", "Yds"
    trim: true,
    uppercase: true // හැමවෙලේම Capital අකුරෙන් සේව් වෙන්න
  }
}, { timestamps: true });

module.exports = mongoose.model('Uom', UomSchema);