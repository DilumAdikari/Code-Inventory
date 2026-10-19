const express = require('express');
const router = express.Router();
const SalesOrder = require('../models/SalesOrder');
const Costing = require('../models/Costing');
const GRN = require('../models/GRN');
const MaterialIssue = require('../models/MaterialIssue');
const Stock = require('../models/Stock');

// Stock quantity at or below this value is counted as low stock
const LOW_STOCK_THRESHOLD = 10;

// How often the live stream pushes fresh data to each connected client (milliseconds)
const STREAM_INTERVAL_MS = 10000;

// Builds the complete dashboard payload from the database
const buildSummary = async () => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalSalesOrders,
    salesOrdersThisMonth,
    pendingCostings,
    approvedCostings,
    issuedTodayAgg,
    issuedTotalAgg,
    grnsThisMonth,
    lowStockAgg,
    salesByStatusAgg,
    monthlySalesAgg,
    recentOrders
  ] = await Promise.all([
    SalesOrder.countDocuments(),
    SalesOrder.countDocuments({ createdAt: { $gte: startOfMonth } }),
    Costing.countDocuments({ status: 'Pending Approval' }),
    Costing.countDocuments({ status: 'Completed' }),

    // Total issued quantity for materials issued today
    MaterialIssue.aggregate([
      { $match: { status: 'ISSUED', createdAt: { $gte: startOfToday } } },
      { $unwind: '$items' },
      { $group: { _id: null, qty: { $sum: '$items.issuedQty' } } }
    ]),

    // Total issued quantity for all time
    MaterialIssue.aggregate([
      { $match: { status: 'ISSUED' } },
      { $unwind: '$items' },
      { $group: { _id: null, qty: { $sum: '$items.issuedQty' } } }
    ]),

    GRN.countDocuments({ status: 'Completed', createdAt: { $gte: startOfMonth } }),

    // Number of material stock lines at or below the threshold
    Stock.aggregate([
      { $match: { itemType: 'Material', qty: { $lte: LOW_STOCK_THRESHOLD } } },
      { $count: 'count' }
    ]),

    // Sales order count grouped by status
    SalesOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),

    // Sales value grouped by year and month for the last 6 months
    SalesOrder.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          total: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      }
    ]),

    // Latest 5 sales orders
    SalesOrder.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderRef buyerName shipmentDate totalAmount status')
  ]);

  // Build the last 6 months in order, filling months without data with zero
  const monthlySales = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const found = monthlySalesAgg.find(
      (m) => m._id.y === monthDate.getFullYear() && m._id.m === monthDate.getMonth() + 1
    );
    monthlySales.push({
      month: monthDate.toLocaleString('en-US', { month: 'short' }),
      total: found ? found.total : 0,
      orders: found ? found.orders : 0
    });
  }

  return {
    generatedAt: now.toISOString(),
    stats: {
      totalSalesOrders,
      salesOrdersThisMonth,
      pendingCostings,
      approvedCostings,
      materialsIssuedToday: issuedTodayAgg[0]?.qty || 0,
      totalMaterialsIssued: issuedTotalAgg[0]?.qty || 0,
      grnsThisMonth,
      lowStockItems: lowStockAgg[0]?.count || 0
    },
    salesByStatus: salesByStatusAgg.map((item) => ({ status: item._id, count: item.count })),
    monthlySales,
    recentOrders
  };
};

// One-time snapshot of the dashboard data
router.get('/summary', async (req, res) => {
  try {
    const summary = await buildSummary();
    res.json(summary);
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Live stream using Server-Sent Events: pushes fresh data immediately and then every STREAM_INTERVAL_MS
router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  let timer;
  let isClosed = false;

  // Sends one summary event to the connected client
  const pushSummary = async () => {
    if (isClosed) return;
    try {
      const summary = await buildSummary();
      res.write(`event: summary\ndata: ${JSON.stringify(summary)}\n\n`);
    } catch (err) {
      console.error('Dashboard stream error:', err);
      res.write(`event: dashboard-error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  };

  // Stop pushing when the client disconnects
  req.on('close', () => {
    isClosed = true;
    clearInterval(timer);
  });

  pushSummary();
  timer = setInterval(pushSummary, STREAM_INTERVAL_MS);
});

module.exports = router;