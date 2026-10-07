import React, { useState, useEffect } from 'react';
import { Palette, Plus, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { colorApi } from '../api/colorApi';

const Settings = () => {
  // Tab Management
  const [activeTab, setActiveTab] = useState('colors');

  // Color States
  const [colors, setColors] = useState([]);
  const [colorName, setColorName] = useState('');
  const [colorCode, setColorCode] = useState('#emerald-900'); // Default color picker value
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 1. Database එකේ තියෙන පාටවල් ලැයිස්තුව Live Fetch කිරීම
  const fetchColors = async () => {
    try {
      setLoading(true);
      const response = await colorApi.getAllColors();
      setColors(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColors();
  }, []);

  // 2. අලුත් පාටක් DB එකට Save කිරීම
  const handleAddColor = async (e) => {
    e.preventDefault();
    if (!colorName.trim()) return;

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await colorApi.createColor({ name: colorName.trim(), code: colorCode });
      setMessage({ type: 'success', text: 'Color registered successfully!' });
      setColorName('');
      fetchColors(); // Table එක auto refresh කරනවා
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add color. Code/Name must be unique.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      
      {/* LEFT SIDEBAR LINKS FOR SETTINGS */}
      <div className="w-full md:w-64 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm h-fit space-y-1">
        <h3 className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">System Settings</h3>
        
        <button 
          onClick={() => setActiveTab('colors')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left
            ${activeTab === 'colors' 
              ? 'bg-emerald-50 text-emerald-900' 
              : 'text-slate-600 hover:bg-slate-50'
            }`}
        >
          <Palette size={18} />
          Color Master
        </button>
        
        <button disabled className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed text-left">
          General Configuration
        </button>
      </div>

      {/* RIGHT SIDE CONTENT - COLOR MASTER VIEW */}
      <div className="flex-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        {activeTab === 'colors' && (
          <>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Color Master Configuration</h2>
              <p className="text-sm text-slate-500 mt-0.5">Register standard product colors here. These will be populated across Material Registry, GRN and Issuing modules.</p>
            </div>

            {/* MESSAGE ALERT */}
            {message.text && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border
                ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                {message.text}
              </div>
            )}

            {/* ADD COLOR FORM */}
            <form onSubmit={handleAddColor} className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 space-y-1.5 w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Color Name *</label>
                <input 
                  type="text" 
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="e.g., Navy Blue, Maroon, Bottle Green"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5 w-full sm:w-auto">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Visual Code</label>
                <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-slate-200 rounded-xl">
                  <input 
                    type="color" 
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-xs font-mono text-slate-500 pr-2 uppercase">{colorCode}</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all duration-200 gap-2 min-w-[120px]"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Save Color</>}
              </button>
            </form>

            {/* REGISTERED COLORS LIST */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-800">Currently Registered Colors ({colors.length})</h4>
              
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Loader2 className="animate-spin" size={14} /> Loading Master Colors...</div>
              ) : colors.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-4">No standard colors registered yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {colors.map((color) => (
                    <div key={color._id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 shadow-sm rounded-xl hover:border-emerald-100 transition-all">
                      <div 
                        className="w-5 h-5 rounded-full border border-slate-200/60 shrink-0 shadow-inner" 
                        style={{ backgroundColor: color.code }}
                      />
                      <span className="text-sm font-semibold text-slate-700 truncate">{color.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Settings;