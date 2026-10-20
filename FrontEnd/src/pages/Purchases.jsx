import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Search, ShoppingCart, Eye, X, Save, Printer, Send } from 'lucide-react';
import { API_URL } from "../api/config";   

const Purchases = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedPO, setSelectedPO] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [editSupplier, setEditSupplier] = useState('');
  const [editWorkflowId, setEditWorkflowId] = useState('');
  const [saving, setSaving] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  
  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const [poRes, supRes, wfRes] = await Promise.all([
        axios.get(`${API_URL}/purchases`),
        axios.get(`${API_URL}/suppliers`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/workflows`).catch(() => ({ data: [] }))
      ]);
      setPurchaseOrders(poRes.data || []);

      const supData = supRes.data;
      const parsedSuppliers = Array.isArray(supData) ? supData : (supData.data || supData.suppliers || []);
      setSuppliers(parsedSuppliers);
      setWorkflows(wfRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error("❌ Error loading purchase orders:", err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchaseOrders(); }, []);

  const handleOpenRowClick = (po) => {
    setSelectedPO(po);
    setEditSupplier(po.supplierName || '');
    setEditWorkflowId(po.workflowId?._id || po.workflowId || '');
    setEditItems(po.items ? po.items.map(i => ({ ...i })) : []);
    setIsModalOpen(true);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...editItems];
    updated[index][field] = Number(value) || 0;
    setEditItems(updated);
  };

  
  const handleSavePO = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;

    try {
      setSaving(true);

      const totalAmount = editItems.reduce((sum, i) =>
        sum + (Number(i.orderedQty || 0) * Number(i.unitPrice || 0)), 0);

      const payload = {
        supplierName: editSupplier,
        items: editItems,
        totalAmount,
        remarks: selectedPO.remarks || '',
        
        status: 'Draft'
      };

      const res = await axios.put(
        `${API_URL}/purchases/${selectedPO._id}/update`,
        payload
      );

      alert("Purchase Order saved successfully!");

      const updatedOrder = res.data;
      setSelectedPO(updatedOrder);
      setPurchaseOrders(prev =>
        prev.map(po => po._id === updatedOrder._id ? updatedOrder : po)
      );

      fetchPurchaseOrders();
    } catch (err) {
      console.error("❌ Error saving purchase order:", err);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  
  const handleSubmitForApproval = async () => {
    if (!selectedPO) return;

    if (!editWorkflowId) {
      alert("Please select a Workflow before submitting for approval.");
      return;
    }

    if (!window.confirm("Submit this Purchase Order for approval?")) return;

    try {
      setSubmittingApproval(true);

      
      const totalAmount = editItems.reduce((sum, i) =>
        sum + (Number(i.orderedQty || 0) * Number(i.unitPrice || 0)), 0);

      await axios.put(`${API_URL}/purchases/${selectedPO._id}/update`, {
        supplierName: editSupplier,
        items: editItems,
        totalAmount,
        remarks: selectedPO.remarks || '',
        status: 'Draft'
      });

      // then submit for approval
      const res = await axios.post(
        `${API_URL}/purchases/submit-approval/${selectedPO._id}`,
        { createdBy: currentUsername, workflowId: editWorkflowId }
      );

      alert("Purchase Order submitted for approval! The assigned approver will be notified.");

      setSelectedPO(prev => ({ ...prev, status: 'Pending Approval' }));
      setPurchaseOrders(prev =>
        prev.map(po => po._id === selectedPO._id ? { ...po, status: 'Pending Approval' } : po)
      );

      setIsModalOpen(false);
      fetchPurchaseOrders();
    } catch (err) {
      console.error("❌ Submit approval failed:", err);
      alert(err.response?.data?.message || "Failed to submit for approval.");
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleCancelOrder = async (poId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    try {
      const res = await axios.put(
        `${API_URL}/purchases/${poId}/status`,
        { status: 'Cancelled' }
      );
      alert("Purchase order cancelled successfully!");
      setSelectedPO(res.data);
      fetchPurchaseOrders();
    } catch (err) {
      console.error("❌ Failed to cancel order:", err);
      alert("Failed to cancel purchase order.");
    }
  };

  const handlePrintPO = () => { window.print(); };

  const filteredPOs = purchaseOrders.filter(po =>
    (po.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (po.purchaseOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  
  const getStatusStyle = (status) => {
    if (status === 'Approved' || status === 'Received') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Pending Approval') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (status === 'Draft') return 'bg-slate-50 text-slate-600 border-slate-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

  if (loading) {
    return (
      <div className="p-12 text-base flex items-center justify-center gap-2 text-slate-500 font-sans tracking-wide">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading procurement registry...
      </div>
    );
  }

  const isApproved = selectedPO && (selectedPO.status === 'Approved' || selectedPO.status === 'Received');
  const isCancelled = selectedPO && selectedPO.status === 'Cancelled';
  const isPendingApproval = selectedPO && selectedPO.status === 'Pending Approval';
  
  const isLocked = isApproved || isCancelled || isPendingApproval;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm font-normal text-slate-700 font-sans tracking-wide">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 w-full bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-emerald-800" size={22} /> Purchasing & Procurement Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage material purchase orders. Click any row to view details, edit items, and complete.</p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center w-full">
        <div className="relative w-full max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"><Search size={18} /></span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by supplier name or PO number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:border-slate-400 transition-all"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full">
        {filteredPOs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic">No purchase orders found in registry.</div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-normal tracking-wider text-xs uppercase">
                  <th className="p-4 px-6">PO Ref</th>
                  <th className="p-4">Supplier Name</th>
                  <th className="p-4">Order Date</th>
                  <th className="p-4">Expected Delivery</th>
                  <th className="p-4">Items</th>
                  <th className="p-4 text-right">Total (LKR)</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPOs.map((po) => {
                  const totalAmt = po.items?.reduce((sum, i) =>
                    sum + (Number(i.orderedQty || 0) * Number(i.unitPrice || 0)), 0) || po.totalAmount || 0;

                  return (
                    <tr
                      key={po._id}
                      onClick={() => handleOpenRowClick(po)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="p-4 px-6 font-mono text-xs text-slate-900 font-bold">
                        {po.purchaseOrderNo || `PR-${po._id.slice(-5).toUpperCase()}`}
                      </td>
                      <td className="p-4 font-medium text-slate-900">{po.supplierName}</td>
                      <td className="p-4 text-slate-500">{new Date(po.orderDate).toISOString().split('T')[0]}</td>
                      <td className="p-4 text-slate-500">
                        {po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().split('T')[0] : 'N/A'}
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">{po.items?.length || 0} Items</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">
                        LKR {totalAmt.toLocaleString()}
                      </td>
                      <td className="p-4 text-center">
                        
                        <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${getStatusStyle(po.status)}`}>
                          {po.status || 'Draft'}
                        </span>
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenRowClick(po)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-all cursor-pointer flex items-center gap-1 border-none font-medium mx-auto"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {isModalOpen && selectedPO && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-slate-500" />
                Purchase Order — {selectedPO.purchaseOrderNo || selectedPO._id.slice(-6).toUpperCase()}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSavePO} className="p-6 space-y-5 overflow-y-auto">

              <div className="grid grid-cols-2 gap-4">
                {/* Supplier */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Supplier Name</label>
                  <select
                    value={editSupplier}
                    disabled={isLocked}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-medium"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => {
                      const supName = s.supplierName || s.name || s.companyName;
                      return (
                        <option key={s._id} value={supName}>
                          {supName} {s.supplierCode ? `(${s.supplierCode})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">
                    Approval Workflow *
                  </label>
                  {isLocked ? (
                    <div className="px-3.5 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
                      <span className={`font-bold ${
                        isCancelled ? 'text-rose-700' :
                        isPendingApproval ? 'text-amber-700' :
                        isApproved ? 'text-emerald-800' : 'text-slate-700'
                      }`}>
                        {selectedPO.status}
                      </span>
                      <span className="text-[11px] text-slate-400 italic ml-2">Locked</span>
                    </div>
                  ) : (
                    <select
                      value={editWorkflowId}
                      onChange={(e) => setEditWorkflowId(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none font-medium"
                    >
                      <option value="">Select Approval Workflow</option>
                      {workflows.map(w => (
                        <option key={w._id} value={w._id}>{w.code || w.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase">Shortage Items & Pricing Matrix</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
                        <th className="p-3">Material Name</th>
                        <th className="p-3">Shade</th>
                        <th className="p-3 text-center">UOM</th>
                        <th className="p-3 text-right">Ordered Qty</th>
                        <th className="p-3 text-right">Unit Price (LKR)</th>
                        <th className="p-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.map((item, idx) => {
                        const subtotal = Number(item.orderedQty || 0) * Number(item.unitPrice || 0);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-900">
                              {item.materialName} <span className="text-xs text-slate-400 font-mono">({item.itemCode})</span>
                            </td>
                            <td className="p-3 text-slate-600">{item.colorName || 'Standard'}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{item.uom}</td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                value={item.orderedQty}
                                disabled={isLocked}
                                onChange={(e) => handleItemChange(idx, 'orderedQty', e.target.value)}
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                              />
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                value={item.unitPrice}
                                disabled={isLocked}
                                onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                                placeholder="0.00"
                                className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                              />
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-slate-900">
                              {subtotal.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end pt-2 border-t border-slate-100 text-base font-semibold text-slate-900">
                Total PO Amount:
                <span className="font-mono text-emerald-800 ml-3">
                  LKR {editItems.reduce((sum, i) =>
                    sum + (Number(i.orderedQty || 0) * Number(i.unitPrice || 0)), 0).toLocaleString()}
                </span>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                {/* Left side */}
                {isApproved ? (
                  <button
                    type="button"
                    onClick={handlePrintPO}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold cursor-pointer border border-indigo-200 flex items-center gap-1.5"
                  >
                    <Printer size={14} /> Print Purchase Order
                  </button>
                ) : isCancelled ? (
                  <span className="text-xs text-rose-600 font-semibold italic">This order is cancelled and locked.</span>
                ) : isPendingApproval ? (
                  <span className="text-xs text-amber-600 font-semibold italic">
                    ⏳ Awaiting approval. Sheet is locked.
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(selectedPO._id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer border border-rose-200"
                  >
                    Cancel Order
                  </button>
                )}

                {/* Right side */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-normal border-none cursor-pointer text-sm"
                  >
                    Close
                  </button>

                  
                  {!isLocked && (
                    <>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-normal flex items-center gap-2 border-none cursor-pointer text-sm"
                      >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={14} /> Save Draft</>}
                      </button>

                      <button
                        type="button"
                        disabled={submittingApproval}
                        onClick={handleSubmitForApproval}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-normal flex items-center gap-2 border-none cursor-pointer text-sm shadow-sm disabled:opacity-60"
                      >
                        {submittingApproval
                          ? <Loader2 className="animate-spin" size={16} />
                          : <><Send size={14} /> Submit for Approval</>
                        }
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Purchases;