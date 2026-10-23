import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Tag, CheckCircle, Pencil, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../api/config';
import { confirmDialog } from '../components/AppDialog';

const EMPTY_FORM = {
  typeCode: '',
  typeName: '',
  description: '',
  sourceType: 'with_po',
  requiresPO: true,
  requiresSupplier: true,
  requiresIssuing: false,
  requiresQC: false,
  allowsPartialReceipt: true,
};

const TransactionTypeMaster = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/transaction-types`);
      setTypes(res.data.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTypes(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

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

    setForm((prev) => ({
      ...prev,
      sourceType: value,
      requiresPO: reqPO,
      requiresSupplier: reqSupplier,
      requiresIssuing: reqIssuing,
    }));
  };

  // Loads an existing transaction type into the form so it can be edited
  const handleEdit = (t) => {
    setEditingId(t._id);
    setForm({
      typeCode: t.code || t.typeCode || '',
      typeName: t.typeName || t.name || '',
      description: t.description || '',
      sourceType: t.sourceType || 'with_po',
      requiresPO: !!t.requiresPO,
      requiresSupplier: !!t.requiresSupplier,
      requiresIssuing: !!t.requiresIssuing,
      requiresQC: !!t.requiresQC,
      allowsPartialReceipt: !!t.allowsPartialReceipt,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      code: form.typeCode,
      typeName: form.typeName,
      description: form.description,
      sourceType: form.sourceType,
      requiresPO: form.requiresPO,
      requiresSupplier: form.requiresSupplier,
      requiresIssuing: form.requiresIssuing,
      requiresQC: form.requiresQC,
      allowsPartialReceipt: form.allowsPartialReceipt,
    };

    try {
      setSubmitting(true);
      if (editingId) {
        await axios.put(`${API_URL}/transaction-types/${editingId}`, payload);
        alert('Transaction Type updated successfully!');
      } else {
        await axios.post(`${API_URL}/transaction-types`, payload);
        alert('Transaction Type Registered Successfully!');
      }
      resetForm();
      fetchTypes();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving transaction type');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletes a transaction type after confirmation. The server refuses if it is already used in other records.
  const handleDelete = async (t) => {
    const label = t.code || t.typeCode || 'this transaction type';
    if (!(await confirmDialog(`"${label}" delete karanna da? Mema action eka undo karanna ba.`))) return;
    try {
      setDeletingId(t._id);
      await axios.delete(`${API_URL}/transaction-types/${t._id}`);
      if (editingId === t._id) resetForm();
      setTypes((prev) => prev.filter((x) => x._id !== t._id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete transaction type.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {/* HEADER BANNER */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Tag className="text-emerald-900" size={20} /> GRN Transaction Types Master
        </h2>
        <p className="text-slate-400 text-xs mt-0.5">Register and manage inbound logistics transaction categories dynamically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ADD / EDIT FORM */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-xs h-fit space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 text-sm">
              {editingId ? 'Edit Transaction Type' : 'Add New Transaction Type'}
            </h3>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer">
                <X size={12} /> Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400 font-medium uppercase">Type Code (Short) *</label>
              <input
                type="text"
                required
                placeholder="e.g. RET, ISS"
                value={form.typeCode}
                onChange={(e) => setForm({ ...form, typeCode: e.target.value.toUpperCase() })}
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
                onChange={(e) => setForm({ ...form, typeName: e.target.value })}
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

            {/* Behavior Flags */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Behavior Flags</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresPO}
                    onChange={(e) => setForm({ ...form, requiresPO: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires PO</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresSupplier}
                    onChange={(e) => setForm({ ...form, requiresSupplier: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires Supplier</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresIssuing}
                    onChange={(e) => setForm({ ...form, requiresIssuing: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires Issuing</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requiresQC}
                    onChange={(e) => setForm({ ...form, requiresQC: e.target.checked })}
                    className="w-3.5 h-3.5 text-emerald-900 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700">Requires QC</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowsPartialReceipt}
                    onChange={(e) => setForm({ ...form, allowsPartialReceipt: e.target.checked })}
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
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full p-3 bg-slate-50 border rounded-lg text-sm focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {submitting
                ? <Loader2 className="animate-spin" size={16} />
                : editingId
                  ? 'Update Transaction Type'
                  : <><Plus size={16} /> Save Transaction Type</>}
            </button>
          </form>
        </div>

        {/* LIST OF REGISTERED TYPES */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs h-fit">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-800 text-sm">Active Transaction Types Directory</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-6">Code</th>
                  <th className="py-3 px-6">Transaction Type Name</th>
                  <th className="py-3 px-6">Source Type</th>
                  <th className="py-3 px-6">Description</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loading && types.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-slate-400">
                      <Loader2 className="animate-spin inline-block mr-2" size={14} /> Loading...
                    </td>
                  </tr>
                ) : types.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-slate-400 italic">No transaction types registered yet.</td>
                  </tr>
                ) : (
                  types.map((t) => (
                    <tr
                      key={t._id}
                      className={`hover:bg-slate-50 transition-colors ${editingId === t._id ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="py-3 px-6 font-bold text-emerald-950 font-mono">{t.code || t.typeCode}</td>
                      <td className="py-3 px-6 font-semibold text-slate-800">{t.typeName || t.name}</td>
                      <td className="py-3 px-6 font-mono text-xs text-emerald-800">{t.sourceType}</td>
                      <td className="py-3 px-6 text-slate-500 text-xs">{t.description || 'N/A'}</td>
                      <td className="py-3 px-6 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle size={12} /> Active
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEdit(t)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          disabled={deletingId === t._id}
                          className="ml-1.5 inline-flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === t._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransactionTypeMaster;