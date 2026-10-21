import React, { useState, useEffect } from 'react';
import { UserPlus, Plus, Loader2, CheckCircle2, AlertTriangle, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { supplierApi } from '../api/supplierApi';
import { API_URL } from "../api/config";

const SupplierRegistration = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState({
    supplierCode: '', name: '', companyName: '', email: '', phone: '', address: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await supplierApi.getAllSuppliers();
      setSuppliers(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await supplierApi.createSupplier(formData);
      setMessage({ type: 'success', text: 'Supplier registered successfully!' });
      setFormData({ supplierCode: '', name: '', companyName: '', email: '', phone: '', address: '' });
      fetchSuppliers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add supplier. Code must be unique.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Supplier Master Registry</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage external supply partners and material vendors.</p>
      </div>

      {message.text && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border
          ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      {/* FORM AND LIST GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD SUPPLIER FORM */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-2 flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-800" /> Add New Supplier
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier Code *</label>
              <input type="text" name="supplierCode" required value={formData.supplierCode} onChange={handleChange} placeholder="SUP-001" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Name *</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="John Doe" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name *</label>
            <input type="text" name="companyName" required value={formData.companyName} onChange={handleChange} placeholder="Elisha Textiles PVT LTD" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone *</label>
              <input type="text" name="phone" required value={formData.phone} onChange={handleChange} placeholder="0771234567" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="vendor@mail.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Address</label>
            <textarea name="address" rows="2" value={formData.address} onChange={handleChange} placeholder="Factory Address..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"></textarea>
          </div>

          <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all gap-2">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> Save Supplier</>}
          </button>
        </form>

        {/* SUPPLIERS LISTCARD TABLE */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Registered Suppliers ({suppliers.length})</h3>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-6"><Loader2 className="animate-spin" size={14} /> Loading Partners...</div>
          ) : suppliers.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-6">No suppliers registered yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {suppliers.map((sup) => (
                <div key={sup._id} className="p-4 bg-slate-50/60 border border-slate-100 rounded-xl space-y-2 hover:border-emerald-100 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">{sup.supplierCode}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">{sup.companyName}</h4>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5"><Building2 size={12} /> Contact: {sup.name}</div>
                    <div className="flex items-center gap-1.5"><Phone size={12} /> {sup.phone}</div>
                    {sup.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {sup.email}</div>}
                    {sup.address && <div className="flex items-center gap-1.5"><MapPin size={12} /> {sup.address}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierRegistration;