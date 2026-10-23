import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Plus, Loader2, CheckCircle2, AlertTriangle, Building2, Phone, Mail, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { supplierApi } from '../api/supplierApi';
import { API_URL } from "../api/config";
import { confirmDialog } from '../components/AppDialog';

const EMPTY_FORM = { supplierCode: '', name: '', companyName: '', email: '', phone: '', address: '' };

const SupplierRegistration = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
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

  // Fills the form with an existing supplier so it can be edited
  const handleStartEdit = (sup) => {
    setEditingId(sup._id);
    setFormData({
      supplierCode: sup.supplierCode || '',
      name: sup.name || '',
      companyName: sup.companyName || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || '',
    });
    setMessage({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      if (editingId) {
        await axios.put(`${API_URL}/suppliers/${editingId}`, formData);
        setMessage({ type: 'success', text: 'Supplier updated successfully!' });
        setEditingId(null);
      } else {
        await supplierApi.createSupplier(formData);
        setMessage({ type: 'success', text: 'Supplier registered successfully!' });
      }
      setFormData(EMPTY_FORM);
      fetchSuppliers();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save supplier. Code must be unique.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Deletes a supplier after confirmation. The server refuses if it is already used in other records.
  const handleDelete = async (sup) => {
    const label = sup.companyName || sup.name || sup.supplierCode;
    if (!(await confirmDialog(`"${label}" delete karanna da? Mema action eka undo karanna ba.`))) return;

    setMessage({ type: '', text: '' });
    try {
      setDeletingId(sup._id);
      await axios.delete(`${API_URL}/suppliers/${sup._id}`);
      setSuppliers((prev) => prev.filter((s) => s._id !== sup._id));
      if (editingId === sup._id) handleCancelEdit();
      setMessage({ type: 'success', text: 'Supplier deleted successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to delete supplier.' });
    } finally {
      setDeletingId(null);
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
        {/* ADD / EDIT SUPPLIER FORM */}
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserPlus size={16} className="text-emerald-800" /> {editingId ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>
            {editingId && (
              <button type="button" onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer">
                <X size={12} /> Cancel edit
              </button>
            )}
          </div>

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
            {submitting ? <Loader2 className="animate-spin" size={14} /> : (editingId ? <>Update Supplier</> : <><Plus size={14} /> Save Supplier</>)}
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
                <div
                  key={sup._id}
                  className={`p-4 bg-slate-50/60 border rounded-xl space-y-2 hover:border-emerald-100 transition-all ${editingId === sup._id ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-100'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">{sup.supplierCode}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">{sup.companyName}</h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(sup)}
                        title="Edit supplier"
                        className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sup)}
                        disabled={deletingId === sup._id}
                        title="Delete supplier"
                        className="p-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        {deletingId === sup._id ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                      </button>
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