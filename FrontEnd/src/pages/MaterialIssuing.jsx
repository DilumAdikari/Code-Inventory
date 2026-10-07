import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const MaterialIssuing = () => {
  const [issuesList, setIssuesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const navigate = useNavigate();

  const [productionOrders, setProductionOrders] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualIssueForm, setManualIssueForm] = useState({
    salesOrderId: '',
    productionOrderId: '',
    workflowId: '',
    issueDate: new Date().toISOString().split('T')[0],
    items: []
  });
  const [poBOMItems, setPoBOMItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // ✅ current logged in user
  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const fetchIssues = async () => {
    try {
      const [response, poRes, wfRes] = await Promise.all([
        axios.get('http://192.168.1.30:5003/api/material-issues'),
        axios.get('http://192.168.1.30:5003/api/production-orders'),
        axios.get('http://192.168.1.30:5003/api/workflows')
      ]);
      setIssuesList(response.data);
      setProductionOrders(poRes.data);
      setWorkflows(wfRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error("❌ Failed to fetch:", err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchIssues(); }, []);

  const handleProductionOrderChange = async (poId) => {
    const selectedPO = productionOrders.find(po => po._id === poId);
    const soId = selectedPO?.salesOrder?._id || selectedPO?.salesOrder || '';
    setManualIssueForm(prev => ({ ...prev, productionOrderId: poId, salesOrderId: soId }));
    if (!poId) { setPoBOMItems([]); return; }
    try {
      const res = await axios.get(`http://192.168.1.30:5003/api/material-issues/production-order-bom/${poId}`);
      setPoBOMItems(res.data);
    } catch (err) {
      console.error("BOM load failed", err);
    }
  };

  const handleSaveManualIssue = async () => {
    if (!manualIssueForm.productionOrderId) {
      alert("Please select a Production Order.");
      return;
    }
    if (!manualIssueForm.workflowId) {
      alert("Please select an Approval Workflow.");
      return;
    }
    if (poBOMItems.length === 0) {
      alert("No BOM items found for this Production Order.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        salesOrderId: manualIssueForm.salesOrderId,
        productionOrderId: manualIssueForm.productionOrderId,
        workflowId: manualIssueForm.workflowId,
        items: poBOMItems,
        createdBy: currentUsername
      };
      await axios.post('http://192.168.1.30:5003/api/material-issues/manual-issue', payload);
      setIsManualModalOpen(false);
      setManualIssueForm({
        salesOrderId: '', productionOrderId: '', workflowId: '',
        issueDate: new Date().toISOString().split('T')[0], items: []
      });
      setPoBOMItems([]);
      fetchIssues();
      alert("Material Issue created successfully as Draft!");
    } catch (err) {
      alert("Save failed. Please check backend connection.");
    } finally {
      setSaving(false);
    }
  };

  // ✅ status display helper
  const getStatusDisplay = (status) => {
    if (status === 'ISSUED') return { label: 'Fully Issued', style: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={12} /> };
    if (status === 'Pending Approval') return { label: 'Pending Approval', style: 'bg-amber-50 text-amber-700 border-amber-200', icon: <AlertCircle size={12} /> };
    return { label: 'Draft / Pending', style: 'bg-slate-50 text-slate-600 border-slate-200', icon: <AlertCircle size={12} /> };
  };

  const filteredIssues = issuesList.filter(issue => {
    const matchesSearch =
      (issue.issueNo && issue.issueNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (issue.salesOrder?.orderRef && issue.salesOrder.orderRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (issue.items && issue.items.some(item => item.material?.materialName?.toLowerCase().includes(searchTerm.toLowerCase())));

    const statusDisplay = getStatusDisplay(issue.status).label;
    const matchesStatus = statusFilter === 'All' || statusDisplay === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading live stock issuing registry...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Material Issuing</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage raw materials issued from store based on approved production orders.</p>
        </div>
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all gap-2 cursor-pointer border-none"
        >
          <Plus size={18} /> Issue Materials
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Issue ID, Material or SO..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
          />
        </div>
        <div className="flex gap-2 self-start md:self-auto">
          {['All', 'Fully Issued', 'Pending Approval', 'Draft / Pending'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${statusFilter === f ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* LIST TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-4 px-6">Issue ID</th>
                <th className="p-4 px-6">Sales Order Ref</th>
                <th className="p-4 px-6">Production Order</th>
                <th className="p-4 px-6 text-center">Items</th>
                <th className="p-4 px-6">Warehouse</th>
                <th className="p-4 px-6">Workflow</th>
                <th className="p-4 px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredIssues.length > 0 ? filteredIssues.map((issue) => {
                const statusInfo = getStatusDisplay(issue.status);
                const issueIdLabel = issue.issueNo || `ISS-${issue._id?.slice(-6).toUpperCase()}`;
                return (
                  <tr
                    key={issue._id}
                    onClick={() => navigate(`/material-issuing/view/${issue._id}`)}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="p-4 px-6 text-sm font-bold text-slate-800 uppercase">{issueIdLabel}</td>
                    <td className="p-4 px-6">
                      <span className="text-sm font-semibold text-emerald-900 bg-emerald-50/60 rounded-lg px-2.5 py-1 uppercase">
                        {issue.salesOrder?.orderRef || 'SO-UNMAPPED'}
                      </span>
                    </td>
                    <td className="p-4 px-6 text-sm text-slate-800 font-semibold">
                      {issue.productionOrder?.productionOrderNo || 'PO-GEN'}
                    </td>
                    <td className="p-4 px-6 text-sm text-center font-bold text-slate-800">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-mono">
                        {issue.items?.length || 0} Items
                      </span>
                    </td>
                    <td className="p-4 px-6 text-sm text-slate-600">{issue.warehouse?.warehouseName || 'Main Store'}</td>
                    <td className="p-4 px-6 text-xs text-slate-500 font-mono">{issue.workflow?.code || 'N/A'}</td>
                    <td className="p-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.style}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400 italic">No material issuing records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ CREATE MODAL — with workflow selector */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">Manual Material Issue</h2>
              <button onClick={() => setIsManualModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={manualIssueForm.issueDate}
                    onChange={(e) => setManualIssueForm({ ...manualIssueForm, issueDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Production Order *</label>
                  <select
                    onChange={(e) => handleProductionOrderChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                  >
                    <option value="">-- Choose Production Order --</option>
                    {productionOrders
                      .filter(po => po.status === 'Completed' && po.bomItems && po.bomItems.length > 0)
                      .map(po => (
                        <option key={po._id} value={po._id}>
                          {po.productionOrderNo} {po.salesOrder?.orderRef ? `- ${po.salesOrder.orderRef}` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* ✅ Workflow selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Approval Workflow *</label>
                <select
                  value={manualIssueForm.workflowId}
                  onChange={(e) => setManualIssueForm({ ...manualIssueForm, workflowId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all font-semibold text-slate-800"
                >
                  <option value="">-- Select Approval Workflow --</option>
                  {workflows.map(w => (
                    <option key={w._id} value={w._id}>{w.code || w.name}</option>
                  ))}
                </select>
              </div>

              {/* BOM Items preview */}
              {poBOMItems.length > 0 && (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">BOM Items to Issue ({poBOMItems.length} items)</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white border-b border-slate-100 text-xs font-semibold text-slate-400 sticky top-0">
                        <tr>
                          <th className="p-3 px-4">Material</th>
                          <th className="p-3 px-4">Color</th>
                          <th className="p-3 px-4 text-right">Required Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700 font-medium bg-white">
                        {poBOMItems.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="p-3 px-4">{item.materialName || item.material?.materialName || 'Material'}</td>
                            <td className="p-3 px-4">{item.colorName || item.color?.colorName || 'Default'}</td>
                            <td className="p-3 px-4 text-right text-emerald-700 font-bold">
                              {Number(item.requiredQty || item.shortageQty || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {manualIssueForm.productionOrderId && poBOMItems.length === 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
                  ⚠️ No BOM items found for this Production Order. Please generate BOM first from the Production Orders module.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-200 transition-all cursor-pointer border-none"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualIssue}
                  disabled={saving || !manualIssueForm.productionOrderId || !manualIssueForm.workflowId || poBOMItems.length === 0}
                  className="px-4 py-2.5 bg-emerald-900 text-white font-semibold rounded-xl text-sm hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none"
                >
                  {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save as Draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MaterialIssuing;