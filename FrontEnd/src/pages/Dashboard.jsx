import React from 'react';
import { 
  ShoppingBag, 
  Calculator, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle, 
  AlertTriangle,
  Package,
  TrendingUp
} from 'lucide-react';

const Dashboard = () => {
  // 1. වඩාත් විස්තරාත්මක Cards 6ක් (Stats Cards)
  const stats = [
    {
      title: "Total Sales Orders",
      value: "42",
      change: "+12% vs last month",
      isPositive: true,
      icon: <ShoppingBag className="text-emerald-600" size={22} />,
      bg: "bg-emerald-50"
    },
    {
      title: "Pending Costings",
      value: "08",
      change: "Requires Approval",
      isPositive: false,
      icon: <Calculator className="text-amber-600" size={22} />,
      bg: "bg-amber-50"
    },
    {
      title: "Approved Costings",
      value: "24",
      change: "Ready for Issuing",
      isPositive: true,
      icon: <TrendingUp className="text-teal-600" size={22} />,
      bg: "bg-teal-50"
    },
    {
      title: "Materials Issued",
      value: "1,240 items",
      change: "Today",
      isPositive: true,
      icon: <Package className="text-blue-600" size={22} />,
      bg: "bg-blue-50"
    },
    {
      title: "Recent GRNs",
      value: "15",
      change: "Inward completed",
      isPositive: true,
      icon: <CheckCircle className="text-indigo-600" size={22} />,
      bg: "bg-indigo-50"
    },
    {
      title: "Low Stock Alerts",
      value: "03 Items",
      change: "Check Register",
      isPositive: false,
      icon: <AlertTriangle className="text-rose-600" size={22} />,
      bg: "bg-rose-50"
    }
  ];

  // 2. Recent Sales Orders Data
  const recentOrders = [
    { id: "SO-2026-001", customer: "Apex Holdings", date: "2026-07-02", status: "Pending Costing", amount: "LKR 450,000" },
    { id: "SO-2026-002", customer: "Vogue Tex", date: "2026-07-01", status: "Costed & Approved", amount: "LKR 1,200,000" },
    { id: "SO-2026-003", customer: "Brandix Lanka", date: "2026-06-30", status: "Materials Issued", amount: "LKR 850,000" },
    { id: "SO-2026-004", customer: "MAS Active", date: "2026-06-29", status: "Completed", amount: "LKR 620,000" },
  ];

  return (
    <div className="space-y-8">
      {/* WELCOME BANNER (බටන් එක අයින් කර ඇත) */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back! Here is what's happening with your system today.</p>
      </div>

      {/* STATS CARDS GRID - දැන් columns 6ක් ලස්සනට grid එකකට වැටෙනවා */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-colors duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{stat.title}</span>
              <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                {stat.icon}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
              <p className="text-[11px] mt-1 flex items-center font-medium text-slate-500">
                <span>{stat.change}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT SALES ORDERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Recent Sales Orders</h2>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            Live Track
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Order ID</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Customer</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Date</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Value</th>
                <th className="p-4 text-xs font-semibold text-slate-500 tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentOrders.map((order, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-4 text-sm font-semibold text-emerald-950">{order.id}</td>
                  <td className="p-4 text-sm text-slate-700 font-medium">{order.customer}</td>
                  <td className="p-4 text-sm text-slate-500">{order.date}</td>
                  <td className="p-4 text-sm font-semibold text-slate-800">{order.amount}</td>
                  <td className="p-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${order.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                      ${order.status === 'Pending Costing' ? 'bg-amber-50 text-amber-700' : ''}
                      ${order.status === 'Costed & Approved' ? 'bg-blue-50 text-blue-700' : ''}
                      ${order.status === 'Materials Issued' ? 'bg-purple-50 text-purple-700' : ''}
                    `}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;