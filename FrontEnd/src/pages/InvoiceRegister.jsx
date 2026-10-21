import React, { useState, useEffect } from 'react';
import { Plus, Loader2, FileText, X, Printer, ArrowLeft, Search, Send, CheckCircle, AlertCircle, Save } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";
import { confirmDialog } from '../components/AppDialog';

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Returns the ID string for a value that may be an ID, a populated object, or empty
const getId = (value) => {
  if (value && typeof value === 'object') return String(value._id || '');
  return String(value || '');
};

// Returns the on-hand qty for one material + colour + size in one warehouse
const getStockQty = (materialId, colorId, sizeId, warehouseId, stockList) => {
  const matId = getId(materialId);
  const colId = getId(colorId);
  const szId = getId(sizeId);
  const whId = getId(warehouseId);
  if (!matId || !whId) return 0;

  const entry = stockList.find(s =>
    getId(s.material) === matId &&
    getId(s.color) === colId &&
    getId(s.size) === szId &&
    getId(s.warehouse) === whId
  );

  return entry ? Number(entry.qty || 0) : 0;
};

// Returns the total qty already entered in OTHER rows for the same material + colour + size
const getAllocatedQty = (rows, rowIndex, materialId, colorId, sizeId) => {
  const matId = getId(materialId);
  const colId = getId(colorId);
  const szId = getId(sizeId);

  return rows.reduce((sum, r, idx) => {
    if (idx === rowIndex) return sum;
    const sameItem =
      getId(r.material) === matId &&
      getId(r.color) === colId &&
      getId(r.size) === szId;
    return sameItem ? sum + Number(r.issuedQty || 0) : sum;
  }, 0);
};

