import React, { useState, useEffect } from 'react';
import { Plus, Loader2, ClipboardCheck, X, Check, Printer, ArrowLeft, Search, Send, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";   

const GRNRegister = () => {
  const [grnList, setGrnList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchableItems, setSearchableItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]); 
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [approvedPOs, setApprovedPOs] = useState([]);
  const [issuingList, setIssuingList] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchGrn, setSearchGrn] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isListView, setIsListView] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

  const [grnId, setGrnId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('Draft');
  const [form, setForm] = useState({
    grnDate: new Date().toISOString().split('T')[0],
    grnType: '',
    workflow: '',
    purchaseOrder: '',
    materialIssuing: '',
    supplier: '',
    invoiceNo: '',
    vehicleNo: '',
    remarks: '',
    globalWarehouse: ''
  });

  const [items, setItems] = useState([]);
  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const loadGRNData = async () => {
    try {
      setLoading(true);
      const [grnRes, supRes, matRes, fgRes, whRes, colRes, sizeRes, txRes, poRes, issRes, wfRes] = await Promise.all([
        axios.get('${API_URL}/grn').catch(() => ({ data: [] })),
        axios.get('${API_URL}/suppliers').catch(() => ({ data: [] })),
        axios.get('${API_URL}/materials').catch(() => ({ data: [] })),
        axios.get('${API_URL}/finished-goods').catch(() => ({ data: [] })),
        axios.get('${API_URL}/warehouses').catch(() => ({ data: [] })),
        axios.get('${API_URL}/colors').catch(() => ({ data: [] })),
        axios.get('${API_URL}/sizes').catch(() => ({ data: [] })), 
        axios.get('${API_URL}/transaction-types').catch(() => ({ data: [] })),
        axios.get('${API_URL}/grn/approved-pos').catch(() => ({ data: [] })),
        axios.get('${API_URL}/grn/issuing-records').catch(() => ({ data: [] })),
        axios.get('${API_URL}/workflows').catch(() => ({ data: [] }))
      ]);

      const combined = [
        ...(matRes.data || []).map(m => ({
          _id: String(m._id), itemCode: m.materialCode || m.itemCode || 'MAT',
          itemName: m.materialName || m.itemName || 'Material', uom: m.uom,
          colors: m.colors || [], sizes: m.sizes || [], unitPrice: m.unitCost || m.unitPrice || 0, itemType: 'Raw Material'
        })),
        ...(fgRes.data || []).map(f => ({
          _id: String(f._id), itemCode: f.itemCode || f.code || 'FG',
          itemName: f.itemName || f.name || 'Finished Good', uom: f.uom,
          colors: f.colors || [], sizes: f.sizes || [], unitPrice: f.unitCost || f.unitPrice || 0, itemType: 'Finished Good'
        }))
      ];

      const txData = txRes.data;
      const parsedTxTypes = Array.isArray(txData) ? txData : (txData.data || []);
      const parsedPOs = Array.isArray(poRes.data) ? poRes.data : (poRes.data?.data || []);
      const parsedIssuing = Array.isArray(issRes.data) ? issRes.data : (issRes.data?.data || []);
      const parsedSuppliers = Array.isArray(supRes.data) ? supRes.data : (supRes.data?.data || []);
      
      const rawSizes = sizeRes.data;
      const parsedSizes = Array.isArray(rawSizes) ? rawSizes : (rawSizes.data || rawSizes.sizes || []);

      setGrnList(grnRes.data || []);
      setSuppliers(parsedSuppliers);
      setSearchableItems(combined);
      setWarehouses(whRes.data || []);
      setColors(colRes.data || []);
      setSizes(parsedSizes); 
      setTransactionTypes(parsedTxTypes);
      setApprovedPOs(parsedPOs);
      setIssuingList(parsedIssuing);
      setWorkflows(wfRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { loadGRNData(); }, []);


  const filteredGrns = grnList.filter(g => {
    const matchesGrn = (g.grnNo || '').toLowerCase().includes(searchGrn.toLowerCase());
    const matchesStatus = statusFilter === '' || g.status === statusFilter;
    
    let matchesDate = true;
    if (startDate && g.grnDate < startDate) matchesDate = false;
    if (endDate && g.grnDate > endDate) matchesDate = false;

    return matchesGrn && matchesStatus && matchesDate;
  });


  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentGrns = filteredGrns.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredGrns.length / itemsPerPage);

  const handleRowClick = (grn) => {
    setGrnId(grn._id);
    setActiveStatus(grn.status || 'Draft');
    const warehouseId = grn.items?.[0]?.storeLocation?._id || grn.items?.[0]?.storeLocation || '';

    setForm({
      grnDate: grn.grnDate,
      grnType: grn.grnType?._id || grn.grnType || '',
      workflow: grn.workflow?._id || grn.workflow || '',
      purchaseOrder: grn.purchaseOrder?._id || grn.purchaseOrder || '',
      materialIssuing: grn.materialIssuing?._id || grn.materialIssuing || '',
      supplier: grn.supplier?._id || grn.supplier || '',
      invoiceNo: grn.invoiceNo,
      vehicleNo: grn.vehicleNo,
      remarks: grn.remarks,
      globalWarehouse: warehouseId
    });

    if (grn.items && grn.items.length > 0) {
      setItems(grn.items.map(item => {
        const matObj = item.material;
        const matId = matObj && typeof matObj === 'object' ? (matObj._id || matObj.id) : matObj;
        const matchedObj = searchableItems.find(m => String(m._id) === String(matId));
        const matName = matchedObj?.itemName || (matObj && typeof matObj === 'object' ? (matObj.materialName || matObj.itemName) : null) || 'Material';
        const matCode = matchedObj?.itemCode || (matObj && typeof matObj === 'object' ? (matObj.materialCode || matObj.itemCode) : null) || 'MAT';
        return {
          ...item, material: matId ? String(matId) : '',
          color: item.color?._id || item.color || '',
          size: item.size?._id || item.size || '', 
          storeLocation: item.storeLocation?._id || item.storeLocation || warehouseId,
          searchQuery: `[${matCode}] ${matName}`
        };
      }));
    } else {
      setItems([{ material: '', color: '', size: '', uom: 'Pcs', receivedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: warehouseId, searchQuery: '' }]);
    }

    if (grn.status === 'Completed') { setIsListView(false); setIsPrintView(true); }
    else { setIsListView(false); setIsGridExpanded(true); }
  };

  const handleProceedToMaterialGrid = async (e) => {
    e.preventDefault();
    if (!form.globalWarehouse || !form.grnType) {
      alert("Please select Target Warehouse and Transaction Type.");
      return;
    }
    if (!form.workflow) {
      alert("Please select an Approval Workflow.");
      return;
    }
    try {
      setInitLoading(true);
      const selectedPO = approvedPOs.find(p => p._id === form.purchaseOrder);

      let initialItems = [];
      if (selectedPO && selectedPO.items && selectedPO.items.length > 0) {
        initialItems = selectedPO.items.map(poItem => {
          const matObj = poItem.material;
          const matId = matObj && typeof matObj === 'object' ? (matObj._id || matObj.id) : matObj;
          const matchedObj = searchableItems.find(m => String(m._id) === String(matId));
          const matName = matchedObj?.itemName || (typeof matObj === 'object' ? (matObj.itemName || matObj.materialName) : null) || poItem.materialName || 'Material';
          const matCode = matchedObj?.itemCode || (typeof matObj === 'object' ? (matObj.itemCode || matObj.materialCode) : null) || poItem.itemCode || 'MAT';
          const qty = Number(poItem.orderedQty || 0);
          const price = Number(poItem.unitPrice || 0);
          return {
            material: matId ? String(matId) : '', color: poItem.color?._id || poItem.color || '',
            size: poItem.size?._id || poItem.size || '', 
            uom: poItem.uom || matchedObj?.uom || 'Pcs', receivedQty: qty, unitPrice: price,
            totalPrice: qty * price, storeLocation: form.globalWarehouse, searchQuery: `[${matCode}] ${matName}`
          };
        });
      } else {
        initialItems = [{ material: '', color: '', size: '', uom: 'Pcs', receivedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: form.globalWarehouse, searchQuery: '' }];
      }

      const res = await axios.post('${API_URL}/grn/save', {
        grnDate: form.grnDate, grnType: form.grnType, workflow: form.workflow,
        purchaseOrder: form.purchaseOrder || null, materialIssuing: form.materialIssuing || null,
        supplier: form.supplier || null, invoiceNo: form.invoiceNo, vehicleNo: form.vehicleNo,
        remarks: form.remarks, globalWarehouse: form.globalWarehouse,
        status: 'Draft', items: initialItems,
        grandTotal: initialItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0),
        createdBy: currentUsername
      });
      if (res.data && res.data._id) setGrnId(res.data._id);

      setActiveStatus('Draft');
      setIsModalOpen(false);
      setIsListView(false);
      setIsGridExpanded(true);
      setItems(initialItems);
    } catch (err) {
      alert("Failed to initialize GRN.");
    } finally {
      setInitLoading(false);
    }
  };

  const handleItemSelect = (index, selectedItem) => {
    if (activeStatus === 'Completed' || activeStatus === 'Pending Approval') return;
    const updatedItems = [...items];
    updatedItems[index].material = selectedItem._id;
    updatedItems[index].color = '';
    updatedItems[index].size = ''; 
    updatedItems[index].uom = selectedItem.uom?.abbreviation || selectedItem.uom?.uomCode || selectedItem.uom || 'Pcs';
    updatedItems[index].unitPrice = selectedItem.unitPrice || 0;
    updatedItems[index].searchQuery = `[${selectedItem.itemCode}] ${selectedItem.itemName}`;
    const qty = Number(updatedItems[index].receivedQty || 0);
    updatedItems[index].totalPrice = qty * Number(updatedItems[index].unitPrice || 0);
    setItems(updatedItems);
  };

  const handleItemRowChange = (index, field, value) => {
    if (activeStatus === 'Completed' || activeStatus === 'Pending Approval') return;
    const updatedItems = [...items];
    updatedItems[index][field] = value;
    const qty = Number(updatedItems[index].receivedQty || 0);
    const price = Number(updatedItems[index].unitPrice || 0);
    updatedItems[index].totalPrice = qty * price;
    setItems(updatedItems);
  };

  const getFilteredColorsForMaterial = (materialId) => {
    if (!materialId) return [];
    const selectedMat = searchableItems.find(m => String(m._id) === String(materialId));
    if (selectedMat && selectedMat.colors && selectedMat.colors.length > 0) {
      return colors.filter(c => selectedMat.colors.some(matColor => {
        const matColorId = matColor && typeof matColor === 'object' ? (matColor._id || matColor.id) : matColor;
        return String(matColorId) === String(c._id);
      }));
    }
    return colors;
  };

  const getFilteredSizesForMaterial = (materialId) => {
    if (!materialId) return [];
    const selectedMat = searchableItems.find(m => String(m._id) === String(materialId));
    if (selectedMat && selectedMat.sizes && selectedMat.sizes.length > 0) {
      return sizes.filter(s => selectedMat.sizes.some(matSize => {
        const matSizeId = matSize && typeof matSize === 'object' ? (matSize._id || matSize.id) : matSize;
        return String(matSizeId) === String(s._id);
      }));
    }
    return sizes; 
  };

  const handleRemoveRow = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const handlePostGRN = async (targetStatus) => {
    const validItems = items.filter(i => (i.material?._id || i.material) !== '');
    if (validItems.length === 0 && targetStatus !== 'Draft') {
      alert("Please add at least one valid Item.");
      return;
    }
    const formattedItems = validItems.map(item => ({
      material: item.material?._id || item.material,
      color: item.color?._id || item.color || null,
      size: item.size?._id || item.size || null, 
      uom: item.uom || 'Pcs',
      receivedQty: Number(item.receivedQty || 0),
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.totalPrice || 0),
      storeLocation: item.storeLocation || form.globalWarehouse
    }));
    try {
      setSubmitting(true);
      await axios.post('${API_URL}/grn/save', {
        grnId, grnDate: form.grnDate, grnType: form.grnType, workflow: form.workflow,
        purchaseOrder: form.purchaseOrder || null, materialIssuing: form.materialIssuing || null,
        supplier: form.supplier || null, invoiceNo: form.invoiceNo, vehicleNo: form.vehicleNo,
        remarks: form.remarks, globalWarehouse: form.globalWarehouse,
        items: formattedItems, grandTotal: Number(grandTotal),
        status: targetStatus, createdBy: currentUsername
      });
      if (targetStatus !== 'Draft') {
        alert(`GRN processed as ${targetStatus}!`);
        resetViews();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error processing GRN.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitGRNForApproval = async () => {
    if (!grnId) {
      alert("GRN ID is missing. Please go back and create the GRN first.");
      return;
    }

    if (!form.workflow) {
      alert("No workflow assigned. Please go back and select a workflow.");
      return;
    }

    if (!window.confirm("Submit this GRN for approval?")) return;

    try {
      setSubmitting(true);

      const validItems = items.filter(i => {
        const matId = i.material?._id || i.material;
        return matId && String(matId).trim() !== '';
      });

      const formattedItems = validItems.map(item => ({
        material: item.material?._id || item.material,
        color: item.color?._id || item.color || null,
        size: item.size?._id || item.size || null, 
        uom: item.uom || 'Pcs',
        receivedQty: Number(item.receivedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Number(item.totalPrice || 0),
        storeLocation: item.storeLocation || form.globalWarehouse
      }));

      await axios.post('${API_URL}/grn/save', {
        grnId,
        grnDate: form.grnDate,
        grnType: form.grnType,
        workflow: form.workflow,
        purchaseOrder: form.purchaseOrder || null,
        materialIssuing: form.materialIssuing || null,
        supplier: form.supplier || null,
        invoiceNo: form.invoiceNo,
        vehicleNo: form.vehicleNo,
        remarks: form.remarks,
        globalWarehouse: form.globalWarehouse,
        items: formattedItems,
        grandTotal: Number(grandTotal),
        status: 'Draft',
        createdBy: currentUsername
      });

      const approvalRes = await axios.post(
        `${API_URL}/grn/submit-approval/${grnId}`,
        { createdBy: currentUsername }
      );

      alert(`GRN submitted for approval! Assigned to: ${approvalRes.data.approver}`);
      setActiveStatus('Pending Approval');
      loadGRNData();

    } catch (err) {
      console.error("❌ GRN Submit approval failed:", err);
      alert(err.response?.data?.message || "Failed to submit GRN for approval.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackWithDraftSave = async () => {
    if (activeStatus === 'Draft') await handlePostGRN('Draft');
    resetViews();
  };

  const resetViews = () => {
    setGrnId(null);
    setIsGridExpanded(false);
    setIsPrintView(false);
    setIsModalOpen(false);
    setIsListView(true);
    setForm({ grnDate: new Date().toISOString().split('T')[0], grnType: '', workflow: '', purchaseOrder: '', materialIssuing: '', supplier: '', invoiceNo: '', vehicleNo: '', remarks: '', globalWarehouse: '' });
    setItems([]);
    loadGRNData();
  };

  const getStatusColor = (status) => {
    if (status === 'Completed') return 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
    if (status === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
    return 'bg-slate-100 border-slate-200 text-slate-600 font-medium';
  };

  if (loading) return <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-800" size={20} /> Loading GRN registry...</div>;

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {/* HEADER */}
      {isListView && (
        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><ClipboardCheck className="text-emerald-900" size={20} /> Goods Received Note (GRN)</h2>
            <p className="text-slate-400 text-xs mt-0.5">Manage receipts, storage and live stock adjustments.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 cursor-pointer"><Plus size={16} /> Process Material GRN</button>
        </div>
      )}

      {/* 🌟 ✅ GRN Filter Toolbar (Search by GRN No, Status, Date Range) */}
      {isListView && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Search size={14} /></span>
            <input 
              type="text"
              value={searchGrn}
              onChange={(e) => { setSearchGrn(e.target.value); setCurrentPage(1); }}
              placeholder="Search by GRN No..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-400 font-medium h-9"
            />
          </div>

          <div>
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none uppercase text-slate-700 h-9"
            >
              <option value="">All Statuses</option>
              <option value="Completed">COMPLETED</option>
              <option value="Pending Approval">PENDING APPROVAL</option>
              <option value="Draft">DRAFT</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 h-9">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* LIST TABLE */}
      {isListView && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6">GRN NO</th>
                <th className="py-4 px-6">TYPE</th>
                <th className="py-4 px-6">DATE</th>
                <th className="py-4 px-6">INVOICE</th>
                <th className="py-4 px-6">TOTAL</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">BY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {currentGrns.length > 0 ? currentGrns.map((g) => (
                <tr key={g._id} onClick={() => handleRowClick(g)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="py-4 px-6 font-bold text-emerald-950">{g.grnNo}</td>
                  <td className="py-4 px-6 font-semibold text-emerald-800">{g.grnType?.typeName || 'General'}</td>
                  <td className="py-4 px-6 text-slate-500">{g.grnDate}</td>
                  <td className="py-4 px-6 text-slate-600 font-semibold">{g.invoiceNo}</td>
                  <td className="py-4 px-6 font-bold text-slate-800">LKR {g.grandTotal?.toLocaleString()}</td>
                  <td className="py-4 px-6"><span className={`px-2 py-0.5 border rounded text-xs uppercase ${getStatusColor(g.status)}`}>{g.status || 'Draft'}</span></td>
                  <td className="py-4 px-6 text-slate-400 uppercase text-xs">{g.createdBy}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="py-16 text-center text-slate-400 italic">No GRN records found matching your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 🌟 ✅ Pagination Controls (20 items per page) */}
      {isListView && totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
          <div className="text-slate-400 text-xs">
            Showing <strong className="text-slate-700">{indexOfFirstItem + 1}</strong> to <strong className="text-slate-700">{Math.min(indexOfLastItem, filteredGrns.length)}</strong> of <strong className="text-slate-700">{filteredGrns.length}</strong> entries
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-slate-600"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-3 py-1 font-bold text-slate-700 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-slate-600"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* INIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl flex flex-col shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><ClipboardCheck size={18} className="text-emerald-800" /> Initialize Inbound GRN</h3>
              <button onClick={resetViews} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleProceedToMaterialGrid} className="p-5 space-y-4">

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Transaction Type *</label>
                <select required value={form.grnType} onChange={(e) => setForm({ ...form, grnType: e.target.value, purchaseOrder: '', materialIssuing: '' })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-emerald-950">
                  <option value="">Select Transaction Type</option>
                  {Array.isArray(transactionTypes) && transactionTypes.map(t => (
                    <option key={t._id} value={t._id}>{t.typeName || t.name} ({t.code || t.typeCode})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Approval Workflow *</label>
                <select required value={form.workflow} onChange={(e) => setForm({ ...form, workflow: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-emerald-950">
                  <option value="">Select Approval Workflow</option>
                  {workflows.map(w => (
                    <option key={w._id} value={w._id}>{w.code || w.name}</option>
                  ))}
                </select>
              </div>

              {form.grnType && (() => {
                const selectedTx = transactionTypes.find(t => t._id === form.grnType);
                if (!selectedTx) return null;
                const code = (selectedTx.code || selectedTx.typeCode || '').toUpperCase();
                const srcType = selectedTx.sourceType;
                return (
                  <div>
                    {(code === 'POP' || code === 'GRN-PO' || srcType === 'with_po' || selectedTx?.requiresPO) && (
                      <div className="space-y-1 animate-in fade-in">
                        <label className="block text-[11px] text-slate-400 font-medium uppercase">Select Purchase Order *</label>
                        <select required value={form.purchaseOrder} onChange={(e) => {
                          const poId = e.target.value;
                          const matchedPO = approvedPOs.find(p => p._id === poId);
                          setForm({ ...form, purchaseOrder: poId, supplier: matchedPO?.supplier || '' });
                        }} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-slate-800">
                          <option value="">Choose Approved PO</option>
                          {approvedPOs.map(po => {
                            const displayPoNo = po.purchaseOrderNo || `PR-${po._id.slice(-5).toUpperCase()}`;
                            return <option key={po._id} value={po._id}>{displayPoNo} {po.supplierName ? `- ${po.supplierName}` : ''}</option>;
                          })}
                        </select>
                      </div>
                    )}
                    {(code === 'RET' || code === 'GRN-ISS' || srcType === 'with_issuing' || selectedTx?.requiresIssuing) && (
                      <div className="space-y-1 animate-in fade-in">
                        <label className="block text-[11px] text-slate-400 font-medium uppercase">Select Issuing Record *</label>
                        <select required value={form.materialIssuing} onChange={(e) => setForm({ ...form, materialIssuing: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-slate-800">
                          <option value="">Choose Issuing Reference</option>
                          {Array.isArray(issuingList) && issuingList.map(iss => (
                            <option key={iss._id} value={iss._id}>Issue: {iss.issueNo || iss._id.slice(-6).toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium uppercase">GRN Date *</label>
                  <input type="date" required value={form.grnDate} onChange={(e) => setForm({ ...form, grnDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium uppercase">Invoice No *</label>
                  <input type="text" required placeholder="INV-001" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const selectedTx = transactionTypes.find(t => t._id === form.grnType);
                  const showSup = selectedTx ? (selectedTx.requiresSupplier !== false) : true;
                  if (showSup) {
                    return (
                      <div className="space-y-1">
                        <label className="block text-[11px] text-slate-400 font-medium uppercase">Supplier</label>
                        <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-semibold text-slate-800">
                          <option value="">Choose Supplier</option>
                          {Array.isArray(suppliers) && suppliers.map(s => {
                            const supName = s.supplierName || s.name || s.companyName || 'Unknown';
                            return <option key={s._id} value={s._id}>{supName}</option>;
                          })}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-400 font-medium uppercase">Target Warehouse *</label>
                  <select required value={form.globalWarehouse} onChange={(e) => setForm({ ...form, globalWarehouse: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-bold text-emerald-950">
                    <option value="">Select Warehouse</option>
                    {warehouses.map(w => <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Vehicle Number</label>
                <input type="text" placeholder="WP WP-4530" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none uppercase font-semibold" />
              </div>

              <div className="flex gap-3 pt-3">
                <button type="button" onClick={resetViews} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-500 font-medium cursor-pointer">Cancel</button>
                <button type="submit" disabled={initLoading} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center justify-center cursor-pointer">
                  {initLoading ? <Loader2 className="animate-spin" size={16} /> : "Initialize Material Input"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {isGridExpanded && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button type="button" onClick={handleBackWithDraftSave} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer">
              <ArrowLeft size={14} /> Back {activeStatus === 'Draft' && '(Saves Draft)'}
            </button>
            <div className="text-xs font-semibold px-4 py-2 bg-white rounded-lg border flex gap-4 uppercase">
              <span>Status: <strong className={activeStatus === 'Pending Approval' ? 'text-amber-600' : 'text-emerald-700'}>{activeStatus}</strong></span>
              <span>Invoice: <strong className="text-slate-900">{form.invoiceNo}</strong></span>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-visible shadow-xs border-slate-100">
            <fieldset disabled={activeStatus === 'Completed' || activeStatus === 'Pending Approval'} className="w-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b text-[11px] text-slate-400 font-semibold uppercase border-slate-100">
                  <tr>
                    <th className="py-3 px-4 w-5 text-center">#</th>
                    <th className="py-3 px-4 w-1/4">Material / Item (Searchable)</th>
                    <th className="py-3 px-4 w-1/5">Color *</th>
                    <th className="py-3 px-4 w-1/5">Size *</th> 
                    <th className="py-3 px-4 w-16 text-center">UOM</th>
                    <th className="py-3 px-4 w-24 text-right">Received Qty</th>
                    <th className="py-3 px-4 w-24 text-right">Unit Cost</th>
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
                    return (
                      <tr key={index}>
                        <td className="py-2.5 px-4 text-center text-slate-400 text-xs">{index + 1}</td>
                        <td className="py-2.5 px-4 relative overflow-visible">
                          <div className="relative overflow-visible">
                            <div className="flex items-center bg-slate-50 border rounded-lg px-2 py-1.5">
                              <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                              <input type="text" placeholder="Type item code or name..." value={row.searchQuery || ''} onChange={(e) => { const val = e.target.value; const updated = [...items]; updated[index].searchQuery = val; if (!val) updated[index].material = ''; setItems(updated); }} className="w-full bg-transparent text-xs focus:outline-none" />
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
                        <td className="py-2.5 px-4">
                          <select value={row.color?._id || row.color || ''} onChange={(e) => handleItemRowChange(index, 'color', e.target.value)} disabled={!row.material} className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs focus:outline-none font-semibold text-emerald-950 disabled:opacity-50">
                            <option value="">{row.material ? "Select Color" : "Choose Item First"}</option>
                            {filteredColors.map(c => <option key={c._id} value={c._id}>{c.colorName || c.name} ({c.colorCode || c.code})</option>)}
                          </select>
                        </td>
                        <td className="py-2.5 px-4">
                          <select value={row.size?._id || row.size || ''} onChange={(e) => handleItemRowChange(index, 'size', e.target.value)} disabled={!row.material} className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-xs focus:outline-none font-semibold text-emerald-950 disabled:opacity-50">
                            <option value="">{row.material ? "Select Size" : "Choose Item First"}</option>
                            {filteredSizes.map(s => <option key={s._id} value={s._id}>{s.sizeCode || s.sizeDescription || s.name}</option>)}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-center text-xs text-slate-400 uppercase">{row.uom}</td>
                        <td className="py-2.5 px-4"><input type="number" required value={row.receivedQty || ''} onChange={(e) => handleItemRowChange(index, 'receivedQty', e.target.value)} placeholder="0" className="w-full px-2 py-1.5 bg-slate-50 border rounded-lg text-right text-xs focus:outline-none font-bold" /></td>
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
                  <button type="button" onClick={() => setItems([...items, { material: '', color: '', size: '', uom: 'Pcs', receivedQty: 0, unitPrice: 0, totalPrice: 0, storeLocation: form.globalWarehouse, searchQuery: '' }])} className="px-3 py-1.5 bg-white border text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer"><Plus size={14} /> Add Line</button>
                </div>
              )}
            </fieldset>

            <div className="p-6 bg-white flex justify-between items-center border-b border-slate-100">
              <div className="w-1/2">
                <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1">Remarks</label>
                <input type="text" disabled={activeStatus !== 'Draft'} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-xs h-10 focus:outline-none" />
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border flex justify-between items-center w-80 border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase">Grand Total:</span>
                <span className="text-emerald-950 font-black text-lg">LKR {grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              {activeStatus === 'Draft' ? (
                <>
                  <button type="button" onClick={() => handlePostGRN('Draft')} disabled={submitting} className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm cursor-pointer disabled:opacity-60">Save Draft</button>
                  <button type="button" onClick={handleSubmitGRNForApproval} disabled={submitting} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60">
                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> Submit for Approval</>}
                  </button>
                </>
              ) : activeStatus === 'Pending Approval' ? (
                <span className="text-xs text-amber-600 font-semibold italic p-2">⏳ Awaiting approval. GRN is locked.</span>
              ) : (
                <span className="text-xs text-slate-400 italic p-2">GRN finalized and locked.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT VIEW */}
      {isPrintView && (
        <div className="space-y-6">
          <div className="flex justify-between items-center no-print">
            <button onClick={resetViews} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"><ArrowLeft size={14} /> Back</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-white bg-slate-900 hover:bg-slate-800 font-medium text-xs px-4 py-2 rounded-lg shadow-sm cursor-pointer"><Printer size={14} /> Print GRN</button>
          </div>
          <div className="bg-white rounded-xl p-8 border border-slate-200 max-w-4xl mx-auto space-y-6 shadow-xs text-slate-800">
            <div className="flex justify-between border-b pb-6 border-slate-100">
              <div>
                <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">Elisha Clothing Pvt Ltd</h1>
                <p className="text-xs text-slate-400 mt-1">Goods Received Note (GRN)</p>
              </div>
              <div className="text-right text-xs space-y-1">
                <div>DATE: <span className="font-medium">{form.grnDate}</span></div>
                <div>INVOICE: <span className="font-bold text-slate-900">{form.invoiceNo}</span></div>
                <div>BY: <span className="font-semibold uppercase text-emerald-900">{currentUsername}</span></div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg text-xs space-y-1">
              <div>Supplier: <span className="font-bold text-slate-900">{suppliers.find(s => s._id === form.supplier)?.supplierName || 'N/A'}</span></div>
              <div>Vehicle: <span className="font-semibold text-slate-700 uppercase">{form.vehicleNo || 'N/A'}</span></div>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Size</th> 
                  <th className="p-3 text-center">UOM</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Unit Price</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium">
                {items.map((row, i) => {
                  const linkedColor = colors.find(c => String(c._id) === String(row.color?._id || row.color));
                  const linkedSize = sizes.find(s => String(s._id) === String(row.size?._id || row.size)); 
                  const matObj = searchableItems.find(m => String(m._id) === String(row.material?._id || row.material));
                  return (
                    <tr key={i}>
                      <td className="p-3 text-center text-slate-400">{i + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{matObj?.itemName || 'Component'}</td>
                      <td className="p-3 text-slate-600 font-semibold">{linkedColor ? (linkedColor.colorName || linkedColor.name) : 'Default'}</td>
                      <td className="p-3 text-slate-600 font-semibold">{linkedSize ? (linkedSize.sizeCode || linkedSize.sizeDescription || linkedSize.name) : 'N/A'}</td> 
                      <td className="p-3 text-center">{row.uom}</td>
                      <td className="p-3 text-right font-bold">{row.receivedQty}</td>
                      <td className="p-3 text-right">{row.unitPrice?.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-emerald-950">{row.totalPrice?.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t-2 pt-4 flex justify-end">
              <div className="w-80 text-sm font-bold text-slate-900 flex justify-between pt-1">
                <span>GRAND TOTAL:</span>
                <span className="text-emerald-900 text-base">LKR {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-16 text-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <div className="border-t pt-2">Received By</div>
              <div className="border-t pt-2">Checked By</div>
              <div className="border-t pt-2">Authorized Signature</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default GRNRegister;