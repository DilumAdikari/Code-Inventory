import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { confirmDialog } from '../components/AppDialog';
import {
  Loader2,
  Search,
  Plus,
  X,
  ClipboardList,
  Layers,
  FileText,
  Info,
  ArrowLeft,
  ShoppingCart,
  Send
} from 'lucide-react';
import { API_URL } from '../api/config';

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Formats a date as YYYY-MM-DD, or '-' if the value is missing or invalid
const formatDate = (value) => {
  const date = new Date(value);
  return isNaN(date) ? '-' : date.toISOString().split('T')[0];
};

// Returns the display label for a size (sizeCode first, then description).
// Falls back to the raw value only when no matching size is found.
const getSizeLabel = (size, sizeList) => {
  if (!size) return '-';

  // Size may already be populated as an object from the backend
  if (typeof size === 'object') {
    return size.sizeCode || size.sizeDescription || size._id || '-';
  }

  const found = sizeList.find(s => String(s._id) === String(size));
  if (!found) return size;
  return found.sizeCode || found.sizeDescription || size;
};

// Returns the badge classes for a production order status
const getStatusStyle = (status) => {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Pending Approval') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'Cancelled') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
};

// Groups the sales order items by colour and sums the quantity per colour.
// Items without a colour are grouped under a single "Standard Shade" entry.
const buildColorGroups = (order) => {
  const items = order?.salesOrder?.items || [];
  const groupMap = {};

  items.forEach(item => {
    const colorId = item.color && typeof item.color === 'object' ? item.color._id : item.color;
    const key = colorId ? String(colorId) : 'NO_COLOR';
    const qty = Number(item.quantity || item.qty || 0);

    if (!groupMap[key]) {
      groupMap[key] = { colorId: colorId || null, qty: 0 };
    }
    groupMap[key].qty += qty;
  });

  return Object.values(groupMap);
};

// Groups saved BOM rows by colour so the BOM tab can show one block per colour
const groupBOMByColor = (rows) => {
  const groups = {};
  rows.forEach(row => {
    const key = row.colorName || 'Standard Shade';
    if (!groups[key]) {
      groups[key] = { colorName: key, colorQty: Number(row.colorQty || 0), rows: [] };
    }
    groups[key].rows.push(row);
  });
  return Object.values(groups);
};

