const mongoose = require('mongoose');

// --- 1. ORDER ITEM BREAKDOWN SCHEMA ---
const OrderItemSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'Material', required: true },
  color: { type: mongoose.Schema.Types.ObjectId, ref: 'Color', required: true },
  size: { type: String, required: true, trim: true }, 
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  
  // 
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
  
  
  workflowTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
  
  
  currentApprovalLevel: { type: Number, default: 1 },
  
  
  status: { 
    type: String, 
    enum: [
      'Draft',                 
      'Pending Approval',     
      'Approved',             
      'Costed & Approved', 
      'Materials Issued', 
      'Completed',
      'Rejected'         
    ], 
    default: 'Draft'          
  },

  
  approvalStatusHistory: [{
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    level: { type: Number },
    status: { type: String, enum: ['Approved', 'Rejected'] },
    remarks: { type: String, trim: true },
    date: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.model('SalesOrder', SalesOrderSchema);