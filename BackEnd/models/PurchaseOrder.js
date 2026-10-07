const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  purchaseOrderNo: { 
    type: String, 
    required: true, 
    unique: true 
  },
  productionOrder: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ProductionOrder', 
    required: true 
  },
  supplierName: { 
    type: String, 
    default: 'General Supplier' 
  },
  orderDate: { 
    type: Date, 
    default: Date.now 
  },
  expectedDeliveryDate: { 
    type: Date 
  },
  // ✅ workflow for approval routing
  workflowId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Workflow', 
    default: null 
  },
  // ✅ who created this PO
  createdBy: { 
    type: String, 
    default: 'SYSTEM' 
  },
  status: { 
    type: String, 
    enum: ['Draft', 'Pending Approval', 'Pending', 'Approved', 'Received', 'Cancelled'], 
    default: 'Draft' 
  },
  items: [
    {
      // ✅ FIXED — was ref: 'FinishedGood' which is wrong
      // Purchase order items come from BOM which uses Material model
      material: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Material' 
      },
      materialName: { type: String },
      itemCode: { type: String },
      colorName: { type: String },
      uom: { type: String },
      orderedQty: { type: Number, required: true },
      unitPrice: { type: Number, default: 0 },
      // ✅ added totalPrice per line for easy calculation
      totalPrice: { type: Number, default: 0 }
    }
  ],
  totalAmount: { 
    type: Number, 
    default: 0 
  },
  remarks: { 
    type: String 
  }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);