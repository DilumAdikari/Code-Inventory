const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
  material: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'itemType' // 🌟 මැටීරියල් එකක්ද නැත්නම් Finished Good එකක්ද කියලා ගතිකව (Dynamic) තෝරා ගනී!
  },
  itemType: {
    type: String,
    required: true,
    enum: ['Material', 'FinishedGood'],
    default: 'Material'
  },
  color: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Color', 
    required: true 
  },
  // 🌟 ✅ FIXED: Stock එකට Size එකත් ඇතුළත් කිරීමට එකතු කළ කොටස
  size: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Size', 
    default: null 
  },
  warehouse: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Warehouse', 
    required: true 
  },
  unitPrice: { 
    type: Number, 
    default: 0, 
    required: true 
  }, 
  qty: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// 🌟 ✅ FIXED: Unique Index එකට size එකත් ඇතුළත් කළා (Material, Color, Size, Warehouse සහ UnitPrice අනුව වෙන වෙනම Stock ලෙජර් සකස් වීමට)
StockSchema.index({ material: 1, color: 1, size: 1, warehouse: 1, unitPrice: 1 }, { unique: true });

module.exports = mongoose.model('Stock', StockSchema);