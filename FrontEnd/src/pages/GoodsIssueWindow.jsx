import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ArrowLeft, Send, CheckCircle, AlertCircle, Package, Save } from 'lucide-react';

const GoodsIssueWindow = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [issueData, setIssueData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [editableItems, setEditableItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvaling, setApprovaling] = useState(false);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [issueRes, whRes, stockRes] = await Promise.all([
          axios.get('http://192.168.1.30:5003/api/material-issues'),
          axios.get('http://192.168.1.30:5003/api/warehouses'),
          axios.get('http://192.168.1.30:5003/api/stocks').catch(() => ({ data: [] }))
        ]);

        const currentIssue = issueRes.data.find(i => i._id === id);
        setIssueData(currentIssue);

        if (currentIssue?.warehouse) {
          setSelectedWarehouse(currentIssue.warehouse._id || currentIssue.warehouse);
        }

        // ✅ setup editable items — issueQty defaults to allocatedQty
        if (currentIssue?.items) {
          setEditableItems(currentIssue.items.map(item => ({
            materialId: item.material?._id || item.material,
            colorId: item.color?._id || item.color,
            materialName: item.material?.materialName || 'Material',
            itemCode: item.material?.itemCode || 'MAT',
            colorName: item.color?.name || item.color?.colorName || 'Default',
            uom: item.uom || 'Pcs',
            allocatedQty: Number(item.allocatedQty || 0),
            issueQty: Number(item.issuedQty || item.allocatedQty || 0),
            value: item.value || 0
          })));
        }

        setWarehouses(whRes.data || []);
        setStocks(stockRes.data || []);
        setLoading(false);
      } catch (err) {
        console.error("❌ Failed to load issue data:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // ✅ get available stock for material/color in selected warehouse
  const getAvailableStock = (materialId, colorId) => {
    if (!materialId || !selectedWarehouse) return 0;

    const stockEntry = stocks.find(s => {
      const sMatId = s.material?._id || s.material;
      const sColId = s.color?._id || s.color;
      const sWhId = s.warehouse?._id || s.warehouse;

      return String(sMatId) === String(materialId) &&
             String(sColId) === String(colorId) &&
             String(sWhId) === String(selectedWarehouse);
    });

    return stockEntry ? Number(stockEntry.qty || 0) : 0;
  };

  // ✅ handle issue qty change with validation
  const handleIssueQtyChange = (index, value) => {
    const numValue = Number(value) || 0;
    const item = editableItems[index];
    const availableStock = getAvailableStock(item.materialId, item.colorId);

    // ✅ VALIDATION 1 — cannot be negative
    if (numValue < 0) {
      alert("Issue quantity cannot be negative.");
      return;
    }

    // ✅ VALIDATION 2 — cannot exceed allocated qty
    if (numValue > item.allocatedQty) {
      alert(`Cannot issue more than Allocated Quantity (${item.allocatedQty.toLocaleString()}).`);
      return;
    }

    // ✅ VALIDATION 3 — cannot exceed available stock
    if (numValue > availableStock) {
      alert(`⚠️ Insufficient Stock!\n\nAvailable in warehouse: ${availableStock.toLocaleString()}\nRequested: ${numValue.toLocaleString()}`);
      return;
    }

    const updated = [...editableItems];
    updated[index].issueQty = numValue;
    setEditableItems(updated);
  };

  // ✅ Save Draft
  const handleSaveDraft = async () => {
    if (!selectedWarehouse) {
      alert("Please select a warehouse.");
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(
        `http://192.168.1.30:5003/api/material-issues/update-items/${id}`,
        {
          warehouse: selectedWarehouse,
          items: editableItems.map(item => ({
            material: item.materialId,
            color: item.colorId,
            uom: item.uom,
            allocatedQty: item.allocatedQty,
            issuedQty: item.issueQty,
            value: item.value
          }))
        }
      );
      alert("Draft saved successfully.");
      setIssueData(prev => ({
        ...prev,
        warehouse: { _id: selectedWarehouse },
        items: editableItems.map(item => ({
          material: { _id: item.materialId, materialName: item.materialName, itemCode: item.itemCode },
          color: { _id: item.colorId, name: item.colorName },
          uom: item.uom,
          allocatedQty: item.allocatedQty,
          issuedQty: item.issueQty
        }))
      }));
    } catch (err) {
      console.error("❌ Save failed:", err);
      alert("Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Submit for Approval — save items first, then submit
  const handleSubmitForApproval = async () => {
    if (!issueData?.workflow) {
      alert("No workflow assigned to this issue. Please recreate with a workflow.");
      return;
    }

    if (!selectedWarehouse) {
      alert("Please select a warehouse before submitting.");
      return;
    }

    // ✅ validate all items
    for (let item of editableItems) {
      if (item.issueQty <= 0) {
        alert(`Please enter Issue Qty for ${item.materialName}.`);
        return;
      }
      const availableStock = getAvailableStock(item.materialId, item.colorId);
      if (item.issueQty > availableStock) {
        alert(`Insufficient stock for ${item.materialName}. Available: ${availableStock}, Requested: ${item.issueQty}`);
        return;
      }
    }

    if (!window.confirm("Submit this Material Issue for approval? This will lock the issue quantities.")) return;

    try {
      setApprovaling(true);

      // ✅ save latest items
      await axios.put(
        `http://192.168.1.30:5003/api/material-issues/update-items/${id}`,
        {
          warehouse: selectedWarehouse,
          items: editableItems.map(item => ({
            material: item.materialId,
            color: item.colorId,
            uom: item.uom,
            allocatedQty: item.allocatedQty,
            issuedQty: item.issueQty,
            value: item.value
          }))
        }
      );

      // ✅ submit for approval
      const res = await axios.post(
        `http://192.168.1.30:5003/api/material-issues/submit-approval/${id}`,
        { createdBy: currentUsername }
      );

      alert(`Material Issue submitted for approval! Assigned to: ${res.data.approver}`);
      setIssueData(prev => ({ ...prev, status: 'Pending Approval' }));
    } catch (err) {
      console.error("❌ Submit approval failed:", err);
      alert(err.response?.data?.message || "Failed to submit for approval.");
    } finally {
      setApprovaling(false);
    }
  };

  if (loading) return (
    <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
      <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading Goods Issue Sheet...
    </div>
  );

  if (!issueData) return (
    <div className="p-8 text-rose-600 font-bold text-sm">
      Goods Issue Record Not Found.
      <button onClick={() => navigate('/material-issuing')} className="underline text-slate-600 ml-2">Go Back</button>
    </div>
  );

  const isIssued = issueData.status === 'ISSUED';
  const isPendingApproval = issueData.status === 'Pending Approval';
  const isDraft = issueData.status === 'PENDING_ISSUE' || issueData.status === 'DRAFT';

  const totalAllocated = editableItems.reduce((sum, i) => sum + Number(i.allocatedQty || 0), 0);
  const totalIssue = editableItems.reduce((sum, i) => sum + Number(i.issueQty || 0), 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm font-normal text-slate-700">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/material-issuing')}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors border-none cursor-pointer bg-slate-50"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Goods Issue — {issueData.issueNo || `ISS-${issueData._id?.slice(-6).toUpperCase()}`}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter actual issue quantities. Validated against Allocated and Available Stock.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${
            isIssued
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isPendingApproval
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {isIssued
              ? <><CheckCircle size={12} /> ISSUED</>
              : isPendingApproval
              ? <><AlertCircle size={12} /> PENDING APPROVAL</>
              : <><Package size={12} /> DRAFT</>
            }
          </span>
          <div className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            {new Date(issueData.createdAt).toISOString().split('T')[0]}
          </div>
        </div>
      </div>

      {/* INFO CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sales Order</span>
          <div className="text-sm font-bold text-emerald-900 mt-1">
            {issueData.salesOrder?.orderRef || 'N/A'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Production Order</span>
          <div className="text-sm font-bold text-slate-800 mt-1">
            {issueData.productionOrder?.productionOrderNo || 'N/A'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Approval Workflow</span>
          <div className={`text-sm font-bold mt-1 ${issueData.workflow ? 'text-slate-800' : 'text-rose-600'}`}>
            {issueData.workflow?.code || issueData.workflow?.name || '⚠️ Not Assigned'}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Items</span>
          <div className="text-sm font-bold text-slate-800 mt-1">
            {editableItems.length} Items
          </div>
        </div>
      </div>

      {/* WAREHOUSE SELECTOR */}
      {isDraft && (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">
            Target Warehouse *
          </label>
          <div className="flex gap-3 items-center max-w-lg">
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:border-slate-400 text-slate-800 cursor-pointer"
            >
              <option value="">-- Select Target Warehouse --</option>
              {warehouses.map(wh => (
                <option key={wh._id} value={wh._id}>
                  {wh.warehouseCode ? `${wh.warehouseCode} - ` : ''}{wh.warehouseName || wh.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={submitting || !selectedWarehouse}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer border-none transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <><Save size={14} /> Save</>}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Stock will be checked and deducted from this warehouse on approval.
          </p>
        </div>
      )}

      {(isPendingApproval || isIssued) && (
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Source Warehouse</span>
          <div className="text-sm font-bold text-emerald-900 mt-1">
            {issueData.warehouse?.warehouseName ||
             warehouses.find(w => w._id === (issueData.warehouse?._id || issueData.warehouse))?.warehouseName ||
             'Main Store'}
          </div>
        </div>
      )}

      {/* ✅ ITEMS TABLE — with editable Issue Qty */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">BOM Items to Issue</span>
          </div>
          {isDraft && (
            <span className="text-[11px] text-slate-500 italic">
              💡 Issue Qty must be ≤ Allocated and ≤ Available Stock
            </span>
          )}
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-normal tracking-wider text-xs uppercase">
                <th className="p-3 px-4 w-10">#</th>
                <th className="p-3 px-4">Material Code</th>
                <th className="p-3 px-4">Material Name</th>
                <th className="p-3 px-4">Color</th>
                <th className="p-3 px-4 text-center">UOM</th>
                <th className="p-3 px-4 text-right bg-slate-100">Allocated Qty</th>
                <th className="p-3 px-4 text-right text-emerald-800">Available Stock</th>
                <th className="p-3 px-4 text-right bg-amber-50 text-amber-800">Issue Qty *</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {editableItems.length > 0 ? (
                editableItems.map((item, idx) => {
                  const availableStock = getAvailableStock(item.materialId, item.colorId);
                  const isLowStock = availableStock < item.allocatedQty;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 px-4 text-slate-400 text-xs font-mono">{idx + 1}</td>
                      <td className="p-3 px-4 text-slate-500 font-mono text-xs font-bold">
                        {item.itemCode}
                      </td>
                      <td className="p-3 px-4 font-medium text-slate-900">
                        {item.materialName}
                      </td>
                      <td className="p-3 px-4 text-slate-600">
                        {item.colorName}
                      </td>
                      <td className="p-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-xs font-semibold text-slate-600">
                          {item.uom}
                        </span>
                      </td>

                      {/* Allocated Qty — read only */}
                      <td className="p-3 px-4 text-right font-mono font-bold text-slate-800 bg-slate-50">
                        {item.allocatedQty.toLocaleString()}
                      </td>

                      {/* Available Stock */}
                      <td className={`p-3 px-4 text-right font-mono font-bold ${isLowStock ? 'text-rose-600' : 'text-emerald-800'}`}>
                        {availableStock.toLocaleString()}
                        {isLowStock && (
                          <div className="text-[9px] uppercase font-bold text-rose-500 mt-0.5">
                            ⚠️ Short {(item.allocatedQty - availableStock).toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* ✅ Issue Qty — EDITABLE INPUT in Draft */}
                      <td className="p-3 px-4 text-right bg-amber-50/40">
                        {isDraft ? (
                          <input
                            type="number"
                            min="0"
                            max={Math.min(item.allocatedQty, availableStock)}
                            value={item.issueQty}
                            onChange={(e) => handleIssueQtyChange(idx, e.target.value)}
                            className="w-28 px-2 py-1.5 bg-white border border-amber-300 rounded-lg text-right text-sm font-bold text-amber-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                          />
                        ) : (
                          <span className="font-mono font-bold text-emerald-900">
                            {Number(item.issueQty || 0).toLocaleString()}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="p-16 text-center text-slate-400 italic">
                    No items found in this issue sheet.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Totals */}
            {editableItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan="5" className="p-3 px-4 text-right text-xs font-bold text-slate-500 uppercase">
                    TOTAL
                  </td>
                  <td className="p-3 px-4 text-right font-mono font-black text-slate-800 bg-slate-100">
                    {totalAllocated.toLocaleString()}
                  </td>
                  <td className="p-3 px-4"></td>
                  <td className="p-3 px-4 text-right font-mono font-black text-emerald-900 bg-amber-50">
                    {totalIssue.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Warning if no workflow */}
      {isDraft && !issueData.workflow && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertCircle size={16} />
          <span>⚠️ This issue has no workflow assigned. Cannot submit for approval.</span>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex justify-between items-center pt-2 pb-6">
        <button
          type="button"
          onClick={() => navigate('/material-issuing')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200 transition-all"
        >
          ← Back to List
        </button>

        <div className="flex gap-3 items-center">
          {isDraft && (
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={approvaling || !issueData.workflow || !selectedWarehouse}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold cursor-pointer border-none shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {approvaling
                ? <Loader2 className="animate-spin" size={14} />
                : <><Send size={14} /> Submit for Approval</>
              }
            </button>
          )}

          {isPendingApproval && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-600" />
              <span className="text-xs text-amber-700 font-semibold">
                Awaiting approval. Issue is locked.
              </span>
            </div>
          )}

          {isIssued && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle size={14} className="text-emerald-600" />
              <span className="text-xs text-emerald-700 font-semibold">
                Issue completed. Stock has been deducted from warehouse.
              </span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default GoodsIssueWindow;