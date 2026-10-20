import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Send, CheckCircle, AlertCircle, Save, Printer } from 'lucide-react';
import { API_URL } from '../api/config';

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Formats a date as YYYY-MM-DD, or '-' if the value is missing or invalid
const formatDate = (value) => {
  const date = new Date(value);
  return isNaN(date) ? '-' : date.toISOString().split('T')[0];
};

const GoodsIssueWindow = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [issueData, setIssueData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [editableItems, setEditableItems] = useState([]);
  const [cmCost, setCmCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [approvaling, setApprovaling] = useState(false);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  // Loads the issue, warehouses, stock, costing and production order data for this page
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [issueRes, whRes, stockRes, costingRes, poRes] = await Promise.all([
          axios.get(`${API_URL}/material-issues`),
          axios.get(`${API_URL}/warehouses`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/stocks`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/costing`).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/production-orders`).catch(() => ({ data: [] }))
        ]);

        const issues = toArray(issueRes.data);
        const costings = toArray(costingRes.data);
        const productionOrders = toArray(poRes.data);

        const currentIssue = issues.find(i => String(i._id) === String(id));
        setIssueData(currentIssue || null);

        if (currentIssue?.warehouse) {
          setSelectedWarehouse(currentIssue.warehouse._id || currentIssue.warehouse);
        }

        // Find the costing linked to this issue, to show its CM cost
        if (currentIssue) {
          let matchedCosting = null;
          const poId = currentIssue.productionOrder?._id || currentIssue.productionOrder;
          const soId = currentIssue.salesOrder?._id || currentIssue.salesOrder;

          // 1. Match through the production order
          if (poId) {
            const currentPo = productionOrders.find(p => String(p._id) === String(poId));
            const poSoId = currentPo?.salesOrder?._id || currentPo?.salesOrder;

            matchedCosting = costings.find(c => {
              const cPoId = c.productionOrder?._id || c.productionOrder;
              const cSoId = c.salesOrder?._id || c.salesOrder;
              return (cPoId && String(cPoId) === String(poId)) || (poSoId && cSoId && String(cSoId) === String(poSoId));
            });
          }

          // 2. Fall back to matching through the sales order
          if (!matchedCosting && soId) {
            matchedCosting = costings.find(c => {
              const cSoId = c.salesOrder?._id || c.salesOrder;
              return cSoId && String(cSoId) === String(soId);
            });
          }

          if (matchedCosting) {
            setCmCost(Number(matchedCosting.cmCost || matchedCosting.totalCmCost || 0));
          }
        }

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

        setWarehouses(toArray(whRes.data));
        setStocks(toArray(stockRes.data));
        setLoading(false);
      } catch (err) {
        console.error('Failed to load issue data:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Returns the available stock of a material in the selected warehouse
  const getAvailableStock = (materialId) => {
    if (!materialId || !selectedWarehouse) return 0;
    const stockEntry = stocks.find(s => {
      const sMatId = s.material?._id || s.material;
      const sWhId = s.warehouse?._id || s.warehouse;
      return String(sMatId) === String(materialId) && String(sWhId) === String(selectedWarehouse);
    });
    return stockEntry ? Number(stockEntry.qty || 0) : 0;
  };

  // Updates the issue quantity of one row, within the allocated limit
  const handleIssueQtyChange = (index, value) => {
    const numValue = Number(value) || 0;
    const item = editableItems[index];

    if (numValue < 0) {
      alert('Issue quantity cannot be negative.');
      return;
    }

    if (numValue > item.allocatedQty) {
      alert(`Cannot issue more than Allocated Quantity (${item.allocatedQty.toLocaleString()}).`);
      return;
    }

    const updated = [...editableItems];
    updated[index] = { ...updated[index], issueQty: numValue };
    setEditableItems(updated);
  };

  // Builds the item payload sent to the server
  const buildItemsPayload = () => editableItems.map(item => ({
    material: item.materialId,
    color: item.colorId,
    uom: item.uom,
    allocatedQty: item.allocatedQty,
    issuedQty: item.issueQty,
    value: item.value
  }));

  // Saves the warehouse and item quantities as a draft
  const handleSaveDraft = async () => {
    if (!selectedWarehouse) {
      alert('Please select a warehouse.');
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(`${API_URL}/material-issues/update-items/${id}`, {
        warehouse: selectedWarehouse,
        items: buildItemsPayload()
      });
      alert('Draft saved successfully.');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  // Saves the current quantities, then submits the issue for approval
  const handleSubmitForApproval = async () => {
    if (!issueData?.workflow) {
      alert('No workflow assigned to this issue. Please recreate with a workflow.');
      return;
    }

    if (!selectedWarehouse) {
      alert('Please select a warehouse before submitting.');
      return;
    }

    for (const item of editableItems) {
      if (item.issueQty <= 0) {
        alert(`Please enter Issue Qty for ${item.materialName}.`);
        return;
      }
    }

    if (!window.confirm('Submit this Material Issue for approval?')) return;

    try {
      setApprovaling(true);
      await axios.put(`${API_URL}/material-issues/update-items/${id}`, {
        warehouse: selectedWarehouse,
        items: buildItemsPayload()
      });

      const res = await axios.post(`${API_URL}/material-issues/submit-approval/${id}`, {
        createdBy: currentUsername
      });

      alert(`Material Issue submitted for approval! Assigned to: ${res.data?.approver || 'the assigned approver'}`);
      setIssueData(prev => ({ ...prev, status: 'Pending Approval' }));
    } catch (err) {
      console.error('Submit approval failed:', err);
      alert(err.response?.data?.message || 'Failed to submit for approval.');
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

  const totalIssue = editableItems.reduce((sum, i) => sum + Number(i.issueQty || 0), 0);

  const warehouseName = issueData.warehouse?.warehouseName ||
    warehouses.find(w => String(w._id) === String(issueData.warehouse?._id || issueData.warehouse))?.warehouseName ||
    'Main Store';

  const plantName = issueData.plant?.name || issueData.plant?.factoryCode || 'N/A';

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700">

      {/* A4 print styles (borders and headers/footers removed) */}
      <style>{`
        @media print {
          body > *:not(#root) {
            display: none !important;
          }
          #root > *:not(div) {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .printable-sheet, .printable-sheet * {
            visibility: visible;
          }
          .printable-sheet {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            z-index: 99999;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px;
          }
          th, td {
            border: 1px solid #94a3b8 !important;
            padding: 8px 10px !important;
            font-size: 10pt !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: black !important;
            text-transform: uppercase;
          }
          .print-signatures {
            display: flex !important;
            justify-content: space-between;
            margin-top: 90px;
            page-break-inside: avoid;
          }
        }
        .print-signatures {
          display: none;
        }
      `}</style>

      {/* Printable sheet */}
      <div className="printable-sheet space-y-6 bg-white p-6 rounded-xl border border-slate-200">

        {/* HEADER */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-wider">Elisha Clothing (Pvt) Ltd</h1>
            <p className="text-xs text-slate-500 font-semibold mt-1">GOOD ISSUE NOTE</p>
          </div>
          <div className="text-right text-xs space-y-1 font-medium">
            <div>ISSUE NO : <span className="font-bold text-slate-900">{issueData.issueNo || `ISS-${issueData._id?.slice(-6).toUpperCase()}`}</span></div>
            <div>DATE : <span className="font-bold">{formatDate(issueData.createdAt)}</span></div>
          </div>
        </div>

        {/* INFO SECTION */}
        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div>SALES ORDER REF : <span className="font-bold text-slate-900">{issueData.salesOrder?.orderRef || 'N/A'}</span></div>
          <div>PRODUCTION ORDER : <span className="font-bold text-slate-900">{issueData.productionOrder?.productionOrderNo || 'N/A'}</span></div>
          <div>WAREHOUSE : <span className="font-bold text-slate-900">{warehouseName}</span></div>
          <div>PLANT / FACTORY : <span className="font-bold text-slate-900">{plantName}</span></div>
          <div className="col-span-2">WORKFLOW : <span className="font-bold text-slate-900">{issueData.workflow?.code || issueData.workflow?.name || 'N/A'}</span></div>
          <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-700 uppercase">Styling CM Charges / Cost:</span>
            <span className="font-black text-emerald-900 text-sm">LKR {cmCost.toLocaleString()}</span>
          </div>
        </div>

        {/* WAREHOUSE SELECTOR */}
        {isDraft && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 no-print">
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-2">Target Warehouse *</label>
            <div className="flex gap-3 items-center max-w-lg">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none text-slate-800 cursor-pointer"
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
          </div>
        )}

        {/* ITEMS TABLE */}
        <div className="rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-sm border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold tracking-wider text-xs uppercase">
                  <th className="p-3 px-4 w-10 border border-slate-300 text-center">#</th>
                  <th className="p-3 px-4 border border-slate-300">Material Code</th>
                  <th className="p-3 px-4 border border-slate-300">Material Name</th>
                  <th className="p-3 px-4 text-center border border-slate-300">UOM</th>
                  <th className="p-3 px-4 text-right border border-slate-300 no-print">Available Stock</th>
                  <th className="p-3 px-4 text-right border border-slate-300">Issue Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {editableItems.length > 0 ? (
                  editableItems.map((item, idx) => {
                    const availableStock = getAvailableStock(item.materialId);

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 px-4 text-center font-mono text-xs border border-slate-200">{idx + 1}</td>
                        <td className="p-3 px-4 font-mono text-xs font-bold border border-slate-200">{item.itemCode}</td>
                        <td className="p-3 px-4 font-medium border border-slate-200">{item.materialName}</td>
                        <td className="p-3 px-4 text-center border border-slate-200 font-medium text-slate-600">
                          {item.uom}
                        </td>
                        <td className="p-3 px-4 text-right font-mono font-bold text-emerald-800 border border-slate-200 no-print">
                          {availableStock.toLocaleString()}
                        </td>
                        <td className="p-3 px-4 text-right font-mono font-bold border border-slate-200 bg-amber-50/20">
                          {isDraft ? (
                            <input
                              type="number"
                              min="0"
                              max={item.allocatedQty}
                              value={item.issueQty}
                              onChange={(e) => handleIssueQtyChange(idx, e.target.value)}
                              className="w-24 px-2 py-1 bg-white border border-amber-300 rounded text-right text-sm font-bold focus:outline-none no-print"
                            />
                          ) : (
                            <span>{Number(item.issueQty || 0).toLocaleString()}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="p-16 text-center text-slate-400 italic border border-slate-200">No items found.</td>
                  </tr>
                )}
              </tbody>

              {editableItems.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                    <td colSpan="4" className="p-3 px-4 text-right text-xs uppercase border border-slate-300">TOTAL</td>
                    <td className="p-3 px-4 border border-slate-300 no-print"></td>
                    <td className="p-3 px-4 text-right font-mono border border-slate-300">{totalIssue.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* PRINT SIGNATURE BLOCK */}
        <div className="print-signatures pt-8">
          <div className="text-center w-1/3">
            <p className="border-t border-black pt-1 font-semibold text-xs inline-block w-30">Customer Signature</p>
          </div>
          <div className="text-center w-1/3">
            <p className="border-t border-black pt-1 font-semibold text-xs inline-block w-30">Prepared By</p>
          </div>
          <div className="text-center w-1/3">
            <p className="border-t border-black pt-1 font-semibold text-xs inline-block w-30">Checked By</p>
          </div>
          <div className="text-center w-1/3">
            <p className="border-t border-black pt-1 font-semibold text-xs inline-block w-30">Authorized Signature</p>
          </div>
        </div>

      </div>

      {/* ACTION BUTTONS */}
      <div className="flex justify-between items-center pt-2 pb-6 no-print">
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
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold cursor-pointer border-none shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              {approvaling ? <Loader2 className="animate-spin" size={14} /> : <><Send size={14} /> Submit for Approval</>}
            </button>
          )}

          {isPendingApproval && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-600" />
              <span className="text-xs text-amber-700 font-semibold">Awaiting approval. Issue is locked.</span>
            </div>
          )}

          {isIssued && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={14} className="text-emerald-600" />
                <span className="text-xs text-emerald-700 font-semibold">Issue completed.</span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} /> Print Goods Issue
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default GoodsIssueWindow;