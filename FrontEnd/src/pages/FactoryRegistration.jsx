import React, { useState, useEffect } from 'react';
import { Factory, Plus, Loader2, CheckCircle2, AlertTriangle, User, Phone, Mail, MapPin } from 'lucide-react';
import { factoryApi } from '../api/factoryApi';

const FactoryRegistration = () => {
  const [factories, setFactories] = useState([]);
  const [formData, setFormData] = useState({
    factoryCode: '', name: '', location: '', contactPerson: '', phone: '', email: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchFactories = async () => {
    try {
      setLoading(true);
      const response = await factoryApi.getAllFactories();
      setFactories(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchFactories(); }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      await factoryApi.createFactory(formData);
      setMessage({ type: 'success', text: 'Factory registered successfully!' });
      setFormData({ factoryCode: '', name: '', location: '', contactPerson: '', phone: '', email: '' });
      fetchFactories();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add factory. Code must be unique.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Factory Master Registry</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage production plants, manufacturing locations, and internal factories.</p>
      </div>

      {message.text && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border
          ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD FACTORY FORM */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-2 flex items-center gap-2">
            <Factory size={16} className="text-emerald-800" /> Add New Factory
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Factory Code *</label>
              <input type="text" name="factoryCode" required value={formData.factoryCode} onChange={handleChange} placeholder="FAC-001" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Factory Name *</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="Kandy Plant" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location / City *</label>
            <input type="text" name="location" required value={formData.location} onChange={handleChange} placeholder="Digana, Kandy" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Person</label>
              <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} placeholder="Manager Name" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone *</label>
              <input type="text" name="phone" required value={formData.phone} onChange={handleChange} placeholder="0812345678" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="kandy@green-erp.com" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
          </div>

          <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm transition-all gap-2">
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> Save Factory</>}
          </button>
        </form>

        {/* FACTORIES LIST */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Registered Factories ({factories.length})</h3>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-6"><Loader2 className="animate-spin" size={14} /> Loading Plants...</div>
          ) : factories.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-6">No factories registered yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
              {factories.map((fac) => (
                <div key={fac._id} className="p-4 bg-slate-50/60 border border-slate-100 rounded-xl space-y-2 hover:border-emerald-100 transition-all">
                  <div>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded">{fac.factoryCode}</span>
                    <h4 className="text-sm font-bold text-slate-800 mt-1">{fac.name}</h4>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5"><MapPin size={12} /> {fac.location}</div>
                    {fac.contactPerson && <div className="flex items-center gap-1.5"><User size={12} /> Contact: {fac.contactPerson}</div>}
                    <div className="flex items-center gap-1.5"><Phone size={12} /> {fac.phone}</div>
                    {fac.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {fac.email}</div>}
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

export default FactoryRegistration;