const mongoose = require('mongoose');

const CostingItemSchema = new mongoose.Schema({
  // 🌟 Validation ලෙඩ නොවෙන්න required තාවය ලිහිල් කර string/object දෙකටම ගැළපෙන ලෙස හැදුවා
  material: { type: String, required: true },
  //supplier: { type: String, required: true },
  uom: { type: String, default: 'Pcs' },
  consumption: { type: Number, default: 0 }, 
  wastagePercentage: { type: Number, default: 0 }, 
  unitCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 }, 
  totalWithWastage: { type: Number, default: 0 }
});

const CostingSchema = new mongoose.Schema({
  // 🌟 [අත්‍යවශ්‍යයි] CST-0001 ෆෝමැට් එක සේව් වීමට මෙම ෆීල්ඩ් එක තිබිය යුතුය!
  costingNo: { type: String, required: true, unique: true },

  costingDate: { type: String, required: true },
  // 🌟 Populate ලෙඩ නැතුව සේව් වෙන්න සරලව String (Ref ID) විදිහට ගත්තා
  salesOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesOrder', required: true },
  workflowTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  items: [CostingItemSchema],
  
  totalMaterialCost: { type: Number, default: 0 },
  cmCost: { type: Number, default: 0 }, 
  overheadCost: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  
  status: { type: String, enum: ['Draft', 'Pending Approval', 'Completed', 'Rejected'], default: 'Draft' },
  createdBy: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Costing', CostingSchema);