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

const ProductionOrders = () => {
  const [orders, setOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [costings, setCostings] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [sizes, setSizes] = useState([]);

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
      const [poRes, soRes, costingRes, wfRes, sizeRes] = await Promise.all([
        axios.get(`${API_URL}/production-orders`),
        axios.get(`${API_URL}/sales-orders`),
        axios.get(`${API_URL}/costing`),
        axios.get(`${API_URL}/workflows`),
        axios.get(`${API_URL}/sizes`).catch(() => ({ data: [] }))
      ]);
      setOrders(toArray(poRes.data));
      setSalesOrders(toArray(soRes.data));
      setCostings(toArray(costingRes.data));
      setWorkflows(toArray(wfRes.data));

      // Sizes may come back as a plain array or wrapped in an object
      const rawSizes = sizeRes.data;
      setSizes(Array.isArray(rawSizes) ? rawSizes : toArray(rawSizes?.data || rawSizes?.sizes));
      setLoading(false);
    } catch (err) {
      console.error('Error loading production registry:', err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Shortcut to get the display label for a size value
  const getSize = (size) => getSizeLabel(size, sizes);

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

  // Calculates the BOM and shortages for a completed production order
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

      const resolvedGarments = (orderObj.garmentQuantities && orderObj.garmentQuantities.length > 0)
        ? orderObj.garmentQuantities
        : (orderObj.salesOrder?.items || []).reduce((acc, curr) => {
            const existing = acc.find(item => item.size === curr.size);
            if (existing) {
              existing.orderQty += Number(curr.quantity || curr.qty || 0);
            } else {
              acc.push({ size: curr.size || 'M', orderQty: Number(curr.quantity || curr.qty || 0) });
            }
            return acc;
          }, []);

      const totalGarmentQty = resolvedGarments.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0);

      const calculatedShortageBOM = await Promise.all(costingItems.map(async (cItem) => {
        const materialObj = cItem.material && typeof cItem.material === 'object' ? cItem.material : null;
        const materialId = materialObj ? materialObj._id : cItem.material;
        const colorObj = cItem.color && typeof cItem.color === 'object' ? cItem.color : null;
        const colorId = colorObj ? colorObj._id : cItem.color;

        const consumption = Number(cItem.consumption !== undefined ? cItem.consumption : cItem.yield || 0);
        const wastage = Number(cItem.wastagePercentage !== undefined ? cItem.wastagePercentage : 0);
        const totalRequired = totalGarmentQty * consumption * (1 + (wastage / 100));

        const stockRes = await axios.get(`${API_URL}/stocks`).catch(() => ({ data: [] }));
        const currentStockObj = toArray(stockRes.data).find(s => {
          const sMatId = s.material && typeof s.material === 'object' ? s.material._id : s.material;
          const sColId = s.color && typeof s.color === 'object' ? s.color._id : s.color;
          return String(sMatId) === String(materialId) && String(sColId) === String(colorId);
        });

        const availableStock = currentStockObj ? (currentStockObj.qty || currentStockObj.quantity || 0) : 0;
        const shortage = totalRequired > availableStock ? (totalRequired - availableStock) : 0;

        return {
          material: materialId,
          color: colorId,
          materialName: materialObj?.materialName || cItem.materialName || 'Component Material',
          itemCode: materialObj?.itemCode || cItem.itemCode || 'MAT',
          colorName: colorObj?.colorName || colorObj?.name || 'Standard Shade',
          uom: cItem.uom || 'Pcs',
          consumption,
          wastage,
          requiredQty: totalRequired,
          availableStockQty: availableStock,
          shortageQty: shortage
        };
      }));

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
      <div className="p-12 text-base flex items-center justify-center gap-2 text-slate-500 font-sans tracking-wide">
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

  // Returns the badge classes for a production order status
  const getStatusStyle = (status) => {
    if (status === 'Completed') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (status === 'Pending Approval') return 'bg-amber-50 text-amber-800 border-amber-200';
    if (status === 'Cancelled') return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm font-normal text-slate-700 font-sans tracking-wide">

      {/* VIEW 1: LIST */}
      {isListView && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 w-full">
            <div>
              <h1 className="text-2xl font-normal text-slate-900 tracking-tight">Production Sheets Dashboard</h1>
              <p className="text-sm text-slate-500 font-normal mt-1">Log line routing schedules and click any sheet row to open full workstation profiles.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-normal text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all gap-2 border-none cursor-pointer"
            >
              <Plus size={18} /> Add Production Order
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center w-full">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"><Search size={18} /></span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search routing PO# worksheets..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:border-slate-400 transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full">
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-normal tracking-wider text-sm">
                    <th className="p-4 px-6 font-normal">PO Number</th>
                    <th className="p-4 font-normal">Sales Contract Ref</th>
                    <th className="p-4 font-normal">Target Deadline</th>
                    <th className="p-4 font-normal">Plant Line Routing</th>
                    <th className="p-4 font-normal">Worksheet Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
                  {filteredOrders.length > 0 ? filteredOrders.map((order) => {
                    const displayPoNo = order.productionOrderNo || `PROD-${order._id.slice(-5).toUpperCase()}`;
                    return (
                      <tr
                        key={order._id}
                        onClick={() => handleOpenOrderSheet(order)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="p-4 px-6 text-base text-slate-900 font-mono font-bold">{displayPoNo}</td>
                        <td className="p-4 text-base text-slate-800">{order.salesOrder?.orderRef || 'N/A'}</td>
                        <td className="p-4 text-sm text-slate-500">{formatDate(order.targetDate)}</td>
                        <td className="p-4 text-base text-emerald-900">{order.workflow?.name || order.workflow?.code || 'Standard Line'}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 border rounded text-xs font-normal ${getStatusStyle(order.status)}`}>
                            {order.status || 'Draft'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-slate-400 italic">No production orders registered.</td>
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

          <div className="flex justify-between items-center">
            <button
              onClick={handleCloseOrderSheet}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-normal text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <ArrowLeft size={16} /> Back to Registry
            </button>
            <div className="text-sm font-normal px-5 py-2.5 bg-white rounded-lg border border-slate-200 flex gap-6">
              <span>Worksheet: <span className="text-slate-900 font-mono text-base font-bold">{selectedOrder.productionOrderNo || `PROD-${selectedOrder._id.slice(-5).toUpperCase()}`}</span></span>
              <span>Status: <span className={`text-base font-semibold ${selectedOrder.status === 'Completed' ? 'text-emerald-700' : selectedOrder.status === 'Pending Approval' ? 'text-amber-600' : 'text-slate-700'}`}>{selectedOrder.status || 'Draft'}</span></span>
              <span>Contract: <span className="text-emerald-900 text-base">{selectedOrder.salesOrder?.orderRef || 'SO'}</span></span>
            </div>
          </div>

          <div className="flex items-center gap-8 px-6 pt-3 border-b bg-white border-slate-200 rounded-t-xl">
            <button
              type="button"
              onClick={() => setActiveSubTab('plan')}
              className={`pb-3 text-base font-normal uppercase tracking-wider flex items-center gap-1.5 bg-transparent border-none focus:outline-none transition-all cursor-pointer ${activeSubTab === 'plan' ? 'text-slate-900 border-b-2 border-solid border-slate-900' : 'text-slate-400'}`}
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
              className={`pb-3 text-base font-normal uppercase tracking-wider flex items-center gap-1.5 bg-transparent border-none focus:outline-none transition-all cursor-pointer ${selectedOrder.status !== 'Completed' && !hasBOMAlreadyCreated ? 'opacity-40 cursor-not-allowed text-slate-400' : activeSubTab === 'bom' ? 'text-slate-900 border-b-2 border-solid border-slate-900' : 'text-slate-400'}`}
            >
              {bomLoadingId === selectedOrder._id ? <Loader2 className="animate-spin text-slate-400" size={14} /> : 'BOM'} <Info size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="bg-white p-6 rounded-b-xl border-x border-b border-slate-200 space-y-6">

            {/* PLAN TAB */}
            {activeSubTab === 'plan' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="text-slate-900 font-normal text-base tracking-wide flex items-center gap-2">
                  <Layers size={18} className="text-slate-500" /> Production Order Layout Matrix
                </div>
                <div className="border border-slate-200 bg-white rounded-lg overflow-hidden w-full">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-sm font-normal text-slate-600 border-b border-slate-200">
                        <th className="p-3.5 text-center w-12 font-normal">#</th>
                        <th className="p-3.5 font-normal">Code</th>
                        <th className="p-3.5 font-normal">Material</th>
                        <th className="p-3.5 font-normal">Name</th>
                        <th className="p-3.5 font-normal">Schedule</th>
                        <th className="p-3.5 text-center font-normal">Size</th>
                        <th className="p-3.5 text-right font-normal">Planning Qty</th>
                        <th className="p-3.5 text-right font-normal">Actual Qty</th>
                        <th className="p-3.5 text-center font-normal">STS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                      {resolvedGarmentsList.map((g, gIdx) => (
                        <tr key={gIdx} className="hover:bg-slate-50/60">
                          <td className="p-3.5 text-center text-slate-400 text-base">{gIdx + 1}</td>
                          <td className="p-3.5 font-mono text-slate-900 text-base">JOB{String(selectedOrder.productionOrderNo || selectedOrder._id).replace(/\D/g, '').slice(-5) || '00'}{gIdx + 1}</td>
                          <td className="p-3.5 font-mono text-slate-600 text-base">{selectedOrder.salesOrder?.orderRef || 'SKU'}</td>
                          <td className="p-3.5 text-base">{selectedOrder.salesOrder?.buyerName || 'Garment Fabrication'} Run</td>
                          <td className="p-3.5 text-slate-500 text-base">Bulk</td>
                          <td className="p-3.5 text-center text-slate-900 font-mono text-base">{getSize(g.size)}</td>
                          <td className="p-3.5 text-right text-base">{Number(g.orderQty || 0).toLocaleString()}</td>
                          <td className="p-3.5 text-right text-slate-300 text-base">-</td>
                          <td className="p-3.5 text-center text-sm text-emerald-800">
                            {hasBOMAlreadyCreated ? 'BOM CREATED' : 'PENDING'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t border-slate-200 text-slate-900">
                        <td colSpan="6" className="p-3.5 text-right text-base">Total</td>
                        <td className="p-3.5 text-right text-base font-mono text-slate-900">
                          {resolvedGarmentsList.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0).toLocaleString()}.00
                        </td>
                        <td className="p-3.5 text-right text-slate-400 font-mono text-base">0.00</td>
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
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-normal flex items-center justify-center gap-2 border-none transition-all cursor-pointer text-sm disabled:opacity-60"
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
                      className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-normal flex items-center justify-center gap-2 border-none transition-all disabled:opacity-50 cursor-pointer text-sm"
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
                <div className="flex justify-between items-center">
                  <div className="text-emerald-950 font-normal text-base tracking-wide flex items-center gap-2">
                    <FileText size={18} className="text-emerald-800" /> Dynamic Bill of Materials Matrix (Auto Yield Formula View)
                  </div>

                  {hasShortages && !selectedOrder.poGenerated && (
                    <button
                      onClick={handleGeneratePurchaseOrderForShortage}
                      disabled={poGenerating}
                      type="button"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-normal transition-all border-none shadow-sm ${poGenerating ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'}`}
                    >
                      {poGenerating ? <Loader2 className="animate-spin" size={16} /> : <ShoppingCart size={16} />}
                      {poGenerating ? 'Generating PO...' : 'Create Purchase Order for Shortages'}
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 bg-white rounded-lg overflow-hidden w-full">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-sm font-normal text-slate-700 border-b border-slate-200">
                        <th className="p-3.5 px-4 font-normal">Component Profile</th>
                        <th className="p-3.5 font-normal">Shade</th>
                        <th className="p-3.5 text-center font-normal">UOM</th>
                        <th className="p-3.5 text-right font-normal">CNSM</th>
                        <th className="p-3.5 text-right font-normal">Wastage %</th>
                        <th className="p-3.5 text-right bg-slate-100/60 font-normal text-slate-900">Gross Required</th>
                        <th className="p-3.5 text-right text-emerald-900 font-normal">Store Stock</th>
                        <th className="p-3.5 text-right text-rose-700 font-normal">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                      {activeBOMData[selectedOrder._id].map((b, bIdx) => (
                        <tr key={bIdx} className="hover:bg-slate-50/60">
                          <td className="p-3.5 px-4 text-base text-slate-900">{b.materialName} <span className="text-slate-400 text-sm font-mono">({b.itemCode})</span></td>
                          <td className="p-3.5 text-base text-slate-600">{b.colorName}</td>
                          <td className="p-3.5 text-center font-mono text-slate-500 text-base">{b.uom}</td>
                          <td className="p-3.5 text-right font-mono text-slate-900 text-base">{Number(b.consumption || 0).toFixed(2)}</td>
                          <td className="p-3.5 text-right font-mono text-rose-600 text-base">{Number(b.wastage || 0)}%</td>
                          <td className="p-3.5 text-right bg-slate-50 text-slate-900 font-mono text-base">{Number(b.requiredQty || 0).toFixed(2)}</td>
                          <td className="p-3.5 text-right text-emerald-900 font-mono text-base">{Number(b.availableStockQty || 0).toFixed(2)}</td>
                          <td className="p-3.5 text-right text-rose-700 bg-rose-50/20 font-mono text-base">{b.shortageQty > 0 ? b.shortageQty.toFixed(2) : '0.00'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setActiveSubTab('plan')} type="button" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-normal transition-all border-none cursor-pointer text-sm">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-xl rounded-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-base font-normal text-slate-900 flex items-center gap-2"><ClipboardList size={18} className="text-slate-500" /> Initiate Production Run Sheet</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"><X size={20} /></button>
            </div>

            <form onSubmit={handleInitialPOSubmit} className="p-6 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-sm text-slate-600 font-normal">Target Date *</label>
                  <input type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal focus:outline-none focus:border-slate-400 h-10 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm text-slate-600 font-normal">Plant Line / Workflow *</label>
                  <select required value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal focus:outline-none focus:border-slate-400 h-10 transition-colors">
                    <option value="">-- Choose Route --</option>
                    {workflows.map(w => <option key={w._id} value={w._id}>{w.name || w.code}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm text-slate-600 font-normal">Source Sales Order *</label>
                  <select required value={selectedSalesOrder} onChange={(e) => handleSalesOrderChange(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal focus:outline-none focus:border-slate-400 h-10 transition-colors">
                    <option value="">-- Map Sales Contract --</option>
                    {salesOrders.map(s => <option key={s._id} value={s._id}>{s.orderRef} - {s.buyerName}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm text-slate-600 font-normal">Approved Costing Sheet *</label>
                  <select required value={selectedCosting} onChange={(e) => setSelectedCosting(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal focus:outline-none focus:border-slate-400 h-10 transition-colors">
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
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="text-slate-800 text-sm font-normal">Loaded Size Specs From Contract Profile:</div>
                  <div className="flex gap-2 flex-wrap">
                    {loadedGarmentQuantities.map((q, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-white border border-slate-200 font-mono rounded text-slate-800 text-sm font-normal">
                        {getSize(q.size)}: {Number(q.orderQty !== undefined ? q.orderQty : q.quantity || q.qty || 0).toLocaleString()} Pcs
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm text-slate-600 font-normal">Remarks</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Process worksheet note..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-normal h-20 resize-none focus:outline-none transition-colors" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-normal border-none cursor-pointer text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-normal flex items-center justify-center border-none cursor-pointer text-sm transition-colors disabled:opacity-60">
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
