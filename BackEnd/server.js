const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
const User = require('./models/User');
const customerRoutes = require('./routes/customerRoutes');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5003;

// 1. MIDDLEWARES
app.use(cors());
app.use(express.json());

// HARDCODED DEFAULT ADMIN AUTO-SEED FUNCTION
const seedAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ role: 'Admin' });

    if (!adminExists) {
      console.log('🔄 No Admin user found in database! Initializing hardcoded admin...');
      const hashedPassword = await bcrypt.hash('elisha@123', 10);

      const defaultAdmin = new User({
        username: 'admin',
        password: hashedPassword,
        role: 'Admin'
      });

      await defaultAdmin.save();
      console.log('✅ Default Admin created successfully!');
      console.log('👉 Username: admin | Password: MyNewAdmin@2026');
    } else {
      console.log('✅ Active Admin user profile detected in database.');
    }
  } catch (err) {
    console.error('❌ Failed to seed default admin user:', err);
  }
};

// 2. MONGODB CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    mongoose.connection.syncIndexes(); 
    seedAdminUser(); 
  })
  .catch(err => console.error('❌ Database Connection Error:', err));

// 3. BASE ROUTE
app.get('/', (req, res) => {
  res.send('Green ERP Backend Server is Running Successfully!');
});

// 4. API ROUTES CONNECTING (සියලුම ලයිව් මොඩියුලයන් නූලටම සම්බන්ධ කර ඇත)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/workflows', require('./routes/workflowRoutes')); 
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/colors', require('./routes/colorRoutes'));
app.use('/api/uoms', require('./routes/uomRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/factories', require('./routes/factoryRoutes'));
app.use('/api/sales-orders', require('./routes/salesOrderRoutes'));
app.use('/api/grn', require('./routes/grnRoutes'));
app.use('/api/warehouses', require('./routes/warehouseRoutes'));
app.use('/api/approvals', require('./routes/approvalRoutes'));
app.use('/api/costing', require('./routes/costingRoutes'));
app.use('/api/sizes', require('./routes/sizeRoutes'));
app.use('/api/customers', customerRoutes);

// Stock Overview API එක
app.use('/api/stocks', require('./routes/stockRoutes'));

// Material Issuing Registry API එක
app.use('/api/material-issues', require('./routes/materialIssueRoutes'));

// Production Orders මොඩියුලය
app.use('/api/production-orders', require('./routes/productionOrderRoutes'));

// Finished Goods API එක
app.use('/api/finished-goods', require('./routes/finishedGoodsRoutes'));

// Purchasing / Procurement මොඩියුලය
app.use('/api/purchases', require('./routes/purchaseRoutes'));

// Transaction Types API Route එක
app.use('/api/transaction-types', require('./routes/transactionTypeRoutes'));

// OUTBOUND SALES INVOICES API ROUTE එක
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// 🌟 ✅ GRN RETURNS API ROUTE එක අලුතින් සම්බන්ධ කළා (මෙන්න මේක තමයි අඩුවට තිබුණේ)
app.use('/api/grn-returns', require('./routes/grnReturns'));

// 5. SERVER START (මෙයට සියලුම app.use රූට්ස් වලට පසුව යා යුතුයි)
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Green ERP server listening on port ${port}`);
});