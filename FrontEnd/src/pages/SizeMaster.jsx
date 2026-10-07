import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, Edit3, X, Check, Scale } from 'lucide-react';
import axios from 'axios';

const SizeMaster = () => {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form States
  const [sizeId, setSizeId] = useState(null);
  const [sizeCode, setSizeCode] = useState('');
  const [sizeDescription, setSizeDescription] = useState('');
  const [status, setStatus] = useState('Active');

  const fetchSizes = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://192.168.1.30:5003/api/sizes');
      setSizes(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchSizes(); }, []);

  const handleEdit = (size) => {
    setSizeId(size._id);
    setSizeCode(size.sizeCode);
    setSizeDescription(size.sizeDescription || '');
    setStatus(size.status || 'Active');
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to remove this size definition?")) {
      try {
        await axios.delete(`http://192.168.1.30:5003/api/sizes/${id}`);
        fetchSizes();
      } catch (err) {
        alert("Failed to delete size matrix node.");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sizeCode) return;

    try {
      setSubmitting(true);
      await axios.post('http://192.168.1.30:5003/api/sizes/save', {
        sizeId,
        sizeCode: sizeCode.trim(),
        sizeDescription: sizeDescription.trim(),
        status
      });
      setIsModalOpen(false);
      setSizeId(null);
      setSizeCode('');
      setSizeDescription('');
      setStatus('Active');
      fetchSizes();
    } catch (err) {
      alert(err.response?.data?.message || "Error saving size definitions.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Scale className="text-emerald-900" size={20}/> Size Metrics Master
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Define and structure dimensional product sizing, apparel grading matrices, and fit standards.</p>
        </div>
        <button 
          onClick={() => { setSizeId(null); setSizeCode(''); setSizeDescription(''); setStatus('Active'); setIsModalOpen(true); }}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all"
        >
          <Plus size={16} /> Create Size Node
        </button>
      </div>

      {/* DATA LEDGER TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={18} /> Loading sizing master arrays...
          </div>
        ) : sizes.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic">No sizing parameters registered yet.</div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6">Size Code Matrix</th>
                <th className="py-4 px-6">Description / Labels</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {sizes.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 px-6 font-bold text-emerald-950 uppercase text-sm tracking-wide">{s.sizeCode}</td>
                  <td className="py-4 px-6 text-slate-500 font-medium">{s.sizeDescription || 'N/A'}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-0.5 border rounded text-xs uppercase ${s.status === 'Active' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{s.status}</span>
                  </td>
                  <td className="py-4 px-6 text-center flex justify-center gap-2">
                    <button onClick={() => handleEdit(s)} className="text-slate-400 hover:text-emerald-800 p-1 rounded transition-colors"><Edit3 size={14}/></button>
                    <button onClick={() => handleDelete(s._id)} className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL POPUP FOR INITIALIZATION / EDITING */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-xl border border-slate-100 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b flex justify-between items-center border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Scale size={16} className="text-emerald-800"/> {sizeId ? "Modify Size Profile" : "Initialize Size Node"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Size Code (Unique) *</label>
                <input type="text" required placeholder="e.g., XL, M, UK-10" value={sizeCode} onChange={(e) => setSizeCode(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold uppercase text-emerald-950 focus:outline-none h-11" />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Size Description Label</label>
                <input type="text" placeholder="e.g., Extra Large" value={sizeDescription} onChange={(e) => setSizeDescription(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none h-11" />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400 font-medium uppercase">Status Matrix</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none h-11">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-500 font-medium">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center justify-center gap-1">
                  {submitting ? <Loader2 className="animate-spin" size={14}/> : <><Check size={14}/> {sizeId ? "Update" : "Save Definition"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SizeMaster;