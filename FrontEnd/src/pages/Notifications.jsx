import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Loader2, Bell, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../api/config';
import { confirmDialog } from '../components/AppDialog';

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Logged-in username in the same format the approvals are saved with (trimmed, uppercase)
const getStoredUsername = () => (localStorage.getItem('username') || '').trim().toUpperCase();

const Notifications = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const currentUsername = getStoredUsername();

  // Loads the pending approvals assigned to the logged-in user
  const loadPendingApprovals = useCallback(async () => {
    if (!currentUsername) {
      setPendingApprovals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/approvals/pending`, {
        params: { username: currentUsername }
      });
      setPendingApprovals(toArray(response.data));
    } catch (err) {
      console.error('Error loading pending approvals:', err);
      setPendingApprovals([]);
    } finally {
      setLoading(false);
    }
  }, [currentUsername]);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals]);

  // Approves or rejects one request. The row is removed only after the server confirms.
  const handleApprovalAction = async (item, status) => {
    const verb = status === 'APPROVED' ? 'approve' : 'reject';
    if (!await confirmDialog(`Are you sure you want to ${verb} ${item.docNo}?`)) return;

    try {
      setActionLoading(item._id);

      await axios.post(`${API_URL}/approvals/${item._id}/action`, {
        status,
        user: currentUsername
      });

      setPendingApprovals(prev => prev.filter(a => a._id !== item._id));
      // Lets the sidebar red dot refresh straight away
      window.dispatchEvent(new Event('approvals:changed'));

      alert(`${item.docNo} ${status === 'APPROVED' ? 'approved' : 'rejected'} successfully.`);
    } catch (err) {
      console.error('Approval action failed:', err);
      alert(err.response?.data?.message || 'Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
      <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading your pending notifications & approvals...
    </div>
  );

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Bell size={20} className="text-emerald-900" /> Notifications & Action Inbox
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Review, approve or reject the documents assigned to you.</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingApprovals.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg">
              {pendingApprovals.length} pending
            </span>
          )}
          <div className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg uppercase">
            User: {currentUsername || '-'}
          </div>
        </div>
      </div>

      {/* PENDING APPROVALS TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-4 px-6 w-1/5">Module Type</th>
              <th className="py-4 px-6 w-1/6">Doc No</th>
              <th className="py-4 px-6 w-1/5">Requested By</th>
              <th className="py-4 px-6">Summary / Details</th>
              <th className="py-4 px-6 text-center w-1/6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {pendingApprovals.length > 0 ? (
              pendingApprovals.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 px-6">
                    <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-100 rounded text-xs font-semibold uppercase">
                      {item.documentType}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{item.docNo}</td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="font-semibold text-slate-700">{item.requestedBy}</div>
                    <div className="text-[11px] text-slate-400">{item.date}</div>
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-500 font-normal leading-relaxed">{item.summary}</td>
                  <td className="py-4 px-6 text-center">
                    {actionLoading === item._id ? (
                      <Loader2 className="animate-spin text-slate-400 mx-auto" size={18} />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprovalAction(item, 'APPROVED')}
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-100 transition-all shadow-xs cursor-pointer"
                          title="Approve Document"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprovalAction(item, 'REJECTED')}
                          className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-100 transition-all shadow-xs cursor-pointer"
                          title="Reject Document"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="py-16 text-center text-slate-400 italic">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldAlert size={24} className="text-slate-300" />
                    <span>Your inbox is clean! No pending authorization approvals found for your account.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default Notifications;
