const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const customerRoutes = require('./routes/customerRoutes');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5003;

// 1. MIDDLEWARES
app.use(cors());
app.use(express.json());

// 2. MONGODB CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    mongoose.connection.syncIndexes();
  })
  .catch(err => console.error('❌ Database Connection Error:', err));

// 3. BASE ROUTE
app.get('/', (req, res) => {
  res.send('Green ERP Backend Server is Running Successfully!');
});


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


app.use('/api/stocks', require('./routes/stockRoutes'));


app.use('/api/material-issues', require('./routes/materialIssueRoutes'));


app.use('/api/production-orders', require('./routes/productionOrderRoutes'));


app.use('/api/finished-goods', require('./routes/finishedGoodsRoutes'));


app.use('/api/purchases', require('./routes/purchaseRoutes'));


app.use('/api/transaction-types', require('./routes/transactionTypeRoutes'));


app.use('/api/invoices', require('./routes/invoiceRoutes'));


app.use('/api/grn-returns', require('./routes/grnReturns'));

app.use('/api/dashboard', require('./routes/dashboardRoutes'));

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Green ERP server listening on port ${port}`);
});