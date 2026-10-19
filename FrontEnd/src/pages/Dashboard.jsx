import React, { useEffect, useState } from 'react';
import { API_URL } from '../api/config';
import {
  ShoppingBag,
  Calculator,
  TrendingUp,
  Package,
  CheckCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Chart colors for each sales order status
const STATUS_COLORS = {
  'Draft': '#94a3b8',
  'Pending Approval': '#f59e0b',
  'Approved': '#14b8a6',
  'Costed & Approved': '#3b82f6',
  'Materials Issued': '#8b5cf6',
  'Completed': '#10b981',
  'Rejected': '#f43f5e'
};

// Badge styles for each sales order status in the table
const STATUS_BADGE = {
  'Draft': 'bg-slate-100 text-slate-600',
  'Pending Approval': 'bg-amber-50 text-amber-700',
  'Approved': 'bg-teal-50 text-teal-700',
  'Costed & Approved': 'bg-blue-50 text-blue-700',
  'Materials Issued': 'bg-purple-50 text-purple-700',
  'Completed': 'bg-emerald-50 text-emerald-700',
  'Rejected': 'bg-rose-50 text-rose-700'
};

// Formats a number as LKR currency text
const formatLKR = (value) =>
  `LKR ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// Formats a number with thousand separators
const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');

// Formats a date as DD/MM/YYYY
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB') : '-');

// Formats a time as HH:MM:SS
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString('en-GB') : '-');

// Shortens large values on the chart axis (e.g. 1.5M, 250K)
const formatAxisValue = (value) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value;
};

const Dashboard = () => {
  // Latest dashboard payload received from the server
  const [data, setData] = useState(null);

  // True until the first response (or first error) arrives
  const [loading, setLoading] = useState(true);

  // Error message to show to the user
  const [error, setError] = useState('');

  // True while the live connection to the server is open
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Opens a live stream; the server sends a fresh summary every few seconds
    const source = new EventSource(`${API_URL}/dashboard/stream`);

    // Handles each fresh summary sent by the server
    source.addEventListener('summary', (event) => {
      if (!isMounted) return;
      setData(JSON.parse(event.data));
      setError('');
      setIsLive(true);
      setLoading(false);
    });

    // Handles database errors reported by the server
    source.addEventListener('dashboard-error', (event) => {
      if (!isMounted) return;
      const payload = JSON.parse(event.data);
      setError(payload.message || 'Dashboard data could not be loaded.');
      setLoading(false);
    });

    // Handles lost connections; the browser reconnects automatically
    source.onerror = () => {
      if (!isMounted) return;
      setIsLive(false);
      setLoading(false);
      setError((previous) => previous || 'Cannot reach the server. Reconnecting...');
    };

    // Closes the stream when the page is left
    return () => {
      isMounted = false;
      source.close();
    };
  }, []);

  // Shows a spinner until the first data arrives
  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="animate-spin text-emerald-700" size={20} />
        Loading dashboard...
      </div>
    );
  }

  // Shows only the error when there is no data to display
  if (!data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  const stats = data.stats;

  // KPI card definitions
  const statCards = [
    {
      title: 'Total Sales Orders',
      value: formatNumber(stats.totalSalesOrders),
      subtitle: `${formatNumber(stats.salesOrdersThisMonth)} this month`,
      icon: <ShoppingBag className="text-emerald-600" size={22} />,
      background: 'bg-emerald-50'
    },
    {
      title: 'Pending Costings',
      value: formatNumber(stats.pendingCostings),
      subtitle: 'Requires approval',
      icon: <Calculator className="text-amber-600" size={22} />,
      background: 'bg-amber-50'
    },
    {
      title: 'Approved Costings',
      value: formatNumber(stats.approvedCostings),
      subtitle: 'Ready for issuing',
      icon: <TrendingUp className="text-teal-600" size={22} />,
      background: 'bg-teal-50'
    },
    {
      title: 'Materials Issued',
      value: `${formatNumber(stats.materialsIssuedToday)} qty`,
      subtitle: `Total: ${formatNumber(stats.totalMaterialsIssued)} · Today`,
      icon: <Package className="text-blue-600" size={22} />,
      background: 'bg-blue-50'
    },
    {
      title: 'GRNs This Month',
      value: formatNumber(stats.grnsThisMonth),
      subtitle: 'Inward completed',
      icon: <CheckCircle className="text-indigo-600" size={22} />,
      background: 'bg-indigo-50'
    },
    {
      title: 'Low Stock Items',
      value: formatNumber(stats.lowStockItems),
      subtitle: 'Quantity 10 or less',
      icon: <AlertTriangle className="text-rose-600" size={22} />,
      background: 'bg-rose-50'
    }
  ];

  // Pie chart data: one slice per sales order status
  const statusPieData = data.salesByStatus.map((item) => ({
    name: item.status,
    value: item.count
  }));

  return (
    <div className="space-y-8">

      {/* PAGE HEADER WITH LIVE STATUS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">An overview of the system at a glance.</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
              isLive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isLive ? 'Live' : 'Reconnecting'}
          </span>
          <span className="text-slate-400">Updated {formatTime(data.generatedAt)}</span>
        </div>
      </div>

      {/* CONNECTION WARNING (shown when data exists but the live connection has a problem) */}
      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors duration-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{card.title}</span>
              <div className={`p-2.5 rounded-xl ${card.background}`}>{card.icon}</div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{card.value}</h3>
              <p className="text-[11px] mt-1 font-medium text-slate-500">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Monthly sales value for the last 6 months */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Monthly Sales Value</h2>
            <p className="text-xs text-slate-500">Total value of sales orders for the last 6 months</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySales} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={formatAxisValue} />
                <Tooltip
                  formatter={(value) => formatLKR(value)}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#059669"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sales orders grouped by status */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Orders by Status</h2>
            <p className="text-xs text-slate-500">Number of sales orders in each status</p>
          </div>
          <div className="h-72">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {statusPieData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">
                No sales orders yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECENT SALES ORDERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Sales Orders</h2>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Latest 5
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Order Ref</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Buyer</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Shipment Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 text-sm font-semibold text-emerald-950">{order.orderRef}</td>
                    <td className="p-4 text-sm text-slate-700 font-medium">{order.buyerName}</td>
                    <td className="p-4 text-sm text-slate-500">{formatDate(order.shipmentDate)}</td>
                    <td className="p-4 text-sm font-semibold text-slate-800">{formatLKR(order.totalAmount)}</td>
                    <td className="p-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_BADGE[order.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-sm text-slate-400 italic">
                    No sales orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;