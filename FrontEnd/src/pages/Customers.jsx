import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Loader2, X, Mail, Phone, MapPin } from 'lucide-react';
import { API_URL } from "../api/config";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', address: '' });

  const fetchCustomers = async () => {
    try {
      const res = await axios.get('${API_URL}/customers');
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

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await axios.post('${API_URL}/customers', form);
      setIsModalOpen(false);
      setForm({ customerName: '', email: '', phone: '', address: '' });
      fetchCustomers();
    } catch (err) {
      alert("Failed to save customer. Please check backend connection.");
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
          onClick={() => setIsModalOpen(true)}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c, idx) => (
                  <tr key={c._id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 px-6 text-sm font-bold text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                        {c.customerName ? c.customerName.charAt(0).toUpperCase() : 'C'}
                      </div>
                      {c.customerName}
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-16 text-center text-slate-400 italic bg-white">
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
              <h2 className="text-lg font-bold text-slate-900">Add New Customer</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2.5 bg-emerald-900 text-white font-semibold rounded-xl text-sm hover:bg-emerald-800 transition-all"
                >
                  Save Customer
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