import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, ArrowLeft, FileSpreadsheet, X, Printer, Send, ChevronDown, Search } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../api/config';



// Letters, numbers, "-" and "/" only, max 20 characters
const COSTING_NO_REGEX = /^[A-Z0-9\-\/]{1,20}$/;

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Dropdown with a built-in search box. Filters options by their label as the user types.
const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Type to search...',
  emptyText = 'No results found',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  // Close the dropdown when the user clicks outside it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleSelect = (opt) => {
    onChange(opt.value);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 h-11 text-sm text-left flex items-center justify-between focus:outline-none disabled:opacity-50"
      >
        <span className={selectedOption ? 'truncate' : 'text-slate-400 truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-slate-400 shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-sm bg-transparent focus:outline-none"
            />
          </div>

          <ul className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                      String(opt.value) === String(value)
                        ? 'bg-emerald-50 text-emerald-900 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-slate-400 italic">{emptyText}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const Costing = () => {
  const [costingList, setCostingList] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isListView, setIsListView] = useState(true);
  const [isInitialModalOpen, setIsInitialModalOpen] = useState(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);

  const [costingId, setCostingId] = useState(null);
  const [activeStatus, setActiveStatus] = useState('Draft');
  const [initialForm, setInitialForm] = useState({
    costingDate: new Date().toISOString().split('T')[0],
    salesOrder: '',
    workflowTemplate: ''
  });

  // Manual costing number (modal input)
  const [costingNo, setCostingNo] = useState('');
  const [costingNoError, setCostingNoError] = useState('');

  const [items, setItems] = useState([]);
  const [cmCost, setCmCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [fabricCharges, setFabricCharges] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [initiationLoading, setInitiationLoading] = useState(false);

  const [dbMaterials, setDbMaterials] = useState([]);
  const [dbSuppliers, setDbSuppliers] = useState([]);

  // Color master is not used for costing, so its state and API call are disabled
  // const [colors, setColors] = useState([]);

  // Stored separately so the print view always has the costing number
  const [activeCostingNo, setActiveCostingNo] = useState('');

  const currentUsername = localStorage.getItem('username') || 'DILUM';

  // Loads every list this page needs from the server
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [costingRes, salesOrderRes, workflowRes, materialRes, supplierRes] = await Promise.all([
        axios.get(`${API_URL}/costing`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/sales-orders`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/workflows`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/materials`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/suppliers`).catch(() => ({ data: [] }))
        // axios.get(`${API_URL}/colors`).catch(() => ({ data: [] }))  // Color master disabled
      ]);

      setCostingList(toArray(costingRes.data));
      setSalesOrders(toArray(salesOrderRes.data));
      setWorkflows(toArray(workflowRes.data));
      setDbMaterials(toArray(materialRes.data));
      setDbSuppliers(toArray(supplierRes.data));
      // setColors(toArray(colorRes.data));  // Color master disabled
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { loadInitialData(); }, []);

  // Opens an existing costing: Completed ones open in print view, others open in the editable grid
  const handleRowClick = (costing) => {
    setCostingId(costing._id);
    setActiveStatus(costing.status);
    setActiveCostingNo(costing.costingNo || '');

    setInitialForm({
      costingDate: costing.costingDate,
      salesOrder: costing.salesOrder?._id || costing.salesOrder,
      workflowTemplate: costing.workflowTemplate?._id || costing.workflowTemplate
    });

    if (costing.items && costing.items.length > 0) {
      setItems(costing.items.map(item => ({
        ...item,
        material: item.material?._id || item.material,
        // color: item.color?._id || item.color || '',  // Color master disabled
        supplier: item.supplier?._id || item.supplier || '',
        unitCost: Number(item.unitCost !== undefined ? item.unitCost : item.unitPrice || 0)
      })));
    } else {
      const defaultSupplierId = dbSuppliers[0]?._id || '';
      setItems([{ material: '', supplier: defaultSupplierId, uom: 'Pcs', consumption: 0, wastagePercentage: 0, unitCost: 0, totalCost: 0, totalWithWastage: 0 }]);
    }

    setCmCost(costing.cmCost || 0);
    setOverheadCost(costing.overheadCost || 0);
    setFabricCharges(costing.fabricCharges || 0);

    if (costing.status === 'Completed') {
      setIsListView(false);
      setIsPrintView(true);
    } else {
      setIsListView(false);
      setIsSheetExpanded(true);
    }
  };

  // Validates the costing number and creates a draft costing on the server
  const handleProceedToSheet = async (e) => {
    e.preventDefault();

    const normalizedNo = costingNo.trim().toUpperCase();

    if (!COSTING_NO_REGEX.test(normalizedNo)) {
      setCostingNoError('Only letters, numbers, "-" and "/" are allowed (max 20 characters)');
      return;
    }

    if (!initialForm.salesOrder || !initialForm.workflowTemplate) {
      alert('Please select a valid Sales Order and Approval Workflow Matrix.');
      return;
    }

    try {
      setInitiationLoading(true);
      const defaultSupplierId = dbSuppliers[0]?._id || '';

      const initialItems = [{ material: '', supplier: defaultSupplierId, uom: 'Pcs', consumption: 0, wastagePercentage: 0, unitCost: 0, totalCost: 0, totalWithWastage: 0 }];

      const initialPayload = {
        costingNo: normalizedNo,
        costingDate: initialForm.costingDate,
        salesOrder: initialForm.salesOrder,
        workflowTemplate: initialForm.workflowTemplate,
        items: [],
        totalMaterialCost: 0,
        cmCost: 0,
        overheadCost: 0,
        fabricCharges: 0,
        grandTotal: 0,
        status: 'Draft',
        createdBy: currentUsername
      };

      const response = await axios.post(`${API_URL}/costing/save`, initialPayload);
      if (response.data && response.data._id) {
        setCostingId(response.data._id);
        setActiveCostingNo(response.data.costingNo || normalizedNo);
      }

      setCostingNo('');
      setCostingNoError('');
      setActiveStatus('Draft');
      setIsInitialModalOpen(false);
      setIsListView(false);
      setIsSheetExpanded(true);
      setItems(initialItems);
      setCmCost(0);
      setOverheadCost(0);
      setFabricCharges(0);
      loadInitialData();
    } catch (err) {
      console.error(err);
      // Backend 409 (duplicate) and 400 (format) messages are shown here
      alert(err.response?.data?.message || 'Failed to initialize costing draft.');
    } finally {
      setInitiationLoading(false);
    }
  };

  // Updates one grid row and recalculates its totals
  const handleItemRowChange = (index, field, value) => {
    if (activeStatus === 'Completed' || activeStatus === 'Pending Approval') return;

    const updatedItems = [...items];
    updatedItems[index][field] = value;

    // When the material changes, copy its UOM and unit cost from the material master
    if (field === 'material') {
      const selectedMaterial = dbMaterials.find(m => m._id === value);
      if (selectedMaterial) {
        const uomData = selectedMaterial.uom;
        updatedItems[index]['uom'] = uomData && typeof uomData === 'object'
          ? (uomData.abbreviation || uomData.name || 'Pcs')
          : (uomData || 'Pcs');
        updatedItems[index]['unitCost'] = Number(selectedMaterial.unitCost || selectedMaterial.unitPrice || 0);
      }
    }

    const consumption = Number(updatedItems[index].consumption || 0);
    const unitCost = Number(updatedItems[index].unitCost || 0);
    const wastagePercentage = Number(updatedItems[index].wastagePercentage || 0);
    const totalCost = consumption * unitCost;
    const totalWithWastage = totalCost + (totalCost * (wastagePercentage / 100));
    updatedItems[index].totalCost = totalCost;
    updatedItems[index].totalWithWastage = totalWithWastage;

    setItems(updatedItems);
  };

  // Returns only the colors that are linked to the selected material
  // Color master disabled: not used for costing
  // const getFilteredColorsForMaterial = (materialId) => {
  //   if (!materialId) return [];
  //   const selectedMaterial = dbMaterials.find(m => m._id === materialId);
  //   if (selectedMaterial && selectedMaterial.colors && selectedMaterial.colors.length > 0) {
  //     return colors.filter(c => selectedMaterial.colors.some(materialColor => {
  //       const materialColorId = materialColor._id || materialColor;
  //       return String(materialColorId) === String(c._id);
  //     }));
  //   }
  //   return [];
  // };

  // Adds an empty material row to the grid
  const handleAddRow = () => {
    const defaultSupplierId = dbSuppliers[0]?._id || '';
    setItems([...items, { material: '', supplier: defaultSupplierId, uom: 'Pcs', consumption: 0, wastagePercentage: 0, unitCost: 0, totalCost: 0, totalWithWastage: 0 }]);
  };

  // Removes a material row, keeping at least one row
  const handleRemoveRow = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const totalMaterialCost = items.reduce((sum, item) => sum + (item.totalWithWastage || 0), 0);
  const grandTotal =
    totalMaterialCost +
    Number(cmCost || 0) +
    Number(overheadCost || 0) +
    Number(fabricCharges || 0);

  // Saves the costing with the given status; auto-draft saves do not show alerts
  const executeSaveOperation = async (finalStatus, isAutoDraft = false) => {
    try {
      if (!isAutoDraft) setSubmitting(true);

      const defaultSupplierId = dbSuppliers[0]?._id || '';

      const sanitizedItems = items
        .filter(item => item.material && String(item.material).trim() !== '')
        .map(item => ({
          material: item.material,
          color: null, // Color master not used for costing
          supplier: item.supplier && String(item.supplier).trim() !== '' ? item.supplier : defaultSupplierId,
          uom: String(item.uom || 'Pcs'),
          consumption: Number(item.consumption || 0),
          wastagePercentage: Number(item.wastagePercentage || 0),
          unitCost: Number(item.unitCost || 0),
          totalCost: Number(item.totalCost || 0),
          totalWithWastage: Number(item.totalWithWastage || 0)
        }));

      // costingNo is not sent here: it is set once at creation and cannot be edited
      const payload = {
        costingId,
        costingDate: initialForm.costingDate,
        salesOrder: initialForm.salesOrder,
        workflowTemplate: initialForm.workflowTemplate,
        items: sanitizedItems,
        totalMaterialCost: Number(totalMaterialCost),
        cmCost: Number(cmCost || 0),
        overheadCost: Number(overheadCost || 0),
        fabricCharges: Number(fabricCharges || 0),
        grandTotal: Number(grandTotal),
        status: finalStatus,
        createdBy: currentUsername
      };

      const response = await axios.post(`${API_URL}/costing/save`, payload);

      if (response.data && response.data.costingNo) {
        setActiveCostingNo(response.data.costingNo);
      }

      if (!isAutoDraft) {
        if (finalStatus === 'Pending Approval') {
          alert('Costing submitted for approval successfully!');
        } else {
          alert(`Costing Sheet Matrix saved successfully as ${finalStatus}!`);
        }
      }
      resetViews();
    } catch (err) {
      console.error(err);
      if (!isAutoDraft) alert(err.response?.data?.message || 'Error saving costing details.');
    } finally {
      if (!isAutoDraft) setSubmitting(false);
    }
  };

  // Saves a draft automatically when going back from a draft sheet
  const handleBackWithDraftSave = async () => {
    if (activeStatus === 'Draft') {
      await executeSaveOperation('Draft', true);
    } else {
      resetViews();
    }
  };

  // Returns to the list view and reloads the data
  const resetViews = () => {
    setCostingId(null);
    setActiveCostingNo('');
    setIsSheetExpanded(false);
    setIsPrintView(false);
    setIsListView(true);
    loadInitialData();
  };

  // Returns the badge classes for a costing status
  const getStatusStyle = (status) => {
    if (status === 'Completed') return 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';
    if (status === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
    if (status === 'Rejected') return 'bg-rose-50 border-rose-200 text-rose-700 font-bold';
    return 'bg-slate-100 border-slate-200 text-slate-600 font-medium';
  };

  if (loading) return (
    <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
      <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading commercial costing registry...
    </div>
  );

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">COSTING Sheet Matrix</h2>
          <p className="text-slate-400 text-xs mt-0.5">Formulate material yield grids, structural margins, wastage allowances and overhead pricing structures.</p>
        </div>
        {isListView && (
          <button
            onClick={() => {
              setCostingId(null);
              setActiveCostingNo('');
              setCostingNo('');
              setCostingNoError('');
              setInitialForm({ costingDate: new Date().toISOString().split('T')[0], salesOrder: '', workflowTemplate: '' });
              setIsInitialModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all"
          >
            <Plus size={16} /> Create Costing Matrix
          </button>
        )}
      </div>

      {/* --- 1. LIST VIEW --- */}
      {isListView && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6">COSTING NO</th>
                <th className="py-4 px-6">DATE</th>
                <th className="py-4 px-6">SALES ORDER REF</th>
                <th className="py-4 px-6">GRAND TOTAL VALUE</th>
                <th className="py-4 px-6">STATUS</th>
                <th className="py-4 px-6">CREATED BY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {costingList.length > 0 ? (
                costingList.map((c) => {
                  const orderReferenceText = c.salesOrder && typeof c.salesOrder === 'object'
                    ? (c.salesOrder.orderRef || 'Linked Order')
                    : String(c.salesOrder || 'Unlinked SO');

                  return (
                    <tr key={c._id} onClick={() => handleRowClick(c)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="py-4 px-6 font-semibold text-emerald-950">{c.costingNo || `CST-${c._id.toString().slice(-5).toUpperCase()}`}</td>
                      <td className="py-4 px-6 text-slate-500">{c.costingDate}</td>
                      <td className="py-4 px-6 text-slate-800">{orderReferenceText}</td>
                      <td className="py-4 px-6 font-bold text-slate-800">LKR {c.grandTotal?.toLocaleString()}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 border rounded text-xs uppercase ${getStatusStyle(c.status)}`}>{c.status}</span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-semibold uppercase">{c.createdBy || 'SYSTEM'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 italic">No active costing matrix records registered in database.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* --- 2. INITIAL MODAL --- */}
      {isInitialModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-100 flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-emerald-800" /> Costing Matrix Initiation
              </h3>
              <button onClick={() => setIsInitialModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleProceedToSheet} className="p-5 space-y-4 text-sm">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Costing No *</label>
                <input
                  type="text"
                  required
                  maxLength={20}
                  placeholder="E2420001435LD01"
                  value={costingNo}
                  onChange={(e) => {
                    setCostingNo(e.target.value.toUpperCase());
                    setCostingNoError('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 h-11 text-sm focus:outline-none"
                />
                {costingNoError && <p className="text-xs text-rose-600">{costingNoError}</p>}
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Costing Date</label>
                <input
                  type="date"
                  required
                  value={initialForm.costingDate}
                  onChange={(e) => setInitialForm({ ...initialForm, costingDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 h-11 text-sm focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Select Live Sales Order *</label>
                <SearchableSelect
                  options={salesOrders.map(so => ({
                    value: so._id,
                    label: `${so.orderRef} - ${so.buyerName}`
                  }))}
                  value={initialForm.salesOrder}
                  onChange={(id) => setInitialForm({ ...initialForm, salesOrder: id })}
                  placeholder="Choose Live Contract Route"
                  searchPlaceholder="Search by order ref or buyer..."
                  emptyText="No sales orders match your search"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Attach Approval Workflow Template *</label>
                <select
                  required
                  value={initialForm.workflowTemplate}
                  onChange={(e) => setInitialForm({ ...initialForm, workflowTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 h-11 text-sm focus:outline-none"
                >
                  <option value="">Select Sign-off Workflow Matrix</option>
                  {workflows.map(wf => <option key={wf._id} value={wf._id}>{wf.code}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsInitialModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-500 font-medium">Cancel</button>
                <button type="submit" disabled={initiationLoading} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-medium shadow-sm flex items-center justify-center">
                  {initiationLoading ? <Loader2 className="animate-spin" size={14} /> : 'Build Sheet Grid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 3. EXPANDED GRID --- */}
      {isSheetExpanded && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button onClick={handleBackWithDraftSave} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              <ArrowLeft size={14} /> Back to Registry {activeStatus === 'Draft' && '(Saves Draft)'}
            </button>
            <div className="text-xs font-semibold px-4 py-2 bg-white rounded-lg border border-slate-100 flex gap-4">
              <span>Costing: <strong className="text-emerald-950">{activeCostingNo || 'N/A'}</strong></span>
              <span>Status: <strong className="text-emerald-700">{activeStatus}</strong></span>
              <span>Order: <strong className="text-emerald-900">{salesOrders.find(s => s._id === initialForm.salesOrder)?.orderRef || 'SO'}</strong></span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-visible shadow-sm">
            <fieldset disabled={activeStatus === 'Completed' || activeStatus === 'Pending Approval'} className="w-full">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4 w-5 text-center">#</th>
                    <th className="py-3 px-4 w-1/2">Material Descriptor Code / Name</th>
                    {/* Color Master column disabled: not used for costing
                    <th className="py-3 px-4 w-1/4">Color Master *</th>
                    */}
                    <th className="py-3 px-4 w-20 text-center">UOM</th>
                    <th className="py-3 px-4 w-24 text-right">Yield (CNSM)</th>
                    <th className="py-3 px-4 w-20 text-right">Wastage W%</th>
                    <th className="py-3 px-4 w-28 text-right">Unit Cost</th>
                    <th className="py-3 px-4 w-32 text-right">Net Total (TTL)</th>
                    <th className="py-3 px-4 w-36 text-right">Total + W%</th>
                    {activeStatus === 'Draft' && <th className="py-3 px-4 w-12 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {items.map((row, index) => {
                    const uomDisplay = row.uom && typeof row.uom === 'object' ? (row.uom.abbreviation || row.uom.name || 'Pcs') : String(row.uom || 'Pcs');
                    return (
                      <tr key={index}>
                        <td className="py-2.5 px-4 text-center text-slate-400 text-xs">{index + 1}</td>

                        {/* Material searchable dropdown */}
                        <td className="py-2.5 px-4">
                          <SearchableSelect
                            options={dbMaterials.map(m => ({
                              value: m._id,
                              label: `[${m.itemCode || 'MAT'}] ${m.materialName}`
                            }))}
                            value={row.material}
                            onChange={(id) => handleItemRowChange(index, 'material', id)}
                            placeholder="Select Material"
                            searchPlaceholder="Search by code or name..."
                            emptyText="No materials match your search"
                          />
                        </td>

                        {/* Color cell disabled: not used for costing
                        <td className="py-2.5 px-4">
                          <select
                            value={row.color}
                            onChange={(e) => handleItemRowChange(index, 'color', e.target.value)}
                            disabled={!row.material}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none font-semibold text-emerald-950 disabled:opacity-50"
                          >
                            <option value="">{row.material ? 'Select Shade / Color' : 'Choose Material First'}</option>
                            {filteredColors.map(c => {
                              const colorName = c.colorName || c.name || c.nameS || 'Color Active';
                              const colorCode = c.colorCode || c.code || 'N/A';
                              return <option key={c._id} value={c._id}>{colorName} ({colorCode})</option>;
                            })}
                          </select>
                        </td>
                        */}

                        <td className="py-2.5 px-4 text-center text-xs text-slate-500">{uomDisplay}</td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            step="any"
                            value={row.consumption || ''}
                            onChange={(e) => handleItemRowChange(index, 'consumption', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs text-slate-800 focus:outline-none font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            step="any"
                            value={row.wastagePercentage || ''}
                            onChange={(e) => handleItemRowChange(index, 'wastagePercentage', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs text-slate-800 focus:outline-none font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <input
                            type="number"
                            step="any"
                            value={row.unitCost || ''}
                            onChange={(e) => handleItemRowChange(index, 'unitCost', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-right text-xs text-slate-800 focus:outline-none font-medium"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600 text-xs">{row.totalCost?.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-slate-900 font-semibold text-xs">{row.totalWithWastage?.toFixed(2)}</td>
                        {activeStatus === 'Draft' && (
                          <td className="py-2.5 px-4 text-center">
                            <button type="button" onClick={() => handleRemoveRow(index)} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {activeStatus === 'Draft' && (
                <div className="p-3 bg-slate-50/50 border-b border-slate-100">
                  <button type="button" onClick={handleAddRow} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all">
                    <Plus size={14} /> Add Material Line
                  </button>
                </div>
              )}

              <div className="p-6 bg-white grid grid-cols-12 gap-6 items-start font-semibold text-sm">
                <div className="col-span-6 space-y-3">
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-xs text-slate-400 uppercase">Styling CM Charges</label>
                    <input
                      type="number"
                      value={cmCost || ''}
                      onChange={(e) => setCmCost(e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none h-10"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-xs text-slate-400 uppercase">Cutting Charges</label>
                    <input
                      type="number"
                      value={overheadCost || ''}
                      onChange={(e) => setOverheadCost(e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none h-10"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <label className="text-xs text-slate-400 uppercase">Fabric Charges</label>
                    <input
                      type="number"
                      value={fabricCharges || ''}
                      onChange={(e) => setFabricCharges(e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none h-10"
                    />
                  </div>
                </div>
                <div className="col-span-6 bg-slate-50/40 rounded-xl p-5 border border-slate-100 space-y-2 text-slate-600 font-medium">
                  <div className="flex justify-between border-b pb-2 border-slate-100 text-xs">
                    <span>TOTAL COMPONENT MATERIAL COST:</span>
                    <span className="text-slate-800 font-bold">LKR {totalMaterialCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base pt-1 font-bold text-slate-800">
                    <span>GRAND TOTAL PRICE (TTL + W%):</span>
                    <span className="text-emerald-900 text-lg">LKR {grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              {activeStatus === 'Draft' ? (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => executeSaveOperation('Draft')}
                    className="px-4 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-all"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => executeSaveOperation('Pending Approval')}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Send size={14} /> Submit for Approval</>}
                  </button>
                </>
              ) : activeStatus === 'Pending Approval' ? (
                <span className="text-xs text-amber-600 font-semibold italic p-2">
                  Awaiting approval from assigned workflow approver. Sheet is locked.
                </span>
              ) : (
                <span className="text-xs text-slate-400 italic p-2">
                  This costing sheet has been fully finalized and the ledger is locked.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- 4. PRINT VIEW --- */}
      {isPrintView && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center no-print">
            <button onClick={resetViews} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              <ArrowLeft size={14} /> Back to Registry
            </button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-white bg-slate-900 hover:bg-slate-800 font-medium text-xs px-4 py-2 rounded-lg shadow-sm">
              <Printer size={14} /> Print Costing Sheet
            </button>
          </div>

          <div className="bg-white rounded-xl p-8 border border-slate-200 max-w-4xl mx-auto space-y-6 shadow-xs text-slate-800">
            <div className="flex justify-between border-b pb-6 border-slate-100">
              <div>
                <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">Elisha Clothing Pvt Ltd</h1>
                <p className="text-xs text-slate-400 mt-1">Commercial Costing & Yield Matrix Statement</p>
              </div>
              <div className="text-right text-xs space-y-1">
                <div>COSTING NO: <span className="font-bold text-slate-900">{activeCostingNo || 'N/A'}</span></div>
                <div>DATE: <span className="font-medium">{initialForm.costingDate}</span></div>
                <div>PREPARED BY: <span className="font-semibold uppercase">{currentUsername}</span></div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-xs">
              <div>
                Sales Order Reference:
                <span className="font-bold block text-sm text-slate-900 mt-0.5">
                  {salesOrders.find(s => s._id === initialForm.salesOrder)?.orderRef || 'N/A'}
                </span>
              </div>
              <div>
                Workflow Template Route:
                <span className="font-bold block text-sm text-slate-900 mt-0.5">
                  {workflows.find(w => w._id === initialForm.workflowTemplate)?.code || 'N/A'}
                </span>
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3 w-8 text-center">#</th>
                  <th className="p-3">Material Descriptor</th>
                  {/* Color Shade column disabled: not used for costing
                  <th className="p-3">Color Shade</th>
                  */}
                  <th className="p-3 text-center">UOM</th>
                  <th className="p-3 text-right">Yield</th>
                  <th className="p-3 text-right">Wastage %</th>
                  <th className="p-3 text-right">Unit Cost</th>
                  <th className="p-3 text-right">Total (LKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((row, i) => {
                  const materialName = dbMaterials.find(m => m._id === row.material)?.materialName || 'Component Material';
                  return (
                    <tr key={i}>
                      <td className="p-3 text-center text-slate-400">{i + 1}</td>
                      <td className="p-3 font-semibold text-slate-900">{materialName}</td>
                      {/* Color Shade cell disabled: not used for costing
                      <td className="p-3 text-slate-600 font-semibold">
                        {(() => {
                          const linkedColor = colors.find(c => c._id === (row.color?._id || row.color));
                          return linkedColor ? (linkedColor.colorName || linkedColor.name || linkedColor.nameS) : 'Default';
                        })()}
                      </td>
                      */}
                      <td className="p-3 text-center">{row.uom}</td>
                      <td className="p-3 text-right">{row.consumption}</td>
                      <td className="p-3 text-right">{row.wastagePercentage}%</td>
                      <td className="p-3 text-right">{row.unitCost?.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold">{row.totalWithWastage?.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="border-t-2 border-slate-200 pt-4 flex justify-end">
              <div className="w-80 text-xs space-y-2 font-medium">
                <div className="flex justify-between"><span>Material Net Cost:</span><span>LKR {totalMaterialCost.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Styling CM charges:</span><span>LKR {Number(cmCost).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Cutting Charges:</span><span>LKR {Number(overheadCost).toLocaleString()}</span></div>
                <div className="flex justify-between border-b pb-2"><span>Fabric Charges:</span><span>LKR {Number(fabricCharges).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                  <span>GRAND TOTAL VALUE:</span>
                  <span className="text-emerald-900 text-base">LKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 pt-16 text-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <div className="border-t pt-2">Prepared By</div>
              <div className="border-t pt-2">Checked By</div>
              <div className="border-t pt-2">Authorized Signature</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Costing;