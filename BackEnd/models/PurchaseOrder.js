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
    default: null
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

  
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    default: null
  },

 
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
     
      
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        default: null
      },
      materialId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Material',
        default: null
      },
      materialName: { type: String, default: '' },
      itemCode: { type: String, default: '' },

     
      colorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Color',
        default: null
      },
      colorName: { type: String, default: '' },
      sizeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Size',
        default: null
      },
      sizeName: { type: String, default: '' },

      uom: { type: String, default: '' },
      orderedQty: { type: Number, required: true, default: 0 },
      unitPrice: { type: Number, default: 0 },

      
      totalPrice: { type: Number, default: 0 }
    }
  ],

  totalAmount: {
    type: Number,
    default: 0
  },

  remarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);