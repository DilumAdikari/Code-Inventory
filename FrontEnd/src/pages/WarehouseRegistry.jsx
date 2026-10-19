import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Warehouse, MapPin, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";
const WarehouseRegistry = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    warehouseCode: '',
    warehouseName: '',
    location: '',
    remarks: ''
  });

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const res = await axios.get('${API_URL}/warehouses');
      setWarehouses(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { loadWarehouses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await axios.post('${API_URL}/warehouses/register', form);
      alert("Warehouse Registered Successfully!");
      setIsModalOpen(false);
      setForm({ warehouseCode: '', warehouseName: '', location: '', remarks: '' });
      loadWarehouses();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to register warehouse.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-800" size={20} /> Loading warehouse network registry...</div>;

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Warehouse className="text-emerald-900" size={20}/> Warehouse & Stores Registry</h2>
          <p className="text-slate-400 text-xs mt-0.5">Configure spatial material distribution nodes, fabrics holding hubs and trims location inventories.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all"
        >
          <Plus size={16} /> Add New Warehouse
        </button>
      </div>

      {/* REGISTRATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Warehouse size={16} className="text-emerald-800"/> Warehouse Setup</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1">Warehouse / Stores Code *</label>
                <input type="text" required placeholder="e.g., MFS-01" value={form.warehouseCode} onChange={(e) => setForm({...form, warehouseCode: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 h-10 focus:outline-none focus:border-slate-400 font-semibold uppercase" />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1">Warehouse Name Descriptor *</label>
                <input type="text" required placeholder="e.g., Main Fabric Store" value={form.warehouseName} onChange={(e) => setForm({...form, warehouseName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 h-10 focus:outline-none focus:border-slate-400 font-medium" />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1">Physical Location / Plant Branch</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input type="text" placeholder="e.g., Veyangoda Factory Complex" value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 h-10 focus:outline-none focus:border-slate-400 font-medium" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1">Operational Remarks</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input type="text" placeholder="e.g., Temperature controlled room" value={form.remarks} onChange={(e) => setForm({...form, remarks: e.target.value})} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 h-10 focus:outline-none focus:border-slate-400 font-medium" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-500 font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-medium shadow-sm flex items-center justify-center">
                  {submitting ? <Loader2 className="animate-spin" size={14}/> : "Register Hub"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIST OF WAREHOUSES */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-4 px-6">STORE CODE</th>
              <th className="py-4 px-6">DESCRIPTIVE NAME</th>
              <th className="py-4 px-6">LOCATION BRANCH</th>
              <th className="py-4 px-6">REMARKS</th>
              <th className="py-4 px-6 text-center">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {warehouses.length > 0 ? (
              warehouses.map((w) => (
                <tr key={w._id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 px-6 font-bold text-emerald-950 uppercase">{w.warehouseCode}</td>
                  <td className="py-4 px-6 text-slate-800">{w.warehouseName}</td>
                  <td className="py-4 px-6 text-slate-600">{w.location || 'N/A'}</td>
                  <td className="py-4 px-6 text-xs text-slate-400 font-normal">{w.remarks || '---'}</td>
                  <td className="py-4 px-6 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-full font-bold">
                      <CheckCircle size={10}/> {w.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-16 text-center text-slate-400 italic">
                  No active warehouse depots configured. Click 'Add New Warehouse' to register.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default WarehouseRegistry;