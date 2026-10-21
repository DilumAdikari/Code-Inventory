import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Search, ShoppingCart, Eye, X, Save, Printer, Send, Plus, Trash2 } from 'lucide-react';
import { API_URL } from '../api/config';
import { confirmDialog } from '../components/AppDialog';


const getId = (v) => (v && typeof v === 'object' ? String(v._id ?? '') : String(v ?? ''));
const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  return d?.data || d?.suppliers || [];
};
const num = (v) => Number(v) || 0;


const toLocalDay = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const todayStr = () => toLocalDay(new Date());

const uomLabel = (u) => (u && typeof u === 'object' ? u.abbreviation || u.uomCode || '' : u || '');

const blankLine = () => ({
  materialId: '', materialName: '', itemCode: '',
  colorId: null, colorName: '', sizeId: null, sizeName: '',
  uom: '', orderedQty: '', unitPrice: '',
});


const variantOptionsOf = (mat, key, list) => {
  if (!mat) return [];
  const ids = (mat[key] || []).map(getId);
  return list.filter((x) => ids.includes(String(x._id)));
};

const Purchases = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // true = new PO, false = existing PO
  const [selectedPO, setSelectedPO] = useState(null);
  const [editSupplier, setEditSupplier] = useState('');
  const [editWorkflowId, setEditWorkflowId] = useState('');
  const [editOrderDate, setEditOrderDate] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const materialById = useMemo(() => new Map(materials.map((m) => [String(m._id), m])), [materials]);
  const colorById = useMemo(() => new Map(colors.map((c) => [String(c._id), c])), [colors]);
  const sizeById = useMemo(() => new Map(sizes.map((s) => [String(s._id), s])), [sizes]);

  const fetchPurchaseOrders = async () => {
    try {
      const [poRes, supRes, wfRes] = await Promise.all([
        axios.get(`${API_URL}/purchases`),
        axios.get(`${API_URL}/suppliers`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/workflows`).catch(() => ({ data: [] })),
      ]);
      const list = asArray(poRes);
      setPurchaseOrders(list);
      setSuppliers(asArray(supRes));
      setWorkflows(asArray(wfRes));
      return list;
    } catch (err) {
      console.error('Error loading purchase orders:', err);
      return [];
    }
  };

  const loadMasters = async () => {
    const safe = (url) => axios.get(url).catch(() => ({ data: [] }));
    const [matRes, colRes, sizeRes] = await Promise.all([
      safe(`${API_URL}/materials`),
      safe(`${API_URL}/colors`),
      safe(`${API_URL}/sizes`),
    ]);
    setMaterials(asArray(matRes));
    setColors(asArray(colRes));
    setSizes(asArray(sizeRes));
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPurchaseOrders(), loadMasters()]);
      setLoading(false);
    };
    init();
  }, []);

  // ---------- OPEN / CLOSE ----------

  const openCreate = () => {
    setSelectedPO(null);
    setIsCreating(true);
    setEditSupplier('');
    setEditWorkflowId('');
    setEditOrderDate(todayStr());
    setEditExpectedDate('');
    setEditRemarks('');
    setEditItems([blankLine()]);
    setIsModalOpen(true);
  };

  const openEdit = (po) => {
    setSelectedPO(po);
    setIsCreating(false);
    setEditSupplier(po.supplierName || '');
    setEditWorkflowId(po.workflowId?._id || po.workflowId || '');
    setEditOrderDate(toLocalDay(po.orderDate));
    setEditExpectedDate(toLocalDay(po.expectedDeliveryDate));
    setEditRemarks(po.remarks || '');
    setEditItems(
      (po.items || []).map((i) => ({
        ...blankLine(),
        ...i,
        materialId: getId(i.materialId ?? i.material),
        colorId: getId(i.colorId ?? i.color) || null,
        sizeId: getId(i.sizeId ?? i.size) || null,
        orderedQty: i.orderedQty ?? '',
        unitPrice: i.unitPrice ?? '',
      }))
    );
    setIsModalOpen(true);
  };

  // ---------- LINE EDITING ----------

  const updateLine = (idx, patch) =>
    setEditItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const addLine = () => setEditItems((prev) => [...prev, blankLine()]);

  const removeLine = (idx) => setEditItems((prev) => prev.filter((_, i) => i !== idx));

  const handleMaterialChange = (idx, materialId) => {
    const m = materialById.get(String(materialId));
    updateLine(idx, {
      materialId,
      materialName: m ? m.materialName || m.itemName || '' : '',
      itemCode: m ? m.materialCode || m.itemCode || '' : '',
      uom: m ? uomLabel(m.uom) : '',
      colorId: null,
      colorName: '',
      sizeId: null,
      sizeName: '',
    });
  };

  const handleColorChange = (idx, colorId) => {
    const c = colorById.get(String(colorId));
    updateLine(idx, { colorId: colorId || null, colorName: c ? c.colorName || c.name || '' : '' });
  };

  const handleSizeChange = (idx, sizeId) => {
    const s = sizeById.get(String(sizeId));
    updateLine(idx, {
      sizeId: sizeId || null,
      sizeName: s ? s.sizeCode || s.sizeDescription || s.name || '' : '',
    });
  };

  const grandTotal = editItems.reduce((sum, i) => sum + num(i.orderedQty) * num(i.unitPrice), 0);

  // ---------- SAVE / SUBMIT ----------

  const validateForm = (requireWorkflow) => {
    if (!editSupplier) return 'Please select a supplier.';
    if (requireWorkflow && !editWorkflowId) return 'Please select a Workflow before submitting for approval.';
    if (editItems.length === 0) return 'Add at least one line.';
    for (let idx = 0; idx < editItems.length; idx++) {
      const item = editItems[idx];
      const n = idx + 1;
      if (!item.materialId) return `Line ${n}: select a material.`;
      const mat = materialById.get(String(item.materialId));
      if (mat && (mat.colors || []).length > 0 && !item.colorId) return `Line ${n}: select a colour.`;
      if (mat && (mat.sizes || []).length > 0 && !item.sizeId) return `Line ${n}: select a size.`;
      if (num(item.orderedQty) <= 0) return `Line ${n}: quantity must be more than 0.`;
      if (num(item.unitPrice) < 0) return `Line ${n}: unit price cannot be negative.`;
    }
    return '';
  };

  const buildPayload = () => {
    const items = editItems.map((i) => ({
      materialId: i.materialId,
      materialName: i.materialName,
      itemCode: i.itemCode,
      colorId: i.colorId || null,
      colorName: i.colorName || '',
      sizeId: i.sizeId || null,
      sizeName: i.sizeName || '',
      uom: i.uom || '',
      orderedQty: num(i.orderedQty),
      unitPrice: num(i.unitPrice),
    }));
    return {
      supplierName: editSupplier,
      workflowId: editWorkflowId || null,
      orderDate: editOrderDate || todayStr(),
      expectedDeliveryDate: editExpectedDate || null,
      items,
      totalAmount: items.reduce((s, i) => s + i.orderedQty * i.unitPrice, 0),
      remarks: editRemarks,
      status: 'Draft',
    };
  };

  
  const persistDraft = async () => {
    const payload = buildPayload();
    if (isCreating) {
      const res = await axios.post(`${API_URL}/purchases`, payload);
      return res.data;
    }
    const res = await axios.put(`${API_URL}/purchases/${selectedPO._id}/update`, payload);
    return res.data;
  };

  const handleSaveDraft = async () => {
    const msg = validateForm(false);
    if (msg) {
      alert(msg);
      return;
    }
    try {
      setSaving(true);
      const saved = await persistDraft();
      const id = saved?._id || selectedPO?._id;
      alert('Purchase Order saved successfully!');

      
      const list = await fetchPurchaseOrders();
      const fresh = list.find((p) => String(p._id) === String(id));
      if (fresh) openEdit(fresh);
    } catch (err) {
      console.error('Error saving purchase order:', err);
      alert(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    const msg = validateForm(true);
    if (msg) {
      alert(msg);
      return;
    }
    if (!(await confirmDialog('Submit this Purchase Order for approval?'))) return;

    const wasCreating = isCreating;
    let id = selectedPO?._id || null;
    try {
      setSubmittingApproval(true);
      const saved = await persistDraft();
      id = saved?._id || id;

      await axios.post(`${API_URL}/purchases/submit-approval/${id}`, {
        createdBy: currentUsername,
        workflowId: editWorkflowId,
      });

      alert('Purchase Order submitted for approval! The assigned approver will be notified.');
      setIsModalOpen(false);
      fetchPurchaseOrders();
    } catch (err) {
      console.error('Submit approval failed:', err);
      const serverMsg = err.response?.data?.message || 'Failed to submit for approval.';
      alert(wasCreating && id ? `${serverMsg} The draft has been saved.` : serverMsg);

      
      const list = await fetchPurchaseOrders();
      if (wasCreating && id) {
        const fresh = list.find((p) => String(p._id) === String(id));
        if (fresh) openEdit(fresh);
      }
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleCancelOrder = async (poId) => {
    if (!(await confirmDialog('Are you sure you want to cancel this order?'))) return;
    try {
      const res = await axios.put(`${API_URL}/purchases/${poId}/status`, { status: 'Cancelled' });
      alert('Purchase order cancelled successfully!');
      setSelectedPO(res.data);
      fetchPurchaseOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err);
      alert('Failed to cancel purchase order.');
    }
  };

  const handlePrintPO = () => {
    window.print();
  };

  // ---------- LIST ----------

  const filteredPOs = purchaseOrders.filter(
    (po) =>
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

  const isApproved = !isCreating && !!selectedPO && (selectedPO.status === 'Approved' || selectedPO.status === 'Received');
  const isCancelled = !isCreating && !!selectedPO && selectedPO.status === 'Cancelled';
  const isPendingApproval = !isCreating && !!selectedPO && selectedPO.status === 'Pending Approval';
  const isLocked = isApproved || isCancelled || isPendingApproval;

  const inputCls =
    'w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm font-normal text-slate-700 font-sans tracking-wide">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-emerald-800" size={22} /> Purchasing & Procurement Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage material purchase orders. Click any row to view details, edit items, and complete.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-sm font-medium shadow-sm cursor-pointer"
        >
          <Plus size={16} /> New Purchase Order
        </button>
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
                  const totalAmt =
                    po.items?.reduce((sum, i) => sum + num(i.orderedQty) * num(i.unitPrice), 0) || po.totalAmount || 0;

                  return (
                    <tr
                      key={po._id}
                      onClick={() => openEdit(po)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="p-4 px-6 font-mono text-xs text-slate-900 font-bold">
                        {po.purchaseOrderNo || `PR-${String(po._id).slice(-5).toUpperCase()}`}
                      </td>
                      <td className="p-4 font-medium text-slate-900">{po.supplierName}</td>
                      <td className="p-4 text-slate-500">{toLocalDay(po.orderDate) || '-'}</td>
                      <td className="p-4 text-slate-500">{toLocalDay(po.expectedDeliveryDate) || 'N/A'}</td>
                      <td className="p-4 text-slate-700 font-semibold">{po.items?.length || 0} Items</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">LKR {totalAmt.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${getStatusStyle(po.status)}`}>
                          {po.status || 'Draft'}
                        </span>
                      </td>
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEdit(po)}
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
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl rounded-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-slate-500" />
                {isCreating
                  ? 'New Purchase Order'
                  : `Purchase Order — ${selectedPO?.purchaseOrderNo || String(selectedPO?._id || '').slice(-6).toUpperCase()}`}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">

              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Supplier Name *</label>
                  <select
                    value={editSupplier}
                    disabled={isLocked}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-medium"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => {
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
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Approval Workflow *</label>
                  {isLocked ? (
                    <div className="px-3.5 py-2 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
                      <span
                        className={`font-bold ${
                          isCancelled ? 'text-rose-700' : isPendingApproval ? 'text-amber-700' : 'text-emerald-800'
                        }`}
                      >
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
                      {workflows.map((w) => (
                        <option key={w._id} value={w._id}>{w.code || w.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Order Date</label>
                  <input
                    type="date"
                    value={editOrderDate}
                    disabled={isLocked}
                    onChange={(e) => setEditOrderDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Expected Delivery</label>
                  <input
                    type="date"
                    value={editExpectedDate}
                    disabled={isLocked}
                    onChange={(e) => setEditExpectedDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Remarks</label>
                  <input
                    type="text"
                    value={editRemarks}
                    disabled={isLocked}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">Purchase Lines</label>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={addLine}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1 border-none cursor-pointer"
                    >
                      <Plus size={12} /> Add Line
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[860px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 uppercase">
                        <th className="p-3">Material</th>
                        <th className="p-3">Colour</th>
                        <th className="p-3">Size</th>
                        <th className="p-3 text-center">UOM</th>
                        <th className="p-3 text-right">Ordered Qty</th>
                        <th className="p-3 text-right">Unit Price (LKR)</th>
                        <th className="p-3 text-right">Subtotal</th>
                        <th className="p-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-slate-400 italic">No lines yet.</td>
                        </tr>
                      )}

                      {editItems.map((item, idx) => {
                        const mat = materialById.get(String(item.materialId));
                        const colorOpts = variantOptionsOf(mat, 'colors', colors);
                        const sizeOpts = variantOptionsOf(mat, 'sizes', sizes);
                        const hasColors = !!mat && (mat.colors || []).length > 0;
                        const hasSizes = !!mat && (mat.sizes || []).length > 0;
                        const subtotal = num(item.orderedQty) * num(item.unitPrice);

                        return (
                          <tr key={idx} className="hover:bg-slate-50 align-top">
                            {/* Material */}
                            <td className="p-2 min-w-[220px]">
                              <select
                                value={item.materialId || ''}
                                disabled={isLocked}
                                onChange={(e) => handleMaterialChange(idx, e.target.value)}
                                className={inputCls}
                              >
                                <option value="">
                                  {item.materialName ? `${item.materialName} (${item.itemCode || '-'})` : 'Select material'}
                                </option>
                                {materials.map((m) => (
                                  <option key={m._id} value={m._id}>
                                    [{m.materialCode || m.itemCode}] {m.materialName || m.itemName}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Colour */}
                            <td className="p-2 min-w-[130px]">
                              {!mat ? (
                                <span className="text-xs text-slate-500">{item.colorName || '—'}</span>
                              ) : hasColors ? (
                                <select
                                  value={item.colorId || ''}
                                  disabled={isLocked}
                                  onChange={(e) => handleColorChange(idx, e.target.value)}
                                  className={inputCls}
                                >
                                  <option value="">Select colour</option>
                                  {colorOpts.map((c) => (
                                    <option key={c._id} value={c._id}>{c.colorName || c.name}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No colour (N/A)</span>
                              )}
                            </td>

                            {/* Size */}
                            <td className="p-2 min-w-[120px]">
                              {!mat ? (
                                <span className="text-xs text-slate-500">{item.sizeName || '—'}</span>
                              ) : hasSizes ? (
                                <select
                                  value={item.sizeId || ''}
                                  disabled={isLocked}
                                  onChange={(e) => handleSizeChange(idx, e.target.value)}
                                  className={inputCls}
                                >
                                  <option value="">Select size</option>
                                  {sizeOpts.map((s) => (
                                    <option key={s._id} value={s._id}>
                                      {s.sizeCode || s.sizeDescription || s.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-xs text-slate-400 italic">No size (N/A)</span>
                              )}
                            </td>

                            {/* UOM */}
                            <td className="p-2 text-center font-mono text-slate-500 pt-4">{item.uom || '-'}</td>

                            {/* Qty */}
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.orderedQty}
                                disabled={isLocked}
                                onChange={(e) => updateLine(idx, { orderedQty: e.target.value })}
                                className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right font-mono text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                              />
                            </td>

                            {/* Price */}
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min="0"
                                value={item.unitPrice}
                                disabled={isLocked}
                                placeholder="0.00"
                                onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                                className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right font-mono text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                              />
                            </td>

                            {/* Subtotal */}
                            <td className="p-2 text-right font-mono font-semibold text-slate-900 pt-4">
                              {subtotal.toLocaleString()}
                            </td>

                            {/* Remove */}
                            <td className="p-2 text-center pt-3">
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  title="Remove line"
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded border-none bg-transparent cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
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
                <span className="font-mono text-emerald-800 ml-3">LKR {grandTotal.toLocaleString()}</span>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
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
                  <span className="text-xs text-amber-600 font-semibold italic">⏳ Awaiting approval. Sheet is locked.</span>
                ) : !isCreating && selectedPO ? (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(selectedPO._id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer border border-rose-200"
                  >
                    Cancel Order
                  </button>
                ) : (
                  <span />
                )}

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
                        type="button"
                        disabled={saving || submittingApproval}
                        onClick={handleSaveDraft}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-normal flex items-center gap-2 border-none cursor-pointer text-sm disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={14} /> Save Draft</>}
                      </button>

                      <button
                        type="button"
                        disabled={saving || submittingApproval}
                        onClick={handleSubmitForApproval}
                        className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-normal flex items-center gap-2 border-none cursor-pointer text-sm shadow-sm disabled:opacity-60"
                      >
                        {submittingApproval ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <><Send size={14} /> Submit for Approval</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
