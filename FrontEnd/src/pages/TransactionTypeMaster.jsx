import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Tag, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";

const TransactionTypeMaster = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  
  const [form, setForm] = useState({ 
    typeCode: '', 
    typeName: '', 
    description: '',
    sourceType: 'with_po',
    requiresPO: true,
    requiresSupplier: true,
    requiresIssuing: false, 
    requiresQC: false,
    allowsPartialReceipt: true
  });

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await axios.get('${API_URL}/transaction-types');
      setTypes(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTypes(); }, []);

 
  const handleSourceTypeChange = (e) => {
    const value = e.target.value;
    let reqPO = false;
    let reqSupplier = true;
    let reqIssuing = false;

    if (value === 'with_po') {
      reqPO = true;
      reqSupplier = true;
      reqIssuing = false;
    } else if (value === 'with_issuing') {
      reqPO = false;
      reqSupplier = false;
      reqIssuing = true; 
    } else if (value === 'open_balance') {
      reqPO = false;
      reqSupplier = false;
      reqIssuing = false;
    }

    setForm({
      ...form,
      sourceType: value,
      requiresPO: reqPO,
      requiresSupplier: reqSupplier,
      requiresIssuing: reqIssuing
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await axios.post('${API_URL}/transaction-types', {
        code: form.typeCode,
        typeName: form.typeName,
        description: form.description,
        sourceType: form.sourceType,
        requiresPO: form.requiresPO,
        requiresSupplier: form.requiresSupplier,
        requiresIssuing: form.requiresIssuing, 
        requiresQC: form.requiresQC,
        allowsPartialReceipt: form.allowsPartialReceipt
      });

      alert('Transaction Type Registered Successfully!');
      setForm({ 
        typeCode: '', 
        typeName: '', 
        description: '',
        sourceType: 'with_po',
        requiresPO: true,
        requiresSupplier: true,
        requiresIssuing: false,
        requiresQC: false,
        allowsPartialReceipt: true
      });
      fetchTypes();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving transaction type');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Tag className="text-emerald-900" size={20}/> GRN Transaction Types Master
        </h2>
        <p className="text-slate-400 text-xs mt-0.5">Register and manage inbound logistics transaction categories dynamically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORM TO REGISTER NEW TYPE */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs h-fit space-y-4">
          <h3 className="font-semibold text-slate-800 text-sm">Add New Transaction Type</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Type Code (Short) *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. RET, ISS" 
                value={form.typeCode} 
                onChange={(e) => setForm({...form, typeCode: e.target.value.toUpperCase()})} 
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none uppercase font-bold" 
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Type Name *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Material Return" 
                value={form.typeName} 
                onChange={(e) => setForm({...form, typeName: e.target.value})} 
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none" 
              />
            </div>

            {/* Source Type Dropdown */}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Source Type *</label>
              <select
                value={form.sourceType}
                onChange={handleSourceTypeChange}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg text-sm h-10 focus:outline-none font-semibold text-slate-800 cursor-pointer"
              >
                <option value="with_po">With PO</option>
                <option value="with_issuing">With Issuing</option>
                <option value="open_balance">Open Balance</option>
              </select>
            </div>

            {/* 🌟 Behavior Flags (Includes Requires Issuing Checkbox) */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Behavior Flags</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresPO}
                    onChange={(e) => setForm({...form, requiresPO: e.target.checked})}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires PO</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresSupplier}
                    onChange={(e) => setForm({...form, requiresSupplier: e.target.checked})}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires Supplier</span>
                </label>

                
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresIssuing}
                    onChange={(e) => setForm({...form, requiresIssuing: e.target.checked})}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires Issuing</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresQC}
                    onChange={(e) => setForm({...form, requiresQC: e.target.checked})}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires QC</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowsPartialReceipt}
                    onChange={(e) => setForm({...form, allowsPartialReceipt: e.target.checked})}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Allow Partial</span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Description</label>
              <textarea 
                rows="2" 
                placeholder="Enter details..." 
                value={form.description} 
                onChange={(e) => setForm({...form, description: e.target.value})} 
                className="w-full p-3 bg-slate-50 border rounded-lg text-sm focus:outline-none" 
              />
            </div>

            <button 
              type="submit" 
              disabled={submitting} 
              className="w-full py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {submitting ? <Loader2 className="animate-spin" size={16}/> : <><Plus size={16}/> Save Transaction Type</>}
            </button>
          </form>
        </div>

        {/* LIST OF REGISTERED TYPES */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs h-fit">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-800 text-sm">Active Transaction Types Directory</div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-6">Code</th>
                <th className="py-3 px-6">Transaction Type Name</th>
                <th className="py-3 px-6">Source Type</th>
                <th className="py-3 px-6">Description</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {types.map((t) => (
                <tr key={t._id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-6 font-bold text-emerald-950 font-mono">{t.code || t.typeCode}</td>
                  <td className="py-3 px-6 font-semibold text-slate-800">{t.typeName || t.name}</td>
                  <td className="py-3 px-6 font-mono text-xs text-emerald-800">{t.sourceType}</td>
                  <td className="py-3 px-6 text-slate-500 text-xs">{t.description || 'N/A'}</td>
                  <td className="py-3 px-6 text-center">
                    <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-bold inline-flex items-center gap-1">
                      <CheckCircle size={12}/> Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default TransactionTypeMaster;