const ProductionOrders = () => {
  const [orders, setOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [costings, setCostings] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [poGenerating, setPoGenerating] = useState(false);

  const [isListView, setIsListView] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('plan');

  const [activeBOMData, setActiveBOMData] = useState({});
  const [bomLoadingId, setBomLoadingId] = useState(null);

  const [targetDate, setTargetDate] = useState('');
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [selectedSalesOrder, setSelectedSalesOrder] = useState('');
  const [selectedCosting, setSelectedCosting] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loadedGarmentQuantities, setLoadedGarmentQuantities] = useState([]);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  // Loads every list this page needs from the server
  const fetchData = async () => {
    try {
      const [poRes, soRes, costingRes, wfRes, sizeRes, colorRes] = await Promise.all([
        axios.get(`${API_URL}/production-orders`),
        axios.get(`${API_URL}/sales-orders`),
        axios.get(`${API_URL}/costing`),
        axios.get(`${API_URL}/workflows`),
        axios.get(`${API_URL}/sizes`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/colors`).catch(() => ({ data: [] }))
      ]);
      setOrders(toArray(poRes.data));
      setSalesOrders(toArray(soRes.data));
      setCostings(toArray(costingRes.data));
      setWorkflows(toArray(wfRes.data));

      // Sizes may come back as a plain array or wrapped in an object
      const rawSizes = sizeRes.data;
      setSizes(Array.isArray(rawSizes) ? rawSizes : toArray(rawSizes?.data || rawSizes?.sizes));

      const rawColors = colorRes.data;
      setColors(Array.isArray(rawColors) ? rawColors : toArray(rawColors?.data || rawColors?.colors));
      setLoading(false);
    } catch (err) {
      console.error('Error loading production registry:', err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Shortcut to get the display label for a size value
  const getSize = (size) => getSizeLabel(size, sizes);

  // Returns the costing number for a production order (populated object or ID)
  const getCostingNo = (order) => {
    const ref = order?.costing;
    if (ref && typeof ref === 'object' && ref.costingNo) return ref.costingNo;

    const costingId = String(ref?._id || ref || '');
    const found = costings.find(c => String(c._id) === costingId);
    return found?.costingNo || '-';
  };

  // Returns the colour name for a colour value (populated object or ID)
  const getColorLabel = (color) => {
    if (!color) return 'Standard Shade';
    if (typeof color === 'object') {
      return color.colorName || color.name || color.code || 'Standard Shade';
    }
    const found = colors.find(c => String(c._id) === String(color));
    if (!found) return 'Standard Shade';
    return found.colorName || found.name || found.code || 'Standard Shade';
  };

  // Builds the garment size/quantity list from the selected sales order
  const handleSalesOrderChange = async (soId) => {
    setSelectedSalesOrder(soId);
    if (!soId) {
      setLoadedGarmentQuantities([]);
      return;
    }

    const selectedSoObj = salesOrders.find(s => String(s._id) === String(soId));

    if (selectedSoObj && selectedSoObj.items && selectedSoObj.items.length > 0) {
      const sizeMap = {};
      selectedSoObj.items.forEach(item => {
        const sizeKey = item.size || 'M';
        const qty = Number(item.quantity || item.qty || 0);
        if (sizeMap[sizeKey]) {
          sizeMap[sizeKey] += qty;
        } else {
          sizeMap[sizeKey] = qty;
        }
      });

      const formattedGarments = Object.keys(sizeMap).map(size => ({
        size,
        orderQty: sizeMap[size]
      }));

      setLoadedGarmentQuantities(formattedGarments);
    } else {
      setLoadedGarmentQuantities([]);
    }
  };

  // Creates a new production order from the modal form
  const handleInitialPOSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        targetDate,
        workflowId: selectedWorkflow,
        salesOrderId: selectedSalesOrder,
        costingId: selectedCosting,
        garmentQuantities: loadedGarmentQuantities.map(q => ({
          size: q.size,
          orderQty: Number(q.orderQty !== undefined ? q.orderQty : q.quantity || q.qty || 0)
        })),
        bomItems: [],
        remarks,
        createdBy: currentUsername
      };

      await axios.post(`${API_URL}/production-orders/create`, payload);
      setTargetDate('');
      setSelectedWorkflow('');
      setSelectedSalesOrder('');
      setSelectedCosting('');
      setRemarks('');
      setLoadedGarmentQuantities([]);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to register production run sheet.');
    } finally {
      setSubmitting(false);
    }
  };

  // Sends the production order for approval
  const handleSubmitForApproval = async () => {
    if (!await confirmDialog('Submit this Production Order for approval?')) return;

    try {
      setStatusUpdatingId(selectedOrder._id);

      await axios.post(
        `${API_URL}/production-orders/submit-approval/${selectedOrder._id}`,
        { createdBy: currentUsername }
      );

      alert('Production Order submitted for approval! The assigned approver will be notified.');
      setSelectedOrder(prev => ({ ...prev, status: 'Pending Approval' }));
      fetchData();
    } catch (err) {
      console.error('Submit approval failed:', err);
      alert(err.response?.data?.message || 'Failed to submit for approval.');
    } finally {
      setStatusUpdatingId(null);
    }
  };

  // Calculates the colour-wise BOM and shortages for a completed production order
  const handleTriggerBOMCalculation = async (orderObj) => {
    const poId = orderObj._id;

    if (orderObj.status !== 'Completed') {
      alert('BOM Generation Locked: Production Order must be Completed (approved) before generating BOM.');
      return;
    }

    if (!orderObj.costing?._id && !orderObj.costing) {
      alert('No valid associated approved product costing profile found.');
      return;
    }

    try {
      setBomLoadingId(poId);
      const costingId = orderObj.costing?._id || orderObj.costing;

      const res = await axios.get(`${API_URL}/production-orders/costing-details/${costingId}`);
      const costingData = res.data;
      const costingItems = costingData.items || costingData.materials || [];

      // One group per colour, with the total garment qty for that colour
      let colorGroups = buildColorGroups(orderObj);
      if (colorGroups.length === 0) {
        // Fallback when there are no sales order items: one generic group
        const fallbackQty = (orderObj.garmentQuantities || []).reduce(
          (sum, item) => sum + (Number(item.orderQty) || 0), 0
        );
        colorGroups = [{ colorId: null, qty: fallbackQty }];
      }

      // Fetch stock once for all materials
      const stockRes = await axios.get(`${API_URL}/stocks`).catch(() => ({ data: [] }));
      const stockList = toArray(stockRes.data);

      const calculatedShortageBOM = [];

      colorGroups.forEach(group => {
        const colorName = getColorLabel(group.colorId);

        costingItems.forEach(cItem => {
          const materialObj = cItem.material && typeof cItem.material === 'object' ? cItem.material : null;
          const materialId = materialObj ? materialObj._id : cItem.material;

          const consumption = Number(cItem.consumption !== undefined ? cItem.consumption : cItem.yield || 0);
          const wastage = Number(cItem.wastagePercentage !== undefined ? cItem.wastagePercentage : 0);
          const totalRequired = group.qty * consumption * (1 + (wastage / 100));

          // Stock must match both the material and the colour
          const currentStockObj = stockList.find(s => {
            const sMatId = s.material && typeof s.material === 'object' ? s.material._id : s.material;
            const sColId = s.color && typeof s.color === 'object' ? s.color._id : s.color;
            return String(sMatId) === String(materialId) && String(sColId) === String(group.colorId);
          });

          const availableStock = currentStockObj ? Number(currentStockObj.qty || currentStockObj.quantity || 0) : 0;
          const shortage = totalRequired > availableStock ? (totalRequired - availableStock) : 0;

          calculatedShortageBOM.push({
            material: materialId,
            color: group.colorId,
            colorName,
            colorQty: group.qty,
            materialName: materialObj?.materialName || cItem.materialName || 'Component Material',
            itemCode: materialObj?.itemCode || cItem.itemCode || 'MAT',
            uom: cItem.uom || 'Pcs',
            consumption,
            wastage,
            requiredQty: totalRequired,
            availableStockQty: availableStock,
            shortageQty: shortage
          });
        });
      });

      await axios.put(`${API_URL}/production-orders/save-bom/${poId}`, { bomItems: calculatedShortageBOM });

      setActiveBOMData(prev => ({ ...prev, [poId]: calculatedShortageBOM }));
      setSelectedOrder(prev => ({ ...prev, bomItems: calculatedShortageBOM }));
      setActiveSubTab('bom');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('BOM Calculation matrix allocation failed.');
    } finally {
      setBomLoadingId(null);
    }
  };

  // Creates a purchase order for all materials that are short
  const handleGeneratePurchaseOrderForShortage = async () => {
    if (poGenerating) return;

    const currentBOM = activeBOMData[selectedOrder._id] || selectedOrder.bomItems || [];
    const shortageItems = currentBOM.filter(b => Number(b.shortageQty || 0) > 0);

    if (shortageItems.length === 0) {
      alert('No material shortages detected to generate a Purchase Order.');
      return;
    }

    if (!await confirmDialog(`Generate Purchase Requisition for ${shortageItems.length} shortage items?`)) return;

    try {
      setPoGenerating(true);
      const payload = {
        productionOrderId: selectedOrder._id,
        supplierName: selectedOrder.salesOrder?.buyerName || 'General Supplier',
        items: shortageItems.map(item => ({
          material: item.material,
          materialName: item.materialName,
          itemCode: item.itemCode,
          colorName: item.colorName,
          uom: item.uom,
          orderedQty: Number(item.shortageQty),
          unitPrice: 0
        })),
        remarks: `Auto-generated from Production Order: ${selectedOrder.productionOrderNo}`
      };

      await axios.post(`${API_URL}/purchases/create`, payload);
      setSelectedOrder(prev => ({ ...prev, poGenerated: true }));
      alert('Purchase Order generated successfully!');
    } catch (err) {
      console.error('Failed to generate purchase order:', err);
      alert('Failed to generate Purchase Order.');
    } finally {
      setPoGenerating(false);
    }
  };

  // Opens the order detail sheet and maps any saved BOM rows
  const handleOpenOrderSheet = (order) => {
    setSelectedOrder(order);
    setActiveSubTab('plan');
    setIsListView(false);

    if (order.bomItems && order.bomItems.length > 0) {
      const mappedBOM = order.bomItems.map(b => ({
        materialName: b.materialName || 'Component Material',
        itemCode: b.itemCode || 'MAT',
        colorName: b.colorName || 'Standard Shade',
        colorQty: Number(b.colorQty) || 0,
        uom: b.uom || 'Pcs',
        consumption: Number(b.consumption) || 0,
        wastage: Number(b.wastage) || 0,
        requiredQty: Number(b.requiredQty) || 0,
        availableStockQty: Number(b.availableStockQty) || 0,
        shortageQty: Number(b.shortageQty) || 0
      }));
      setActiveBOMData(prev => ({ ...prev, [order._id]: mappedBOM }));
    }
  };

  // Returns to the list view and reloads the data
  const handleCloseOrderSheet = () => {
    setSelectedOrder(null);
    setIsListView(true);
    fetchData();
  };

  const filteredOrders = orders.filter(o =>
    (o.productionOrderNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.salesOrder?.orderRef || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading production orders...
      </div>
    );
  }

  const hasBOMAlreadyCreated = (selectedOrder?.bomItems && selectedOrder.bomItems.length > 0);

  // Garment size/quantity rows for the selected order
  const resolvedGarmentsList = selectedOrder
    ? ((selectedOrder.garmentQuantities && selectedOrder.garmentQuantities.length > 0)
        ? selectedOrder.garmentQuantities
        : (selectedOrder.salesOrder?.items || []).reduce((acc, curr) => {
            const existing = acc.find(item => item.size === curr.size);
            if (existing) {
              existing.orderQty += Number(curr.quantity || curr.qty || 0);
            } else {
              acc.push({ size: curr.size || 'M', orderQty: Number(curr.quantity || curr.qty || 0) });
            }
            return acc;
          }, []))
    : [];

  const currentBOMForCheck = selectedOrder ? (activeBOMData[selectedOrder._id] || selectedOrder.bomItems || []) : [];
  const hasShortages = currentBOMForCheck.some(b => Number(b.shortageQty || 0) > 0);

  // BOM rows grouped by colour for the BOM tab
  const bomRowsForTab = selectedOrder ? (activeBOMData[selectedOrder._id] || []) : [];
  const bomColorGroups = groupBOMByColor(bomRowsForTab);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm text-slate-700">

      {/* VIEW 1: LIST */}
      {isListView && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Production Sheets Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Log line routing schedules and click any sheet row to open full workstation profiles.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all gap-2 cursor-pointer border-none"
            >
              <Plus size={18} /> Add Production Order
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center w-full">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400"><Search size={18} /></span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by PO number or Sales Order..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4 px-6">PO Number</th>
                    <th className="p-4 px-6">Sales Contract Ref</th>
                    <th className="p-4 px-6">Costing</th>
                    <th className="p-4 px-6">Target Deadline</th>
                    <th className="p-4 px-6">Plant Line Routing</th>
                    <th className="p-4 px-6">Worksheet Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                    const displayPoNo = order.productionOrderNo || `PROD-${order._id.slice(-5).toUpperCase()}`;
                    return (
                      <tr
                        key={order._id}
                        onClick={() => handleOpenOrderSheet(order)}
                        className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                      >
                        <td className="p-4 px-6 text-sm font-bold text-slate-900 font-mono">{displayPoNo}</td>
                        <td className="p-4 px-6 text-sm font-semibold text-emerald-900">{order.salesOrder?.orderRef || 'N/A'}</td>
                        <td className="p-4 px-6 text-sm font-mono text-slate-700 font-semibold">{getCostingNo(order)}</td>
                        <td className="p-4 px-6 text-sm text-slate-500">{formatDate(order.targetDate)}</td>
                        <td className="p-4 px-6 text-sm text-slate-700 font-semibold">{order.workflow?.name || order.workflow?.code || 'Standard Line'}</td>
                        <td className="p-4 px-6">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(order.status)}`}>
                            {order.status || 'Draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-slate-400 italic">No production orders registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: ORDER DETAIL SHEET */}
      {!isListView && selectedOrder && (
        <div className="space-y-6 animate-in fade-in duration-200">

          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <button
              onClick={handleCloseOrderSheet}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm bg-white border border-slate-200 px-4 py-2 rounded-xl cursor-pointer transition-all"
            >
              <ArrowLeft size={16} /> Back to Registry
            </button>
            <div className="text-sm px-5 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm flex flex-wrap gap-6">
              <span>Worksheet: <span className="text-slate-900 font-mono font-bold">{selectedOrder.productionOrderNo || `PROD-${selectedOrder._id.slice(-5).toUpperCase()}`}</span></span>
              <span>Status: <span className={`font-semibold ${selectedOrder.status === 'Completed' ? 'text-emerald-700' : selectedOrder.status === 'Pending Approval' ? 'text-amber-600' : 'text-slate-700'}`}>{selectedOrder.status || 'Draft'}</span></span>
              <span>Contract: <span className="text-emerald-900 font-semibold">{selectedOrder.salesOrder?.orderRef || 'SO'}</span></span>
              <span>Costing: <span className="text-slate-900 font-mono font-semibold">{getCostingNo(selectedOrder)}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-8 px-6 pt-3 border-b bg-white border-slate-100 rounded-t-2xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('plan')}
              className={`pb-3 text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5 bg-transparent border-none focus:outline-none transition-all cursor-pointer ${activeSubTab === 'plan' ? 'text-slate-900 border-b-2 border-solid border-slate-900' : 'text-slate-400'}`}
            >
              Production Plan <Info size={14} className="text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedOrder.status === 'Completed' || hasBOMAlreadyCreated) {
                  if (activeBOMData[selectedOrder._id]) {
                    setActiveSubTab('bom');
                  } else {
                    handleTriggerBOMCalculation(selectedOrder);
                  }
                } else {
                  alert('BOM Locked: Production Order must be approved and Completed before generating BOM.');
                }
              }}
              className={`pb-3 text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5 bg-transparent border-none focus:outline-none transition-all cursor-pointer ${selectedOrder.status !== 'Completed' && !hasBOMAlreadyCreated ? 'opacity-40 cursor-not-allowed text-slate-400' : activeSubTab === 'bom' ? 'text-slate-900 border-b-2 border-solid border-slate-900' : 'text-slate-400'}`}
            >
              {bomLoadingId === selectedOrder._id ? <Loader2 className="animate-spin text-slate-400" size={14} /> : 'BOM'} <Info size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-b-2xl border-x border-b border-slate-100 shadow-sm space-y-6">

            {/* PLAN TAB */}
            {activeSubTab === 'plan' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Layers size={18} className="text-slate-500" /> Production Order Layout Matrix
                </div>
                <div className="border border-slate-100 bg-white rounded-xl overflow-hidden w-full">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="p-4 text-center w-12">#</th>
                        <th className="p-4">Code</th>
                        <th className="p-4">Material</th>
                        <th className="p-4">Name</th>
                        <th className="p-4">Schedule</th>
                        <th className="p-4 text-center">Size</th>
                        <th className="p-4 text-right">Planning Qty</th>
                        <th className="p-4 text-right">Actual Qty</th>
                        <th className="p-4 text-center">STS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {resolvedGarmentsList.map((g, gIdx) => (
                        <tr key={gIdx} className="hover:bg-slate-50/60">
                          <td className="p-4 text-center text-slate-400 text-sm">{gIdx + 1}</td>
                          <td className="p-4 font-mono text-slate-900 text-sm">JOB{String(selectedOrder.productionOrderNo || selectedOrder._id).replace(/\D/g, '').slice(-5) || '00'}{gIdx + 1}</td>
                          <td className="p-4 font-mono text-slate-600 text-sm">{selectedOrder.salesOrder?.orderRef || 'SKU'}</td>
                          <td className="p-4 text-sm">{selectedOrder.salesOrder?.buyerName || 'Garment Fabrication'} Run</td>
                          <td className="p-4 text-slate-500 text-sm">Bulk</td>
                          <td className="p-4 text-center text-slate-900 font-mono text-sm">{getSize(g.size)}</td>
                          <td className="p-4 text-right text-sm">{Number(g.orderQty || 0).toLocaleString()}</td>
                          <td className="p-4 text-right text-slate-300 text-sm">-</td>
                          <td className="p-4 text-center text-xs font-semibold text-emerald-800">
                            {hasBOMAlreadyCreated ? 'BOM CREATED' : 'PENDING'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t border-slate-200 text-slate-900 font-semibold">
                        <td colSpan="6" className="p-4 text-right text-sm">Total</td>
                        <td className="p-4 text-right text-sm font-mono">
                          {resolvedGarmentsList.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0).toLocaleString()}.00
                        </td>
                        <td className="p-4 text-right text-slate-400 font-mono text-sm">0.00</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-3">

                  {/* Draft -> Submit for Approval */}
                  {selectedOrder.status === 'Draft' && (
                    <button
                      onClick={handleSubmitForApproval}
                      disabled={statusUpdatingId === selectedOrder._id}
                      type="button"
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 border-none shadow-sm transition-all cursor-pointer text-sm disabled:opacity-60"
                    >
                      {statusUpdatingId === selectedOrder._id
                        ? <Loader2 className="animate-spin" size={16} />
                        : <><Send size={16} /> Submit for Approval</>
                      }
                    </button>
                  )}

                  {/* Pending Approval -> locked */}
                  {selectedOrder.status === 'Pending Approval' && (
                    <span className="text-xs text-amber-600 font-semibold italic p-2">
                      Awaiting approval from assigned workflow approver. Sheet is locked.
                    </span>
                  )}

                  {/* Completed without BOM -> Create BOM */}
                  {selectedOrder.status === 'Completed' && !hasBOMAlreadyCreated && (
                    <button
                      onClick={() => handleTriggerBOMCalculation(selectedOrder)}
                      disabled={bomLoadingId === selectedOrder._id}
                      type="button"
                      className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 border-none shadow-sm transition-all disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {bomLoadingId === selectedOrder._id
                        ? <Loader2 className="animate-spin" size={16} />
                        : 'Create BOM'
                      }
                    </button>
                  )}

                  {/* Completed with BOM -> info */}
                  {selectedOrder.status === 'Completed' && hasBOMAlreadyCreated && (
                    <span className="text-xs text-emerald-700 font-semibold italic p-2">
                      BOM has been created. View in BOM tab.
                    </span>
                  )}

                </div>
              </div>
            )}

            {/* BOM TAB */}
            {activeSubTab === 'bom' && activeBOMData[selectedOrder._id] && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
                  <div className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-800" /> Dynamic Bill of Materials Matrix (Auto Yield Formula View)
                  </div>

                  {hasShortages && !selectedOrder.poGenerated && (
                    <button
                      onClick={handleGeneratePurchaseOrderForShortage}
                      disabled={poGenerating}
                      type="button"
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-none shadow-sm ${poGenerating ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'}`}
                    >
                      {poGenerating ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />}
                      {poGenerating ? 'Generating PO...' : 'Create Purchase Order for Shortages'}
                    </button>
                  )}
                </div>

                {bomColorGroups.map((group, gIdx) => (
                  <div key={gIdx} className="border border-slate-100 bg-white rounded-xl overflow-hidden w-full">
                    <div className="px-4 py-3 bg-slate-50/75 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-900">Colour: {group.colorName}</span>
                      <span className="text-sm text-slate-600 font-mono">Garment Qty: {Number(group.colorQty).toLocaleString()} Pcs</span>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="p-4">Component Profile</th>
                          <th className="p-4 text-center">UOM</th>
                          <th className="p-4 text-right">CNSM</th>
                          <th className="p-4 text-right">Wastage %</th>
                          <th className="p-4 text-right">Gross Required</th>
                          <th className="p-4 text-right">Store Stock</th>
                          <th className="p-4 text-right">Shortage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {group.rows.map((b, bIdx) => (
                          <tr key={bIdx} className="hover:bg-slate-50/60">
                            <td className="p-4 text-sm font-semibold text-slate-900">{b.materialName} <span className="text-slate-400 text-xs font-mono">({b.itemCode})</span></td>
                            <td className="p-4 text-center font-mono text-slate-500 text-sm">{b.uom}</td>
                            <td className="p-4 text-right font-mono text-slate-900 text-sm">{Number(b.consumption || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-mono text-rose-600 text-sm">{Number(b.wastage || 0)}%</td>
                            <td className="p-4 text-right font-mono text-slate-900 text-sm bg-slate-50">{Number(b.requiredQty || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-mono text-emerald-900 text-sm">{Number(b.availableStockQty || 0).toFixed(2)}</td>
                            <td className="p-4 text-right font-mono text-rose-700 text-sm bg-rose-50/20">{b.shortageQty > 0 ? Number(b.shortageQty).toFixed(2) : '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setActiveSubTab('plan')} type="button" className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-all border-none cursor-pointer text-sm">
                    Back to Plan
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* CREATE PRODUCTION ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2"><ClipboardList size={18} className="text-slate-500" /> Initiate Production Run Sheet</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"><X size={20} /></button>
            </div>

            <form onSubmit={handleInitialPOSubmit} className="p-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500">Target Date *</label>
                  <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500">Plant Line / Workflow *</label>
                  <select required value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all h-10 cursor-pointer">
                    <option value="">-- Choose Route --</option>
                    {workflows.map(w => <option key={w._id} value={w._id}>{w.name || w.code}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500">Source Sales Order *</label>
                  <select required value={selectedSalesOrder} onChange={(e) => handleSalesOrderChange(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all h-10 cursor-pointer">
                    <option value="">-- Map Sales Contract --</option>
                    {salesOrders.map(s => <option key={s._id} value={s._id}>{s.orderRef} - {s.buyerName}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500">Approved Costing Sheet *</label>
                  <select required value={selectedCosting} onChange={(e) => setSelectedCosting(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all h-10 cursor-pointer">
                    <option value="">-- Mapped Cost Matrix --</option>
                    {costings.filter(c => c.status === 'Completed').map((c) => {
                      const displayCostingNo = c.costingNo || `CST-${c._id?.toString().slice(-5).toUpperCase()}`;
                      return (
                        <option key={c._id} value={c._id}>
                          {displayCostingNo} - (LKR {c.grandTotal?.toLocaleString()})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {loadedGarmentQuantities.length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-slate-800 text-xs font-bold uppercase tracking-wider">Loaded Size Specs From Contract Profile</div>
                  <div className="flex gap-2 flex-wrap">
                    {loadedGarmentQuantities.map((q, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-white border border-slate-200 font-mono rounded-lg text-slate-800 text-sm">
                        {getSize(q.size)}: {Number(q.orderQty !== undefined ? q.orderQty : q.quantity || q.qty || 0).toLocaleString()} Pcs
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500">Remarks</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Process worksheet note..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm h-20 resize-none focus:outline-none focus:border-emerald-800 transition-all" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold border-none cursor-pointer text-sm transition-all">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-semibold flex items-center justify-center border-none cursor-pointer text-sm transition-all disabled:opacity-60">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : 'Save Production Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductionOrders;
