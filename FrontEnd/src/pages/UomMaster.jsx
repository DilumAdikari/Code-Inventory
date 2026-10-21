import React, { useState, useEffect } from 'react';
import { Scale, Plus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { uomApi } from '../api/uomApi';
import { API_URL } from "../api/config";

const UomMaster = () => {
  const [uoms, setUoms] = useState([]);
  const [uomName, setUomName] = useState('');
  const [uomAbbr, setUomAbbr] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });


  const fetchUoms = async () => {
    try {
      setLoading(true);
      const response = await uomApi.getAllUoms();
      setUoms(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUoms();
  }, []);

  
  const handleAddUom = async (e) => {
    e.preventDefault();
    if (!uomName.trim() || !uomAbbr.trim()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await uomApi.createUom({ 
        name: uomName.trim(), 
        abbreviation: uomAbbr.trim().toUpperCase() 
      });
      setMessage({ type: 'success', text: 'UOM registered successfully!' });
      setUomName('');
      setUomAbbr('');
      fetchUoms();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add UOM. Name/Abbreviation must be unique.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Unit of Measure (UOM) Master</h2>
        <p className="text-sm text-slate-500 mt-0.5">Define measurement units (Meters, Pcs, Kilograms) used for stock tracking.</p>
      </div>

      {/* ALERT MESSAGE */}
      {message.text && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border
          ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* ADD UOM FORM */}
      <form onSubmit={handleAddUom} className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5 w-full">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Unit Name *</label>
          <input 
            type="text" 
            value={uomName}
            onChange={(e) => setUomName(e.target.value)}
            placeholder="e.g., Meters, Pieces, Yards"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all font-medium"
            required
          />
        </div>

        <div className="w-full sm:w-48 space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Abbreviation *</label>
          <input 
            type="text" 
            value={uomAbbr}
            onChange={(e) => setUomAbbr(e.target.value)}
            placeholder="e.g., M, PCS, YDS"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all font-bold uppercase"
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting}
          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all duration-200 gap-2 min-w-[120px]"
        >
          {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Save UOM</>}
        </button>
      </form>

      {/* REGISTERED UOMS LIST */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-800">Currently Registered UOMs ({uoms.length})</h4>
        
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Loader2 className="animate-spin" size={14} /> Loading UOMs...</div>
        ) : uoms.length === 0 ? (
          <div className="text-xs text-slate-400 italic py-4">No units registered yet.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {uoms.map((uom) => (
              <div key={uom._id} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 shadow-sm rounded-xl">
                <span className="text-sm font-semibold text-slate-700">{uom.name}</span>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-mono">{uom.abbreviation}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UomMaster;