const mongoose = require('mongoose');

// --- 1. ORDER ITEM BREAKDOWN SCHEMA ---
const OrderItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  color: { type: mongoose.Schema.Types.ObjectId, ref: 'Color', required: true },
  size: { type: String, required: true, trim: true }, 
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  
  // 🌟 ✅ FIXED: Live MRP Allocation එක ඩේටාබේස් එකේ සේව් වීමට මේ ෆීල්ඩ්ස් දෙක අනිවාර්යයෙන්ම තිබිය යුතුය!
  autoIssuedQty: { type: Number, default: 0 },
  netRequiredQty: { type: Number, default: 0 }
});

// --- 2. MAIN SALES ORDER SCHEMA WITH WORKFLOW TRACKING ---
const SalesOrderSchema = new mongoose.Schema({
  orderRef: { type: String, required: true, unique: true, trim: true }, 
  buyerName: { type: String, required: true, trim: true }, 
  shipmentDate: { type: Date, required: true },
  
  // Breakdown Items Grid Array
  items: [OrderItemSchema],
  
  // Calculated Cumulative Totals
  totalQuantity: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  
  // 🌟 WORKFLOW TEMPLATE LINK (මෙම ඕඩර් එකට අදාළ අනුමැතිය දීමේ පද්ධතිය සම්බන්ධ කරයි)
  workflowTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
  
  // 🌟 CURRENT APPROVAL HIERARCHY LEVEL (දැනට ඕඩර් එක තියෙන්නේ Level 1 ද, 2 ද කියා ට්‍රැක් කරයි)
  currentApprovalLevel: { type: Number, default: 1 },
  
  // 🌟 LIVE STATUS ENUM UPDATED (Draft ස්ටේටස් එක එකතු කරන ලදී)
  status: { 
    type: String, 
    enum: [
      'Draft',                // 🌟 අලුතින් හදන විට මුලින්ම පවතින අවස්ථාව
      'Pending Approval',     // වර්ක්ෆ්ලෝ එකෙන් තවම ඇපෘව් වෙමින් පවතින අවස්ථාව
      'Approved',             // සියලුම වර්ක්ෆ්ලෝ ලෙවල්ස් සාර්ථකව නිම වූ අවස්ථාව
      'Costed & Approved', 
      'Materials Issued', 
      'Completed',
      'Rejected'              // යම් හෙයකින් රිජෙක්ට් කළහොත් (ආපහු Draft බවට පත්වේ)
    ], 
    default: 'Draft'          // 🌟 අලුත් ඕඩර් එකක් හැදෙන විට ඩීෆල්ට් ලෙස Draft විය යුතුය
  },

  // 🌟 APPROVAL SIGN-OFF LOG HISTORY (කවුද, kieweni level ekeda සටහන් වන ලොග් එක)
  approvalStatusHistory: [{
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    level: { type: Number },
    status: { type: String, enum: ['Approved', 'Rejected'] },
    remarks: { type: String, trim: true },
    date: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);