import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Loader2, X, Mail, Phone, MapPin, Pencil, Trash2 } from 'lucide-react';
import { API_URL } from "../api/config";
import { confirmDialog } from '../components/AppDialog';

const EMPTY_FORM = { customerName: '', email: '', phone: '', address: '' };

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`);
      setCustomers(res.data);
      setLoading(false);
    } catch (err) {
      console.error("❌ Failed to fetch customers:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingId(c._id);
    setForm({
      customerName: c.customerName || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingId) {
        await axios.put(`${API_URL}/customers/${editingId}`, form);
      } else {
        await axios.post(`${API_URL}/customers`, form);
      }
      closeModal();
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save customer. Please check backend connection.");
    } finally {
      setSubmitting(false);
    }
  };

  // Deletes a customer after confirmation. The server refuses if it is already used in other records.
  const handleDelete = async (c) => {
    const label = c.customerName || 'this customer';
    if (!(await confirmDialog(`"${label}" delete karanna da? Mema action eka undo karanna ba.`))) return;
    try {
      setDeletingId(c._id);
      await axios.delete(`${API_URL}/customers/${c._id}`);
      setCustomers((prev) => prev.filter((x) => x._id !== c._id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete customer.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCustomers = customers.filter(c =>
    (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin text-emerald-800" size={20} />
        Loading customer registry...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customer Registry</h1>
          <p className="text-sm text-slate-500 mt-1">Manage buyers and garment clients for sales orders.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 rounded-xl shadow-sm transition-all duration-200 gap-2"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="p-4 px-6">Customer Name</th>
                <th className="p-4 px-6">Email Address</th>
                <th className="p-4 px-6">Phone Number</th>
                <th className="p-4 px-6">Location / Address</th>
                <th className="p-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c, idx) => (
                  <tr key={c._id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 px-6 text-sm font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.customerName ? c.customerName.charAt(0).toUpperCase() : 'C'}
                        </div>
                        {c.customerName}
                      </div>
                    </td>
                    <td className="p-4 px-6 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400"/> {c.email || 'N/A'}</span>
                    </td>
                    <td className="p-4 px-6 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400"/> {c.phone || 'N/A'}</span>
                    </td>
                    <td className="p-4 px-6 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400"/> {c.address || 'No Address Provided'}</span>
                    </td>
                    <td className="p-4 px-6 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c)}
                        disabled={deletingId === c._id}
                        className="ml-1.5 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {deletingId === c._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-16 text-center text-slate-400 italic bg-white">
                    No customers found. Click "Add Customer" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Customer / Buyer Name *</label>
                <input
                  type="text"
                  required
                  value={form.customerName}
                  onChange={(e) => setForm({...form, customerName: e.target.value})}
                  placeholder="e.g. Next Sourcing, MAS Holdings"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    placeholder="contact@buyer.com"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({...form, phone: e.target.value})}
                    placeholder="+94 11 234 5678"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Address / Location</label>
                <textarea
                  rows="2"
                  value={form.address}
                  onChange={(e) => setForm({...form, address: e.target.value})}
                  placeholder="Company HQ Address..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-800 transition-all"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 bg-emerald-900 text-white font-semibold rounded-xl text-sm hover:bg-emerald-800 transition-all disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : (editingId ? 'Update Customer' : 'Save Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;