import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Search, ShoppingCart, Save, Printer, Send, Plus, Trash2, ArrowLeft, ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { API_URL } from '../api/config';
import { confirmDialog } from '../components/AppDialog';

// Rows per page on the purchase order list
const PO_PAGE_SIZE = 15;

// Status choices for the list filter
const PO_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Received', label: 'Received' },
  { value: 'Cancelled', label: 'Cancelled' },
];

// Populate වෙලා object එකක් ආවත්, ID string එකක් ආවත් ID එක ගන්න
const getId = (v) => (v && typeof v === 'object' ? String(v._id ?? '') : String(v ?? ''));
const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  return d?.data || d?.suppliers || [];
};
const num = (v) => Number(v) || 0;

// Supplier එකේ නම (DB field names කිහිපයක් check කරනවා)
const supplierLabel = (s) =>
  String(s?.supplierName || s?.name || s?.supplier_name || s?.companyName || '').trim();

// Local (Sri Lanka) දවස YYYY-MM-DD ලෙස
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

// Material එකට තියෙන colour / size විතරක් dropdown එකට
const variantOptionsOf = (mat, key, list) => {
  if (!mat) return [];
  const ids = (mat[key] || []).map(getId);
  return list.filter((x) => ids.includes(String(x._id)));
};

const getStatusStyle = (status) => {
  if (status === 'Approved' || status === 'Received') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (status === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700';
  if (status === 'Cancelled') return 'bg-rose-50 border-rose-200 text-rose-700';
  return 'bg-slate-100 border-slate-200 text-slate-600';
};

const Purchases = () => {
  // Route: /purchases (list), /purchases/new (create), /purchases/:id (detail)
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const isOnDetail = !!routeId;
  const isCreating = routeId === 'new';

  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  // List filters and paging
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [selectedPO, setSelectedPO] = useState(null);
  const [editSupplier, setEditSupplier] = useState('');
  const [editWorkflowId, setEditWorkflowId] = useState('');
  const [editOrderDate, setEditOrderDate] = useState('');
  const [editExpectedDate, setEditExpectedDate] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Purchase Order popup form
  const [showCreate, setShowCreate] = useState(false);
  const [newSupplier, setNewSupplier] = useState('');
  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Supplier names from the database (de-duplicated, sorted) for the search dropdown
  const supplierNames = useMemo(
    () => [...new Set(suppliers.map(supplierLabel).filter(Boolean))].sort(),
    [suppliers]
  );
  const supplierOptions = useMemo(() => {
    const q = newSupplier.trim().toLowerCase();
    return supplierNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 50);
  }, [supplierNames, newSupplier]);

  // Next PO number preview (server still assigns the final number on save)
  const nextPoPreview = useMemo(() => {
    let max = 0;
    purchaseOrders.forEach((p) => {
      const m = String(p.purchaseOrderNo || '').match(/PR-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `PR-${String(max + 1).padStart(5, '0')}`;
  }, [purchaseOrders]);
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const materialById = useMemo(() => new Map(materials.map((m) => [String(m._id), m])), [materials]);
  const colorById = useMemo(() => new Map(colors.map((c) => [String(c._id), c])), [colors]);
  const sizeById = useMemo(() => new Map(sizes.map((s) => [String(s._id), s])), [sizes]);

  const fetchPurchaseOrders = async () => {
    try {
      const [poRes, supRes, wfRes] = await Promise.all([
        axios.get(`${API_URL}/purchases`),
        axios.get(`${API_URL}/suppliers`).catch((err) => {
          console.error('Suppliers load failed:', err);
          return { data: [] };
        }),
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

  // ---------- FORM STATE ----------

  const initCreate = () => {
    setSelectedPO(null);
    setEditSupplier('');
    setEditWorkflowId('');
    setEditOrderDate(todayStr());
    setEditExpectedDate('');
    setEditRemarks('');
    setEditItems([blankLine()]);
  };

  const loadForm = (po) => {
    setSelectedPO(po);
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
  };

  // Fills the form from the URL: new PO for /new, saved PO for /:id.
  // Runs again after every list refresh so the form always shows the saved data.
  useEffect(() => {
    if (loading || !routeId) return;
    if (routeId === 'new') {
      initCreate();
      return;
    }
    const po = purchaseOrders.find((p) => String(p._id) === String(routeId));
    if (po) loadForm(po);
  }, [routeId, loading, purchaseOrders]);

  // ---------- NAVIGATION ----------

  const goToList = () => navigate('/purchases');
  // New PO: draft එක server එකේ එකවරම create කරලා ඒ PO එකේ page එකට යනවා
  // New PO: popup form එක open කරනවා
  const openCreate = () => {
    setNewSupplier('');
    setNewWorkflowId('');
    setNewDeliveryDate('');
    setNewRemarks('');
    setShowCreate(true);
  };

  // Form එක save කළාම PO එක create කරලා ඒ PO එකේ page එකට යනවා
  const handleCreatePO = async () => {
    if (creating) return;
    if (!newSupplier.trim()) return alert('Please select a supplier.');
    if (!newWorkflowId) return alert('Please select a workflow.');
    if (!newDeliveryDate) return alert('Please select a delivery date.');
    try {
      setCreating(true);
      const res = await axios.post(`${API_URL}/purchases/create`, {
        supplierName: newSupplier.trim(),
        expectedDeliveryDate: newDeliveryDate,
        items: [],
        remarks: newRemarks,
        workflowId: newWorkflowId,
        createdBy: currentUsername,
      });
      const id = res.data?._id;
      if (!id) throw new Error('No purchase order id returned');
      setShowCreate(false);
      await fetchPurchaseOrders();
      navigate(`/purchases/${id}`);
    } catch (err) {
      console.error('Error creating purchase order:', err);
      alert(err.response?.data?.message || 'Failed to create purchase order.');
    } finally {
      setCreating(false);
    }
  };
  const openPO = (po) => navigate(`/purchases/${po._id}`);

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

  // Create නම් POST, තියෙන PO එකක් නම් PUT
  const persistDraft = async () => {
    const payload = buildPayload();
    if (isCreating) {
      const res = await axios.post(`${API_URL}/purchases/create`, payload);
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

      // Refresh first, then move a new PO from /new to its own /:id URL
      await fetchPurchaseOrders();
      if (id && String(routeId) !== String(id)) {
        navigate(`/purchases/${id}`, { replace: true });
      }
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
      await fetchPurchaseOrders();
      if (id && String(routeId) !== String(id)) {
        navigate(`/purchases/${id}`, { replace: true });
      }
    } catch (err) {
      console.error('Submit approval failed:', err);
      const serverMsg = err.response?.data?.message || 'Failed to submit for approval.';
      alert(wasCreating && id ? `${serverMsg} The draft has been saved.` : serverMsg);

      await fetchPurchaseOrders();
      // Draft created but submit failed: open the saved draft so a retry does not create a second one
      if (wasCreating && id) {
        navigate(`/purchases/${id}`, { replace: true });
      }
    } finally {
      setSubmittingApproval(false);
    }
  };

  const handleCancelOrder = async (poId) => {
    if (!(await confirmDialog('Are you sure you want to cancel this order?'))) return;
    try {
      await axios.put(`${API_URL}/purchases/${poId}/status`, { status: 'Cancelled' });
      alert('Purchase order cancelled successfully!');
      await fetchPurchaseOrders();
    } catch (err) {
      console.error('Failed to cancel order:', err);
      alert('Failed to cancel purchase order.');
    }
  };

  const handlePrintPO = () => {
    window.print();
  };

  // ---------- LIST FILTERS & PAGING ----------

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const hasActiveFilters = !!(normalizedSearch || statusFilter || dateFrom || dateTo);

  const filteredPOs = purchaseOrders.filter((po) => {
    if (normalizedSearch) {
      const supplier = String(po.supplierName || '').toLowerCase();
      const poNo = String(po.purchaseOrderNo || '').toLowerCase();
      if (!supplier.includes(normalizedSearch) && !poNo.includes(normalizedSearch)) return false;
    }
    if (statusFilter && po.status !== statusFilter) return false;

    const day = toLocalDay(po.orderDate);
    if (dateFrom && (!day || day < dateFrom)) return false;
    if (dateTo && (!day || day > dateTo)) return false;
    return true;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
  };

  // Going back to page 1 whenever a filter changes
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredPOs.length / PO_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPOs = filteredPOs.slice((safePage - 1) * PO_PAGE_SIZE, safePage * PO_PAGE_SIZE);

  if (loading) {
    return (
      <div className="p-12 text-sm flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading procurement registry...
      </div>
    );
  }

  // ---------- DETAIL STATE ----------

  const routePO = isOnDetail && !isCreating
    ? purchaseOrders.find((p) => String(p._id) === String(routeId))
    : null;
  const notFound = isOnDetail && !isCreating && !routePO;
  // Wait until the form has loaded the right PO, so an old PO never shows for a moment
  const formReady = isOnDetail && (isCreating || (!!selectedPO && String(selectedPO._id) === String(routeId)));

  const isApproved = !isCreating && !!selectedPO && (selectedPO.status === 'Approved' || selectedPO.status === 'Received');
  const isCancelled = !isCreating && !!selectedPO && selectedPO.status === 'Cancelled';
  const isPendingApproval = !isCreating && !!selectedPO && selectedPO.status === 'Pending Approval';
  const isLocked = isApproved || isCancelled || isPendingApproval;

  // Header fields (supplier, workflow, dates, remarks) are set in the New PO popup and stay locked here
  const workflowLabel = (() => {
    const w = workflows.find((x) => String(x._id) === String(editWorkflowId));
    return w ? w.code || w.name || 'Workflow' : '—';
  })();

  const inputCls =
    'w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600';

  const detailTitle = isCreating
    ? 'New Purchase Order'
    : `Purchase Order — ${selectedPO?.purchaseOrderNo || String(selectedPO?._id || '').slice(-6).toUpperCase()}`;

  // ---------- DETAIL VIEW (/purchases/new and /purchases/:id) ----------

  const detailView = (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={goToList}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer w-fit"
        >
          <ArrowLeft size={16} /> Back to Purchase Orders
        </button>
        {formReady && !notFound && (
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart size={18} className="text-slate-500" /> {detailTitle}
          </h2>
        )}
      </div>

      {notFound ? (
        <div className="p-16 text-center text-slate-400 italic bg-white rounded-xl border border-slate-100">
          Purchase order not found. It may have been removed.
        </div>
      ) : !formReady ? (
        <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2 bg-white rounded-xl border border-slate-100">
          <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading purchase order...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 p-6 space-y-5">

          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Supplier Name *</label>
              <select
                value={editSupplier}
                disabled
                onChange={(e) => setEditSupplier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 h-11 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
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
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Approval Workflow *</label>
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 h-11 flex items-center">
                {workflowLabel}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Order Date</label>
              <input
                type="date"
                value={editOrderDate}
                disabled
                onChange={(e) => setEditOrderDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 h-11 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Expected Delivery</label>
              <input
                type="date"
                value={editExpectedDate}
                disabled
                onChange={(e) => setEditExpectedDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 h-11 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Remarks</label>
              <input
                type="text"
                value={editRemarks}
                disabled
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-800 h-11 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Purchase Lines</label>
              {!isLocked && (
                <button
                  type="button"
                  onClick={addLine}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                >
                  <Plus size={14} /> Add Line
                </button>
              )}
            </div>

            <div className="border border-slate-100 rounded-lg overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[860px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4">Colour</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4 text-center">UOM</th>
                    <th className="py-3 px-4 text-right">Ordered Qty</th>
                    <th className="py-3 px-4 text-right">Unit Price (LKR)</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {editItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 italic">No lines yet.</td>
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
                        <td className="p-2 text-center text-slate-500 pt-4">{item.uom || '-'}</td>

                        {/* Qty */}
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.orderedQty}
                            disabled={isLocked}
                            onChange={(e) => updateLine(idx, { orderedQty: e.target.value })}
                            className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
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
                            className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-right text-sm focus:outline-none disabled:bg-slate-100 disabled:text-slate-600"
                          />
                        </td>

                        {/* Subtotal */}
                        <td className="p-2 text-right font-semibold text-slate-900 pt-4">
                          {subtotal.toLocaleString()}
                        </td>

                        {/* Remove */}
                        <td className="p-2 text-center pt-3">
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              title="Remove line"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded border-none bg-transparent cursor-pointer"
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
            <span className="text-emerald-900 ml-3">LKR {grandTotal.toLocaleString()}</span>
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-slate-100">
            {isApproved ? (
              <button
                type="button"
                onClick={handlePrintPO}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold cursor-pointer border border-indigo-200 flex items-center gap-1.5 w-fit"
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
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold cursor-pointer border border-rose-200 w-fit"
              >
                Cancel Order
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={goToList}
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
      )}
    </div>
  );

  // ---------- LIST VIEW (/purchases) ----------

  const listView = (
    <>
      {/* FILTERS */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search supplier name or PO number..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
          />
        </div>

        <div className="md:col-span-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
          >
            {PO_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Order date from"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
          />
        </div>

        <div className="md:col-span-2">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Order date to"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800"
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="w-full px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-4 px-6">PO Ref</th>
              <th className="py-4 px-6">Supplier Name</th>
              <th className="py-4 px-6">Order Date</th>
              <th className="py-4 px-6">Expected Delivery</th>
              <th className="py-4 px-6">Items</th>
              <th className="py-4 px-6 text-right">Total (LKR)</th>
              <th className="py-4 px-6 text-center">Status</th>
              <th className="py-4 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {pagedPOs.length > 0 ? (
              pagedPOs.map((po) => {
                const totalAmt =
                  po.items?.reduce((sum, i) => sum + num(i.orderedQty) * num(i.unitPrice), 0) || po.totalAmount || 0;

                return (
                  <tr
                    key={po._id}
                    onClick={() => openPO(po)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-emerald-950">
                      {po.purchaseOrderNo || `PR-${String(po._id).slice(-5).toUpperCase()}`}
                    </td>
                    <td className="py-4 px-6 text-slate-800">{po.supplierName}</td>
                    <td className="py-4 px-6 text-slate-500">{toLocalDay(po.orderDate) || '-'}</td>
                    <td className="py-4 px-6 text-slate-500">{toLocalDay(po.expectedDeliveryDate) || 'N/A'}</td>
                    <td className="py-4 px-6 text-slate-700">{po.items?.length || 0} Items</td>
                    <td className="py-4 px-6 text-right font-bold text-slate-800">LKR {totalAmt.toLocaleString()}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-2 py-0.5 border rounded text-xs uppercase ${getStatusStyle(po.status)}`}>
                        {po.status || 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openPO(po)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs transition-all cursor-pointer font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                  {purchaseOrders.length > 0
                    ? 'No purchase orders match the selected filters.'
                    : 'No purchase orders found in registry.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>{filteredPOs.length.toLocaleString()} of {purchaseOrders.length.toLocaleString()} purchase orders</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 bg-white cursor-pointer"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2">Page {safePage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 bg-white cursor-pointer"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Purchasing & Procurement</h2>
          <p className="text-slate-400 text-xs mt-0.5">Manage material purchase orders. Click any row to open its page, edit items, and complete.</p>
        </div>
        {!isOnDetail && (
          <button
            type="button"
            onClick={openCreate}
            disabled={creating}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg shadow-xs gap-2 transition-all cursor-pointer"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} New Purchase Order
          </button>
        )}
      </div>

      {isOnDetail ? detailView : listView}

      {/* NEW PURCHASE ORDER POPUP */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-800" />
                <h3 className="text-base font-semibold text-slate-800">Create New Purchase Order</h3>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">PO Ref (Auto Generated)</label>
                <div className="px-4 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-emerald-900">
                  {nextPoPreview}
                  <span className="ml-2 text-xs font-normal italic text-slate-400">(final number assigned on save)</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Supplier Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newSupplier}
                    onChange={(e) => { setNewSupplier(e.target.value); setSupplierOpen(true); }}
                    onFocus={() => setSupplierOpen(true)}
                    onBlur={() => setTimeout(() => setSupplierOpen(false), 150)}
                    placeholder="Type or select a supplier..."
                    autoComplete="off"
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
                  />
                  {supplierOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                      {supplierOptions.length === 0 ? (
                        <div className="px-4 py-2.5 text-sm text-slate-400">
                          {supplierNames.length === 0 ? 'No suppliers found in the database' : 'No matching supplier'}
                        </div>
                      ) : (
                        supplierOptions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setNewSupplier(name);
                              setSupplierOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2 hover:bg-emerald-50 cursor-pointer"
                          >
                            {name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Approval Workflow Template *</label>
                <select
                  value={newWorkflowId}
                  onChange={(e) => setNewWorkflowId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 cursor-pointer"
                >
                  <option value="">Select Sign-off Workflow Matrix</option>
                  {workflows.map((wf) => (
                    <option key={wf._id} value={wf._id}>
                      {wf.code || wf.name || 'Workflow'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Expected Delivery Date *</label>
                <input
                  type="date"
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-800/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Remarks</label>
                <textarea
                  rows={2}
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreatePO}
                disabled={creating}
                className="flex-1 py-2.5 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white font-medium disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating && <Loader2 size={16} className="animate-spin" />} Save Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;