const InvoiceRegister = () => {
  const [invoiceList, setInvoiceList] = useState([]);
  const [searchableItems, setSearchableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [colors, setColors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isListView, setIsListView] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approvaling, setApprovaling] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const [invoiceId, setInvoiceId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('Draft');
  const [activeWorkflow, setActiveWorkflow] = useState(null);

  const [form, setForm] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    customerName: '',
    globalWarehouse: '',
    workflowId: ''
  });

  const [items, setItems] = useState([]);
  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  // Loads every list this page needs from the server
  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      const [invRes, searchRes, whRes, colRes, custRes, wfRes, stockRes, uomRes] = await Promise.all([
        axios.get(`${API_URL}/invoices`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/grn/all-items-search`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/warehouses`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/colors`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/customers`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/workflows`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/stocks`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/uoms`).catch(() => ({ data: [] }))
      ]);

      const parsedItems = Array.isArray(searchRes.data) ? searchRes.data : (searchRes.data?.data || []);
      const parsedCustomers = Array.isArray(custRes.data) ? custRes.data : (custRes.data?.data || custRes.data?.customers || []);
      const parsedUoms = Array.isArray(uomRes.data) ? uomRes.data : (uomRes.data?.data || []);

      setInvoiceList(toArray(invRes.data));
      setSearchableItems(parsedItems);
      setWarehouses(toArray(whRes.data));
      setColors(toArray(colRes.data));
      setCustomers(parsedCustomers);
      setWorkflows(toArray(wfRes.data));
      setStocks(toArray(stockRes.data));
      setUoms(parsedUoms);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // Reloads only the stock list and returns it, so checks use the latest quantities
  const refreshStocks = async () => {
    try {
      const res = await axios.get(`${API_URL}/stocks`);
      const latest = toArray(res.data);
      setStocks(latest);
      return latest;
    } catch (err) {
      console.error('Failed to refresh stock:', err);
      return stocks;
    }
  };

  useEffect(() => { loadInvoiceData(); }, []);

  const resolveUomString = (uomData, matchedItem) => {
    if (uomData) {
      if (typeof uomData === 'object' && uomData !== null) {
        return uomData.abbreviation || uomData.name || 'Pcs';
      }
      if (typeof uomData === 'string') {
        if (!uomData.startsWith('6') && uomData.length < 10) {
          return uomData;
        }
        const foundUom = uoms.find(u => String(u._id) === String(uomData));
        if (foundUom) return foundUom.abbreviation || foundUom.name || 'Pcs';
      }
    }
    if (matchedItem && matchedItem.uom) {
      if (typeof matchedItem.uom === 'object' && matchedItem.uom !== null) {
        return matchedItem.uom.abbreviation || matchedItem.uom.name || 'Pcs';
      }
      if (typeof matchedItem.uom === 'string') {
        if (!matchedItem.uom.startsWith('6') && matchedItem.uom.length < 10) {
          return matchedItem.uom;
        }
        const foundUom = uoms.find(u => String(u._id) === String(matchedItem.uom));
        if (foundUom) return foundUom.abbreviation || foundUom.name || 'Pcs';
      }
    }
    return 'Pcs';
  };

  // Remaining stock for one row = on-hand stock minus what other rows already take
  const getRemainingStock = (rowIndex, row, rowList = items) => {
    const onHand = getStockQty(row.material, row.color, row.size, form.globalWarehouse, stocks);
    const allocated = getAllocatedQty(rowList, rowIndex, row.material, row.color, row.size);
    return Math.max(0, onHand - allocated);
  };

  const handleRowClick = (inv) => {
    setInvoiceId(inv._id);
    setActiveStatus(inv.status || 'Draft');
    setActiveWorkflow(inv.workflow);

    const warehouseId = inv.items?.[0]?.storeLocation?._id || inv.items?.[0]?.storeLocation || '';

    setForm({
      invoiceDate: inv.invoiceDate,
      customerName: inv.customerName,
      globalWarehouse: warehouseId,
      workflowId: inv.workflow?._id || inv.workflow || ''
    });

    if (inv.items && inv.items.length > 0) {
      setItems(inv.items.map(item => {
        const matObj = item.material;
        const matId = matObj && typeof matObj === 'object' ? (matObj._id || matObj.id) : matObj;
        const matchedObj = searchableItems.find(m => String(m._id) === String(matId));
        const matName = item.resolvedName || matchedObj?.itemName || (matObj && typeof matObj === 'object' ? (matObj.materialName || matObj.itemName) : null) || 'Material';
        const matCode = item.resolvedCode || matchedObj?.itemCode || (matObj && typeof matObj === 'object' ? (matObj.materialCode || matObj.itemCode) : null) || 'MAT';

        const finalUom = resolveUomString(item.uom, matchedObj);

        return {
          ...item,
          material: matId ? String(matId) : '',
          color: item.color?._id || item.color || '',
          size: item.size?._id || item.size || '',
          uom: finalUom,
          storeLocation: item.storeLocation?._id || item.storeLocation || warehouseId,
          searchQuery: `[${matCode}] ${matName}`
        };
      }));
    } else {
      setItems([{ material: '', color: '', size: '', uom: 'Pcs', issuedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: warehouseId, searchQuery: '' }]);
    }

    if (inv.status === 'Completed') {
      setIsListView(false);
      setIsPrintView(true);
    } else {
      setIsListView(false);
      setIsGridExpanded(true);
    }
  };

  const handleInitializeInvoice = async (e) => {
    e.preventDefault();
    if (!form.globalWarehouse || !form.customerName || !form.workflowId) {
      alert("Please select Customer, Warehouse and Approval Workflow.");
      return;
    }
    try {
      setInitLoading(true);
      const initialItems = [{ material: '', color: '', size: '', uom: 'Pcs', issuedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: form.globalWarehouse, searchQuery: '' }];

      const res = await axios.post(`${API_URL}/invoices/save`, {
        invoiceDate: form.invoiceDate,
        customerName: form.customerName,
        globalWarehouse: form.globalWarehouse,
        workflow: form.workflowId,
        status: 'Draft',
        items: initialItems,
        grandTotal: 0,
        createdBy: currentUsername
      });

      if (res.data && res.data._id) setInvoiceId(res.data._id);

      setActiveStatus('Draft');
      setActiveWorkflow({ _id: form.workflowId });
      setIsModalOpen(false);
      setIsListView(false);
      setIsGridExpanded(true);
      setItems(initialItems);
      refreshStocks();
    } catch (err) {
      alert("Failed to initialize Invoice.");
    } finally {
      setInitLoading(false);
    }
  };

  // Sets the material on a row (colour and size are cleared so the stock check is redone)
  const handleItemSelect = (index, selectedItem) => {
    if (activeStatus !== 'Draft') return;

    const updatedItems = items.map((row, i) => {
      if (i !== index) return row;
      const qty = Number(row.issuedQty || 0);
      const unitPrice = selectedItem.unitPrice || 0;
      return {
        ...row,
        material: selectedItem._id,
        color: '',
        size: '',
        uom: resolveUomString(selectedItem.uom, selectedItem),
        unitPrice,
        totalPrice: qty * Number(unitPrice),
        searchQuery: `[${selectedItem.itemCode}] ${selectedItem.itemName}`,
        storeLocation: row.storeLocation || form.globalWarehouse
      };
    });

    setItems(updatedItems);
  };

  const handleItemRowChange = (index, field, value) => {
    if (activeStatus !== 'Draft') return;

    const current = items[index];
    const updatedRow = { ...current, [field]: value };

    // Qty must fit in the remaining stock for the row's material, colour and size
    if (field === 'issuedQty' || field === 'color' || field === 'size') {
      const tentativeItems = items.map((row, i) => (i === index ? updatedRow : row));
      const remaining = getRemainingStock(index, updatedRow, tentativeItems);
      const requestedQty = Number(updatedRow.issuedQty || 0);

      if (updatedRow.material && form.globalWarehouse) {
        if (field === 'issuedQty') {
          if (remaining <= 0 && requestedQty > 0) {
            alert(`⚠️ No stock available for this item, colour and size in the selected warehouse.\n\nRemaining: 0`);
            return;
          }
          if (requestedQty > remaining) {
            alert(`⚠️ Insufficient stock!\n\nRemaining: ${remaining.toLocaleString()}\nRequested: ${requestedQty.toLocaleString()}`);
            return;
          }
        } else if (requestedQty > remaining) {
          // Colour or size changed and the entered qty no longer fits: clamp it
          alert(`⚠️ Stock for this colour/size is ${remaining.toLocaleString()}. Issue Qty has been adjusted.`);
          updatedRow.issuedQty = remaining;
        }
      }
    }

    if (!updatedRow.storeLocation) {
      updatedRow.storeLocation = form.globalWarehouse;
    }

    const qty = Number(updatedRow.issuedQty || 0);
    const price = Number(updatedRow.unitPrice || 0);
    updatedRow.totalPrice = qty * price;

    setItems(items.map((row, i) => (i === index ? updatedRow : row)));
  };

  const getFilteredColorsForMaterial = (materialId) => {
    if (!materialId) return [];
    const selectedMat = searchableItems.find(m => String(m._id) === String(materialId));
    if (selectedMat && selectedMat.colors && selectedMat.colors.length > 0) {
      return colors.filter(c => selectedMat.colors.some(matColor => {
        const matColorId = matColor._id || matColor;
        return String(matColorId) === String(c._id);
      }));
    }
    return colors;
  };

  const getFilteredSizesForMaterial = (materialId) => {
    if (!materialId) return [];
    const selectedMat = searchableItems.find(m => String(m._id) === String(materialId));
    return selectedMat?.sizes || [];
  };

  const handleRemoveRow = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const handleSaveDraft = async () => {
    try {
      setSubmitting(true);
      const validItems = items.filter(i => (i.material?._id || i.material) !== '');
      const formattedItems = validItems.map(item => ({
        material: item.material?._id || item.material,
        color: item.color?._id || item.color || null,
        size: item.size?._id || item.size || null,
        uom: item.uom || 'Pcs',
        issuedQty: Number(item.issuedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
        storeLocation: item.storeLocation || form.globalWarehouse
      }));

      await axios.post(`${API_URL}/invoices/save`, {
        invoiceId,
        invoiceDate: form.invoiceDate,
        customerName: form.customerName,
        workflow: form.workflowId,
        globalWarehouse: form.globalWarehouse,
        items: formattedItems,
        grandTotal: Number(grandTotal),
        status: 'Draft',
        createdBy: currentUsername
      });
      alert("Draft saved.");
    } catch (err) {
      alert("Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!activeWorkflow && !form.workflowId) {
      alert("No workflow assigned.");
      return;
    }

    const validItems = items.filter(i => (i.material?._id || i.material) !== '');
    if (validItems.length === 0) {
      alert("Please add at least one item.");
      return;
    }

    // Use fresh stock so the check is not based on an old page load
    const latestStocks = await refreshStocks();

    const errors = [];

    // Total requested per material + colour + size, so duplicate rows cannot exceed stock
    const requestedTotals = {};
    validItems.forEach(r => {
      const key = `${getId(r.material)}|${getId(r.color)}|${getId(r.size)}`;
      requestedTotals[key] = (requestedTotals[key] || 0) + Number(r.issuedQty || 0);
    });

    validItems.forEach((item, i) => {
      const rowNum = i + 1;
      const itemName = searchableItems.find(m => String(m._id) === String(getId(item.material)))?.itemName || `Row ${rowNum}`;
      const issuedQty = Number(item.issuedQty || 0);
      const onHand = getStockQty(item.material, item.color, item.size, form.globalWarehouse, latestStocks);
      const key = `${getId(item.material)}|${getId(item.color)}|${getId(item.size)}`;
      const totalRequested = requestedTotals[key] || 0;

      if (!item.color) {
        errors.push(`Row ${rowNum} (${itemName}): Please select a colour.`);
        return;
      }

      if (!item.size) {
        errors.push(`Row ${rowNum} (${itemName}): Please select a size.`);
        return;
      }

      if (issuedQty <= 0) {
        errors.push(`Row ${rowNum} (${itemName}): Issue Qty must be greater than 0.`);
        return;
      }

      if (onHand <= 0) {
        errors.push(`Row ${rowNum} (${itemName}): No stock available for this colour/size in the selected warehouse.`);
        return;
      }

      if (totalRequested > onHand) {
        errors.push(`Row ${rowNum} (${itemName}): Insufficient stock. Available: ${onHand}, Total requested for this colour/size: ${totalRequested}`);
        return;
      }

      if (Number(item.unitPrice || 0) <= 0) {
        errors.push(`Row ${rowNum} (${itemName}): Unit Price must be greater than 0.`);
        return;
      }
    });

    if (errors.length > 0) {
      alert("⚠️ Cannot submit invoice:\n\n" + errors.join('\n'));
      return;
    }

    if (!await confirmDialog("Submit this Invoice for approval?")) return;

    try {
      setApprovaling(true);
      await handleSaveDraft();
      const res = await axios.post(
        `${API_URL}/invoices/submit-approval/${invoiceId}`,
        { createdBy: currentUsername }
      );

      alert(`Invoice submitted for approval! Assigned to: ${res.data.approver}`);
      setActiveStatus('Pending Approval');
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit for approval.");
    } finally {
      setApprovaling(false);
    }
  };

  const handleBackWithDraftSave = async () => {
    if (activeStatus === 'Draft') {
      await handleSaveDraft();
    }
    resetViews();
  };

  const resetViews = () => {
    setInvoiceId(null);
    setActiveWorkflow(null);
    setIsGridExpanded(false);
    setIsPrintView(false);
    setIsModalOpen(false);
    setIsListView(true);
    setForm({ invoiceDate: new Date().toISOString().split('T')[0], customerName: '', globalWarehouse: '', workflowId: '' });
    setItems([]);
    loadInvoiceData();
  };

  const getStatusColor = (status) => {
    if (status === 'Completed') return 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
    if (status === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
    return 'bg-slate-100 border-slate-200 text-slate-600 font-medium';
  };

  if (loading) return (
    <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
      <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading invoice registry...
    </div>
  );

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {isListView && (
        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 print:hidden">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="text-emerald-900" size={20} /> Outbound Sales Invoices
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Manage customer billings, outbound dispatches and real-time stock deductions.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all cursor-pointer">
            <Plus size={16} /> Create New Invoice
          </button>
        </div>
      )}

      {isListView && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden print:hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6">INVOICE NO</th>
                <th className="py-4 px-6">DATE</th>
                <th className="py-4 px-6">CUSTOMER</th>
                <th className="py-4 px-6">WORKFLOW</th>
                <th className="py-4 px-6">TOTAL</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">BY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {invoiceList.length > 0 ? invoiceList.map((inv) => (
                <tr key={inv._id} onClick={() => handleRowClick(inv)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="py-4 px-6 font-bold text-emerald-950">{inv.invoiceNo}</td>
                  <td className="py-4 px-6 text-slate-500">{inv.invoiceDate}</td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{inv.customerName}</td>
                  <td className="py-4 px-6 text-xs text-slate-500 font-mono">{inv.workflow?.code || 'N/A'}</td>
                  <td className="py-4 px-6 font-bold text-slate-800">LKR {inv.grandTotal?.toLocaleString()}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-0.5 border rounded text-xs uppercase ${getStatusColor(inv.status)}`}>
                      {inv.status || 'Draft'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-400 uppercase text-xs">{inv.createdBy}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" className="py-16 text-center text-slate-400 italic">No invoices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white w-full max-w-lg rounded-xl flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-emerald-800" /> Initialize Outbound Invoice
              </h3>
              <button onClick={resetViews} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleInitializeInvoice} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Select Customer / Buyer *</label>
                <select required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-slate-800">
                  <option value="">Choose Customer from Database</option>
                  {Array.isArray(customers) && customers.map(cust => {
                    const custName = cust.customerName || cust.name || cust.companyName || 'Customer';
                    return <option key={cust._id} value={custName}>{custName} {cust.customerCode ? `(${cust.customerCode})` : ''}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Approval Workflow *</label>
                <select required value={form.workflowId} onChange={(e) => setForm({ ...form, workflowId: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-emerald-950">
                  <option value="">Select Approval Workflow</option>
                  {workflows.map(w => <option key={w._id} value={w._id}>{w.code || w.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium uppercase">Invoice Date *</label>
                  <input type="date" required value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium uppercase">Source Warehouse *</label>
                  <select required value={form.globalWarehouse} onChange={(e) => setForm({ ...form, globalWarehouse: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-emerald-950">
                    <option value="">Select Source Depot</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={resetViews} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-500 font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={initLoading} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center justify-center cursor-pointer">
                  {initLoading ? <Loader2 className="animate-spin" size={16} /> : "Initialize Invoice Items"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGridExpanded && (
        <div className="space-y-6 print:hidden">
          <div className="flex justify-between items-center">
            <button type="button" onClick={handleBackWithDraftSave} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer">
              ← Back {activeStatus === 'Draft' && '(Saves Draft)'}
            </button>
            <div className="text-xs font-semibold px-4 py-2 bg-white rounded-lg border flex gap-4 uppercase">
              <span>Status: <strong className={activeStatus === 'Pending Approval' ? 'text-amber-600' : 'text-emerald-700'}>{activeStatus}</strong></span>
              <span>Customer: <strong className="text-slate-900">{form.customerName}</strong></span>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-visible shadow-xs border-slate-100">
            <fieldset disabled={activeStatus === 'Completed' || activeStatus === 'Pending Approval'} className="w-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b text-[11px] text-slate-400 font-semibold uppercase border-slate-100">
                  <tr>
                    <th className="py-3 px-4 w-5 text-center">#</th>
                    <th className="py-3 px-4 w-1/4">Material / Finished Good</th>
                    <th className="py-3 px-4 w-24">Item Code</th>
                    <th className="py-3 px-4 w-32">Color *</th>
                    <th className="py-3 px-4 w-32">Size *</th>
                    <th className="py-3 px-4 w-16 text-center">UOM</th>
                    <th className="py-3 px-4 w-24 text-right bg-emerald-50/30 text-emerald-800">Available Stock</th>
                    <th className="py-3 px-4 w-24 text-right bg-amber-50 text-amber-800">Issue Qty</th>
                    <th className="py-3 px-4 w-24 text-right">Unit Price</th>
                    <th className="py-3 px-4 w-28 text-right">Total</th>
                    {activeStatus === 'Draft' && <th className="py-3 px-4 w-10 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-slate-700 border-slate-100">
                  {items.map((row, index) => {
                    const filteredColors = getFilteredColorsForMaterial(row.material);
                    const filteredSizes = getFilteredSizesForMaterial(row.material);
                    const currentSearch = row.searchQuery || '';
                    const matchedItems = searchableItems.filter(m =>
                      (m.itemName || '').toLowerCase().includes(currentSearch.toLowerCase()) ||
                      (m.itemCode || '').toLowerCase().includes(currentSearch.toLowerCase())
                    );

                    const matchedMat = searchableItems.find(m => String(m._id) === getId(row.material));
                    const remainingStock = getRemainingStock(index, row);
                    const displayUom = resolveUomString(row.uom, matchedMat);

                    return (
                      <tr key={index}>
                        <td className="py-2.5 px-4 text-center text-slate-400 text-xs">{index + 1}</td>
                        <td className="py-2.5 px-4 relative overflow-visible">
                          <div className="relative overflow-visible">
                            <div className="flex items-center bg-slate-50 border rounded-lg px-2 py-1.5">
                              <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                              <input
                                type="text"
                                placeholder="Type item code or name..."
                                value={row.searchQuery || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = items.map((r, i) => (
                                    i === index ? { ...r, searchQuery: val, material: val ? r.material : '' } : r
                                  ));
                                  setItems(updated);
                                }}
                                className="w-full bg-transparent text-xs focus:outline-none"
                              />
                            </div>
                            {currentSearch.length > 0 && !row.material && matchedItems.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
                                {matchedItems.map(m => (
                                  <div key={m._id} onClick={() => handleItemSelect(index, m)} className="px-3 py-2.5 text-xs hover:bg-emerald-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-none">
                                    <span className="font-semibold text-slate-800">[{m.itemCode}] {m.itemName}</span>
                                    <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">{m.itemType}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs font-mono text-slate-600">{matchedMat?.itemCode || row.resolvedCode || '-'}</td>
                        <td className="py-2.5 px-4">
                          <select value={getId(row.color)} onChange={(e) => handleItemRowChange(index, 'color', e.target.value)} disabled={!row.material} className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs focus:outline-none font-semibold text-emerald-950 disabled:opacity-50">
                            <option value="">{row.material ? "Select Color" : "Choose Item First"}</option>
                            {filteredColors.map(c => <option key={c._id} value={c._id}>{c.colorName || c.name} ({c.colorCode || c.code})</option>)}
                          </select>
                        </td>

                        <td className="py-2.5 px-4">
                          <select value={getId(row.size)} onChange={(e) => handleItemRowChange(index, 'size', e.target.value)} disabled={!row.material} className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs focus:outline-none font-semibold text-emerald-950 disabled:opacity-50">
                            <option value="">{row.material ? "Select Size" : "Choose Item First"}</option>
                            {filteredSizes.map(s => <option key={s._id} value={s._id}>{s.sizeCode || s.name}</option>)}
                          </select>
                        </td>

                        <td className="py-2.5 px-4 text-center text-xs text-slate-400 uppercase">{displayUom}</td>
                        <td className={`py-2.5 px-4 text-right text-xs font-bold ${remainingStock < Number(row.issuedQty || 0) ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {row.material && row.color && row.size ? remainingStock.toLocaleString() : '-'}
                        </td>
                        <td className="py-2.5 px-4 bg-amber-50/40">
                          <input type="number" min="0" max={remainingStock} value={row.issuedQty || ''} onChange={(e) => handleItemRowChange(index, 'issuedQty', e.target.value)} placeholder="0" className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-right text-xs focus:outline-none font-bold text-amber-900" />
                        </td>
                        <td className="py-2.5 px-4"><input type="number" value={row.unitPrice || ''} onChange={(e) => handleItemRowChange(index, 'unitPrice', e.target.value)} placeholder="0.00" className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-right text-xs focus:outline-none" /></td>
                        <td className="py-2.5 px-4 text-right text-slate-900 font-bold text-xs">{(row.totalPrice || 0).toLocaleString()}</td>
                        {activeStatus === 'Draft' && (
                          <td className="py-2.5 px-4 text-center">
                            <button type="button" onClick={() => handleRemoveRow(index)} className="text-slate-400 hover:text-rose-600 cursor-pointer"><X size={14} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {activeStatus === 'Draft' && (
                <div className="p-3 bg-slate-50/50 border-b">
                  <button type="button" onClick={() => setItems([...items, { material: '', color: '', size: '', uom: 'Pcs', issuedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: form.globalWarehouse, searchQuery: '' }])} className="px-3 py-1.5 bg-white border text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer">
                    <Plus size={14} /> Add Line
                  </button>
                </div>
              )}
            </fieldset>

            <div className="p-6 bg-white flex justify-end border-b border-slate-100">
              <div className="bg-slate-50 rounded-xl p-4 border flex justify-between items-center w-80 border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase">Grand Total:</span>
                <span className="text-emerald-950 font-black text-lg">LKR {grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              {activeStatus === 'Draft' ? (
                <>
                  <button type="button" onClick={handleSaveDraft} disabled={submitting} className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm cursor-pointer disabled:opacity-60 flex items-center gap-1.5">
                    {submitting ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Save Draft</>}
                  </button>
                  <button type="button" onClick={handleSubmitForApproval} disabled={approvaling} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60">
                    {approvaling ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> Submit for Approval</>}
                  </button>
                </>
              ) : activeStatus === 'Pending Approval' ? (
                <span className="text-xs text-amber-600 font-semibold italic p-2 flex items-center gap-1.5">
                  <AlertCircle size={14} /> Awaiting approval. Invoice is locked.
                </span>
              ) : (
                <span className="text-xs text-emerald-700 font-semibold italic p-2 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Invoice finalized. Stock deducted.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: portrait; margin: 5mm; }
          body { background: white !important; color: black !important; }
          body * { visibility: hidden !important; }
          #printable-invoice-area, #printable-invoice-area * { visibility: visible !important; }
          #printable-invoice-area {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; margin: 0 !important; padding: 5mm !important;
            border: none !important; box-shadow: none !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {isPrintView && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={resetViews} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm bg-slate-50 hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg transition-all cursor-pointer">
              <ArrowLeft size={16} /> Back to Registry
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 text-white bg-emerald-900 hover:bg-emerald-800 font-semibold text-sm px-6 py-2 rounded-lg shadow-md transition-all cursor-pointer">
              <Printer size={16} /> Print Invoice
            </button>
          </div>

          <div id="printable-invoice-area" className="bg-white rounded-2xl p-10 border border-slate-200 max-w-3xl mx-auto shadow-sm text-slate-800 print:shadow-none print:border-none print:p-0 print:max-w-full print:w-full">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ELISHA CLOTHING PVT LTD</h1>
                <p className="text-sm text-slate-400 mt-1 font-medium">Commercial Sales Invoice Statement</p>
              </div>
              <div className="text-right text-xs space-y-1.5 text-slate-600 font-medium uppercase">
                <div className="flex justify-end gap-2"><span className="text-slate-400">INVOICE NO:</span> <span className="text-slate-900 font-bold">{invoiceList.find(i => i._id === invoiceId)?.invoiceNo || 'INV-DRAFT'}</span></div>
                <div className="flex justify-end gap-2"><span className="text-slate-400">DATE:</span> <span className="text-slate-900 font-bold">{form.invoiceDate}</span></div>
                <div className="flex justify-end gap-2"><span className="text-slate-400">ISSUED BY:</span> <span className="text-slate-900 font-bold">{currentUsername}</span></div>
              </div>
            </div>

            <div className="bg-slate-50/70 rounded-xl p-5 mb-8 flex gap-20 items-center border border-slate-100">
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Customer / Buyer:</span>
                <div className="text-sm font-bold text-slate-900">{form.customerName || 'N/A'}</div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Source Warehouse:</span>
                <div className="text-sm font-bold text-slate-900">
                  {warehouses.find(w => w._id === form.globalWarehouse)?.warehouseName || 'General Depot'}
                </div>
              </div>
            </div>

            <table className="w-full text-left text-sm border-collapse mb-8">
              <thead>
                <tr className="border-b-2 border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-2 w-8">#</th>
                  <th className="py-3 px-2">CODE</th>
                  <th className="py-3 px-2">ITEM</th>
                  <th className="py-3 px-2">COLOR</th>
                  <th className="py-3 px-2">SIZE</th>
                  <th className="py-3 px-2 text-center">UOM</th>
                  <th className="py-3 px-2 text-right">QTY</th>
                  <th className="py-3 px-2 text-right">UNIT PRICE</th>
                  <th className="py-3 px-2 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {items.map((row, i) => {
                  const matchedSearchItem = searchableItems.find(m => String(m._id) === getId(row.material));
                  const displayItemName = row.resolvedName || matchedSearchItem?.itemName || 'Item';
                  const displayItemCode = row.resolvedCode || matchedSearchItem?.itemCode || '';

                  const linkedColor = colors.find(c => String(c._id) === getId(row.color));
                  const displayColor = linkedColor ? (linkedColor.colorName || linkedColor.name) : 'Default';

                  const linkedSizeObj = matchedSearchItem?.sizes?.find(s => String(s._id) === getId(row.size));
                  const displaySize = linkedSizeObj ? (linkedSizeObj.sizeCode || linkedSizeObj.name) : (row.size?.sizeCode || 'Default');

                  const printUom = resolveUomString(row.uom, matchedSearchItem);

                  return (
                    <tr key={i} className="text-slate-700 font-medium text-xs">
                      <td className="py-4 px-2 text-slate-400">{i + 1}</td>
                      <td className="py-4 px-2 font-semibold text-slate-700 font-mono">{displayItemCode || '-'}</td>
                      <td className="py-4 px-2 font-bold text-slate-900">{displayItemName}</td>
                      <td className="py-4 px-2 text-slate-600 font-semibold">{displayColor}</td>
                      <td className="py-4 px-2 text-slate-600 font-semibold">{displaySize}</td>
                      <td className="py-4 px-2 text-center text-slate-500 uppercase font-semibold">{String(printUom)}</td>
                      <td className="py-4 px-2 text-right font-bold">{row.issuedQty}</td>
                      <td className="py-4 px-2 text-right">{Number(row.unitPrice || 0).toFixed(2)}</td>
                      <td className="py-4 px-2 text-right font-bold text-slate-900">{Number(row.totalPrice || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-end border-t-2 border-slate-100 pt-6 mb-16">
              <div className="w-80 space-y-3 text-xs">
                <div className="flex justify-between px-2 text-slate-600 font-medium">
                  <span>Grand Total:</span>
                  <span className="font-black text-emerald-900 text-lg">LKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 pt-8 mt-8 px-4">
              <div className="border-t border-slate-200 pt-3 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prepared By</span></div>
              <div className="border-t border-slate-200 pt-3 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Checked By</span></div>
              <div className="border-t border-slate-200 pt-3 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Authorized</span></div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoiceRegister;
