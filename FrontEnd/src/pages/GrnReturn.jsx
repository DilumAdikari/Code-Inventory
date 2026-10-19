import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RotateCcw, Loader2, Plus, X, Save, ArrowLeft, CheckCircle2, Printer } from 'lucide-react';
import { API_URL } from "../api/config";

const GrnReturn = () => {
  const [returnsList, setReturnsList] = useState([]);
  const [grns, setGrns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState('');
  const [approvalWorkflow, setApprovalWorkflow] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);

  const [activeReturn, setActiveReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentUsername = localStorage.getItem('username') || 'ADMIN';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [retRes, grnRes, wfRes] = await Promise.all([
        axios.get('${API_URL}/grn-returns').catch(() => ({ data: [] })),
        axios.get('${API_URL}/grn').catch(() => ({ data: [] })),
        axios.get('${API_URL}/workflows').catch(() => ({ data: [] }))
      ]);

      setReturnsList(Array.isArray(retRes.data) ? retRes.data : (retRes.data?.data || []));

      const allGrns = Array.isArray(grnRes.data) ? grnRes.data : (grnRes.data?.data || []);
      const completedGrns = allGrns.filter(g => String(g.status || '').toUpperCase() === 'COMPLETED');
      setGrns(completedGrns.length > 0 ? completedGrns : allGrns);

      setWorkflows(Array.isArray(wfRes.data) ? wfRes.data : (wfRes.data?.data || []));
      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGrnChange = (grnNo) => {
    setSelectedGrn(grnNo);
  };

  const handleSaveDraftReturn = async (e) => {
    e.preventDefault();

    if (!selectedGrn) {
      alert("Please select a GRN.");
      return;
    }

    if (!approvalWorkflow) {
      alert("Please select an Approval Workflow.");
      return;
    }

    try {
      setSubmitting(true);
      const grnRes = await axios.get('${API_URL}/grn');
      const allGrns = Array.isArray(grnRes.data) ? grnRes.data : (grnRes.data?.data || []);
      const targetGrn = allGrns.find(g => g.grnNo === selectedGrn);

      const firstItem = targetGrn?.items && targetGrn.items.length > 0 ? targetGrn.items[0] : null;
      const warehouseId = 
        firstItem?.storeLocation?._id || 
        firstItem?.storeLocation || 
        targetGrn?.warehouse?._id || 
        targetGrn?.warehouse || 
        null;

      const formattedItems = (targetGrn?.items || []).map(item => {
        const mat = item.material;
        const col = item.color;
        const sz = item.size;

        const resolvedItemName = 
          (typeof mat === 'object' && mat !== null ? (mat.itemName || mat.materialName || mat.name) : null) || 
          item.itemName || 
          item.materialName || 
          'Material Item';

        const resolvedColorName = 
          (typeof col === 'object' && col !== null ? (col.name || col.colorName) : null) || 
          item.colorName || 
          '-';

        const resolvedSizeName = 
          (typeof sz === 'object' && sz !== null ? (sz.sizeCode || sz.name) : null) || 
          item.sizeName || 
          '-';

        return {
          material: typeof mat === 'object' && mat !== null ? mat._id : mat,
          color: typeof col === 'object' && col !== null ? col._id : col,
          size: typeof sz === 'object' && sz !== null ? sz._id : sz,
          uom: item.uom || 'Pcs',
          itemName: resolvedItemName,
          colorName: resolvedColorName,
          sizeName: resolvedSizeName,
          receivedQty: item.receivedQty || item.qty || 0,
          returnQty: 0
        };
      });

      const payload = {
        grnNo: selectedGrn,
        warehouse: warehouseId,
        approvalWorkflow: approvalWorkflow,
        returnDate: returnDate,
        items: formattedItems, 
        returnedBy: currentUsername
      };

      await axios.post('${API_URL}/grn-returns/initialize', payload);
      alert("GRN Return saved as Draft successfully!");
      
      setIsModalOpen(false);
      setSelectedGrn('');
      setApprovalWorkflow('');
      setReturnDate(new Date().toISOString().split('T')[0]);
      fetchData(); 
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save return draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectReturn = (ret) => {
    setActiveReturn(ret);
    const itemsFormatted = (ret.items || []).map(item => {
      const mat = item.material;
      const col = item.color;
      const sz = item.size;

      return {
        ...item,
        itemName: item.itemName || (typeof mat === 'object' && mat !== null ? (mat.itemName || mat.materialName || mat.name) : null) || 'Material Item',
        colorName: item.colorName || (typeof col === 'object' && col !== null ? (col.name || col.colorName) : null) || '-',
        sizeName: item.sizeName || (typeof sz === 'object' && sz !== null ? (sz.sizeCode || sz.name) : null) || '-',
        returnQty: item.returnQty || 0
      };
    });
    setReturnItems(itemsFormatted);
  };

  const handleReturnQtyChange = (index, value) => {
    const isCompleted = String(activeReturn?.status || '').toUpperCase() === 'COMPLETED' || String(activeReturn?.status || '').toUpperCase() === 'COMPLETE';
    if (isCompleted) return;

    const updated = [...returnItems];
    const enteredQty = Number(value) || 0;
    const maxQty = Number(updated[index].receivedQty || 0);

    if (enteredQty > maxQty) {
      alert(`Return quantity cannot exceed received quantity (${maxQty}).`);
      updated[index].returnQty = maxQty;
    } else if (enteredQty < 0) {
      updated[index].returnQty = 0;
    } else {
      updated[index].returnQty = enteredQty;
    }

    setReturnItems(updated);
  };

  const handleSubmitForApproval = async () => {
    const itemsToReturn = returnItems.filter(i => i.returnQty > 0);

    if (itemsToReturn.length === 0) {
      alert("Please enter a return quantity greater than 0 for at least one item.");
      return;
    }

    for (let item of itemsToReturn) {
      if (Number(item.returnQty) > Number(item.receivedQty)) {
        alert(`Item "${item.itemName}" return quantity (${item.returnQty}) cannot exceed received quantity (${item.receivedQty}).`);
        return;
      }
    }

    if (!window.confirm("Are you sure you want to submit this return for approval?")) return;

    try {
      setSubmitting(true);
      const payload = {
        grnNo: activeReturn.grnNo,
        warehouse: activeReturn.warehouse?._id || activeReturn.warehouse || null,
        approvalWorkflow: activeReturn.approvalWorkflow,
        returnDate: activeReturn.returnDate,
        items: itemsToReturn,
        returnedBy: currentUsername,
        reason: "GRN Return Approval Submission"
      };

      const res = await axios.post(`${API_URL}/grn-returns/return`, payload);
      alert(`GRN Return submitted for approval successfully! Assigned to: ${res.data.approver || 'Approver'}`);
      
      setActiveReturn(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit return.");
    } finally {
      setSubmitting(false);
    }
  };

  
  if (activeReturn) {
    const isCompleted = String(activeReturn.status || '').toUpperCase() === 'COMPLETED' || String(activeReturn.status || '').toUpperCase() === 'COMPLETE';

    return (
      <div className="w-full space-y-6 text-sm font-normal text-slate-700 p-6 md:p-8 bg-slate-50 min-h-screen">
        
       
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            .print-statement-box, .print-statement-box * {
              visibility: visible !important;
            }
            .print-statement-box {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 20px !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
            }
          }
        `}</style>

        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 shadow-xs no-print">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveReturn(null)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                Return — {activeReturn.returnNo} <span className={`text-xs px-2.5 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>{activeReturn.status || 'DRAFT'}</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">Manage item return breakdown quantities, color/size attributes, and submit for approval.</p>
            </div>
          </div>
          {isCompleted && (
            <button 
              onClick={() => window.print()} 
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Printer size={16} /> Print Statement
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl p-8 border border-slate-200 max-w-4xl mx-auto space-y-6 shadow-xs text-slate-800 print-statement-box">
          
          <div className="flex justify-between border-b pb-6 border-slate-100">
            <div>
              <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">ELISHA CLOTHING PVT LTD</h1>
              <p className="text-xs text-slate-400 mt-1">Goods Received Note (GRN) Return Statement</p>
            </div>
            <div className="text-right text-xs space-y-1">
              <div>RETURN ID: <span className="font-bold text-slate-900">{activeReturn.returnNo}</span></div>
              <div>DATE: <span className="font-medium">{new Date(activeReturn.returnDate).toLocaleDateString()}</span></div>
              <div>ISSUED BY: <span className="font-semibold uppercase text-emerald-900">{activeReturn.returnedBy}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">GRN Number</span>
              <span className="text-sm font-bold text-emerald-900 mt-0.5 block">{activeReturn.grnNo}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Approval Workflow</span>
              <span className="text-sm font-semibold text-slate-800 mt-0.5 block">{activeReturn.approvalWorkflow}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
              <span className={`text-xs font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{activeReturn.status}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center no-print">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">GRN Items Return Breakdown</h3>
              <span className="text-[11px] text-slate-400">{isCompleted ? 'Locked (Completed)' : 'Adjust return quantities for inventory deduction'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">#</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Color</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4 text-center">UOM</th>
                    <th className="py-3 px-4 text-center">Received Qty</th>
                    <th className="py-3 px-4 text-right bg-rose-50/50 text-rose-800">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-slate-700">
                  {returnItems.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-center text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.itemName}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{item.colorName}</td>
                      <td className="py-3 px-4 text-slate-600 font-semibold">{item.sizeName}</td>
                      <td className="py-3 px-4 text-center">{item.uom || 'Pcs'}</td>
                      <td className="py-3 px-4 text-center font-semibold">{item.receivedQty}</td>
                      <td className="py-3 px-4 text-right bg-rose-50/20">
                        {isCompleted ? (
                          <span className="font-bold text-rose-900 pr-3">{item.returnQty}</span>
                        ) : (
                          <input 
                            type="number" 
                            min="0" 
                            max={item.receivedQty}
                            value={item.returnQty} 
                            onChange={(e) => handleReturnQtyChange(index, e.target.value)}
                            className="w-24 px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-right font-bold text-rose-900 focus:outline-none focus:border-rose-500 shadow-2xs"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-16 text-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
            <div className="border-t pt-2">Prepared By</div>
            <div className="border-t pt-2">Checked By</div>
            <div className="border-t pt-2">Authorized Signature</div>
          </div>

         
          {!isCompleted && (
            <div className="flex justify-end items-center gap-3 bg-white p-5 rounded-xl border border-slate-100 shadow-xs no-print pt-6">
              <button 
                type="button" 
                onClick={() => setActiveReturn(null)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button 
                type="button" 
                disabled={submitting}
                onClick={handleSubmitForApproval}
                className="inline-flex items-center px-6 py-2.5 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-sm gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Submit For Approval
              </button>
            </div>
          )}

        </div>

      </div>
    );
  }


  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 p-6 md:p-8 bg-slate-50 min-h-screen">
      
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <RotateCcw className="text-rose-700" size={20} /> GRN Return Overview
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Track goods returns, draft statuses, and inventory adjustments.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Plus size={18} /> Process GRN Return
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Return Records & Drafts</h3>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={20} /> Loading returns...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-6">Return ID</th>
                  <th className="py-3 px-6">GRN No</th>
                  <th className="py-3 px-6">Workflow</th>
                  <th className="py-3 px-6">Return Date</th>
                  <th className="py-3 px-6">Items Count</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {returnsList.length > 0 ? returnsList.map((ret) => {
                  const isComp = String(ret.status || '').toUpperCase() === 'COMPLETED' || String(ret.status || '').toUpperCase() === 'COMPLETE';
                  return (
                    <tr 
                      key={ret._id} 
                      onClick={() => handleSelectReturn(ret)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-6 font-bold text-emerald-900">{ret.returnNo}</td>
                      <td className="py-3 px-6 font-semibold text-slate-800">{ret.grnNo}</td>
                      <td className="py-3 px-6">{ret.approvalWorkflow}</td>
                      <td className="py-3 px-6">{new Date(ret.returnDate).toLocaleDateString()}</td>
                      <td className="py-3 px-6">{ret.items?.length || 0} items</td>
                      <td className="py-3 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          isComp ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {ret.status || 'DRAFT'}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-right text-slate-500 uppercase text-xs">{ret.returnedBy}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="7" className="py-16 text-center text-slate-400 italic">No GRN returns found. Click "Process GRN Return" to create one.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <RotateCcw size={18} className="text-rose-700" /> Initialize GRN Return
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDraftReturn} className="p-6 space-y-5">
              
              <div className="space-y-4">
                
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select GRN *</label>
                  <select 
                    required
                    value={selectedGrn} 
                    onChange={(e) => handleGrnChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-800"
                  >
                    <option value="">Select Completed GRN ({grns.length} Available)</option>
                    {grns.map(g => (
                      <option key={g._id || g.grnNo} value={g.grnNo}>
                        {g.grnNo} {g.supplierName ? `— (${g.supplierName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Approval Workflow *</label>
                  <select 
                    required
                    value={approvalWorkflow} 
                    onChange={(e) => setApprovalWorkflow(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-800"
                  >
                    <option value="">Select Approval Workflow ({workflows.length} Available)</option>
                    {workflows.map(wf => {
                      const wfDisplayValue = wf.code || wf.workflowName || wf.name || wf._id;
                      return (
                        <option key={wf._id || wfDisplayValue} value={wfDisplayValue}>
                          {wfDisplayValue}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Return Date *</label>
                  <input 
                    type="date" 
                    required
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-800"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting || !selectedGrn}
                  className="inline-flex items-center px-6 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-sm gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save Draft
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};

export default GrnReturn;