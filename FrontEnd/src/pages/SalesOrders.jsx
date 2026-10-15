import React, { useState, useEffect } from 'react';
import { Plus, Loader2, X, Calendar, User, Hash, FileText, Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://192.168.1.30:5003/api';

const STATUS_OPTIONS = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Costed & Approved',
  'Materials Issued',
  'Completed',
  'Rejected'
];

const SalesOrders = () => {
  const navigate = useNavigate();

  // Table state (server-side paged)
  const [orders, setOrders] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Master data
  const [workflows, setWorkflows] = useState([]);
  const [warehousesList, setWarehousesList] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [formData, setFormData] = useState({
    orderRef: '',
    buyerName: '',
    shipmentDate: '',
    workflowTemplate: '',
    warehouse: '',
    status: 'Pending Approval'
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load master data once
  const loadMasters = async () => {
    const [wfRes, custRes, whRes] = await Promise.all([
      axios.get(`${API_BASE}/workflows`).catch(() => ({ data: [] })),
      axios.get(`${API_BASE}/customers`).catch(() => ({ data: [] })),
      axios.get(`${API_BASE}/warehouses`).catch(() => ({ data: [] }))
    ]);
    setWorkflows(wfRes.data || []);
    setCustomersList(custRes.data || []);
    setWarehousesList(whRes.data || []);
  };

  useEffect(() => {
    loadMasters();
  }, []);

  // Debounce search input (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any filter change goes back to page 1
  useEffect(() => {
    setPage(1);
  }, [statusFilter, fromDate, toDate]);

  // Fetch one page from server
  const fetchOrders = async () => {
    setTableLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/sales-orders/paged`, {
        params: { page, search, status: statusFilter, from: fromDate, to: toDate }
      });
      setOrders(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error loading sales orders:', err);
      setOrders([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, search, statusFilter, fromDate, toDate]);

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
  };

  // Open create modal: order ID comes from the server
  const handleOpenCreateModal = async () => {
    let nextId = '';
    try {
      const { data } = await axios.get(`${API_BASE}/sales-orders/next-ref`);
      nextId = data.orderRef;
    } catch (err) {
      console.error('Could not get next order ref:', err);
      setMessage({ type: 'error', text: 'Could not generate Order ID. Check the server.' });
    }

    setFormData({
      orderRef: nextId,
      buyerName: '',
      shipmentDate: '',
      workflowTemplate: '',
      warehouse: warehousesList.length > 0
        ? (warehousesList[0].warehouseName || warehousesList[0].name || '')
        : '',
      status: 'Pending Approval'
    });
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setMessage({ type: '', text: '' });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.orderRef || !formData.buyerName || !formData.shipmentDate || !formData.workflowTemplate || !formData.warehouse) {
      setMessage({ type: 'error', text: 'Please fill all required fields, including Warehouse and Approval Workflow.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const payload = {
        orderRef: formData.orderRef.trim(),
        buyerName: formData.buyerName.trim(),
        shipmentDate: formData.shipmentDate,
        workflowTemplate: formData.workflowTemplate,
        warehouse: formData.warehouse,
        status: 'Pending Approval',
        items: []
      };

      const { data } = await axios.post(`${API_BASE}/sales-orders`, payload);

      setMessage({ type: 'success', text: 'Sales Order initialized successfully! Redirecting to grid...' });

      setTimeout(() => {
        setIsModalOpen(false);
        setMessage({ type: '', text: '' });
        navigate(`/sales-orders/${data._id}`);
      }, 1000);
    } catch (err) {
      console.error('Submit Error:', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save order. Make sure Order ID is unique.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending Approval':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'Approved':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'Costed & Approved':
        return 'bg-sky-50 border-sky-200 text-sky-700';
      case 'Materials Issued':
        return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Completed':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
      case 'Rejected':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d) ? '-' : d.toISOString().split('T')[0];
  };

  const filteredCustomers = customersList.filter(c =>
    c.customerName && c.customerName.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 relative animate-in fade-in duration-200">

      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Sales Orders Overview</h2>
          <p className="text-slate-400 text-xs mt-0.5">Track commercial garment orders, production readiness, and lifecycle statuses.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all cursor-pointer"
        >
          <Plus size={16} /> Create Sales Order
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order ID or customer name"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-10 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-10 focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            title="From date"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-10 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            title="To date"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm h-10 focus:outline-none"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={clearFilters}
            className="w-full h-10 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 text-sm"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {tableLoading ? (
          <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-800" size={18} /> Loading order pipelines...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic">No sales orders match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-6">Order ID</th>
                  <th className="py-4 px-6">Customer Name</th>
                  <th className="py-4 px-6">Order Date</th>
                  <th className="py-4 px-6">Delivery Date</th>
                  <th className="py-4 px-6 text-center">Items</th>
                  <th className="py-4 px-6">Total Value</th>
                  <th className="py-4 px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => navigate(`/sales-orders/${order._id}`)}
                    className="hover:bg-slate-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-emerald-950">{order.orderRef}</td>
                    <td className="py-4 px-6 text-slate-800">{order.buyerName}</td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(order.createdAt)}</td>
                    <td className="py-4 px-6 text-slate-500">{formatDate(order.shipmentDate)}</td>
                    <td className="py-4 px-6 text-center text-slate-800">{(order.totalQuantity || 0).toLocaleString()}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">LKR {(order.totalAmount || 0).toLocaleString()}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusStyle(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>{total.toLocaleString()} orders</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1 || tableLoading}
              className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || tableLoading}
              className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE SALES ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

            <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-emerald-800" /> Create New Sales Order
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-sm font-normal">
              {message.text && (
                <div className={`p-3 rounded-lg font-medium text-xs flex items-center gap-2 border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                  {message.text}
                </div>
              )}

              {/* Order ID (server generated, read only) */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Order ID / Ref * (Auto Generated)</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 text-slate-400" size={14} />
                  <input type="text" name="orderRef" readOnly required value={formData.orderRef} className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-emerald-900 cursor-not-allowed select-none h-11 text-sm" />
                </div>
              </div>

              {/* Customer autocomplete */}
              <div className="space-y-1 relative">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Customer / Buyer Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400" size={14} />
                  <input
                    type="text"
                    name="buyerName"
                    required
                    placeholder="Type first 2 letters to search... (e.g., El...)"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setFormData({ ...formData, buyerName: e.target.value });
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-slate-400 h-11 text-sm"
                  />
                </div>

                {showCustomerDropdown && customerSearch.trim().length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    {filteredCustomers.map((customer) => (
                      <div
                        key={customer._id}
                        onClick={() => {
                          setCustomerSearch(customer.customerName);
                          setFormData({ ...formData, buyerName: customer.customerName });
                          setShowCustomerDropdown(false);
                        }}
                        className="p-2.5 hover:bg-emerald-50 cursor-pointer flex flex-col transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          {customer.customerName}
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">Select</span>
                        </span>
                      </div>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <div className="p-3 text-center text-[11px] text-slate-400 italic">
                        No matching customers found. Type to use custom name.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Warehouse */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Default Warehouse / Store *</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3.5 text-slate-400" size={14} />
                  <select
                    name="warehouse"
                    required
                    value={formData.warehouse}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-11 text-sm"
                  >
                    <option value="">Select Warehouse</option>
                    {warehousesList.map((wh) => {
                      const whName = wh.warehouseName || wh.name || wh.code || wh._id;
                      return <option key={wh._id} value={whName}>{whName}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Workflow */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Attach Approval Workflow Template *</label>
                <select
                  name="workflowTemplate"
                  required
                  value={formData.workflowTemplate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-11 text-sm"
                >
                  <option value="">Select Sign-off Workflow Matrix</option>
                  {workflows.map(wf => <option key={wf._id} value={wf._id}>{wf.code}</option>)}
                </select>
              </div>

              {/* Delivery date */}
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Delivery Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-slate-400" size={14} />
                  <input
                    type="date"
                    name="shipmentDate"
                    required
                    value={formData.shipmentDate}
                    onChange={handleChange}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-slate-400 h-11 text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-all font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all font-medium cursor-pointer">
                  {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrders;