const mongoose = require('mongoose');

const transactionTypeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    typeName: {
        type: String,
        required: true,
        trim: true
    },
    description: { type: String, trim: true },
    
    sourceType: {
        type: String,
        enum: ['with_po', 'with_issuing', 'open_balance'], // 🌟 With PO, With Issuing සහ Open Balance සඳහා සහය දක්වයි
        required: true,
        default: 'with_po'
    },

    requiresPO: { type: Boolean, default: false },
    requiresSupplier: { type: Boolean, default: true },
    requiresQC: { type: Boolean, default: false },
    allowsPartialReceipt: { type: Boolean, default: true },

    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('TransactionType', transactionTypeSchema);