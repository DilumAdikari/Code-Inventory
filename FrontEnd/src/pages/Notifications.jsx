import React, { useState, useEffect } from 'react';
import { Check, X, Loader2, Bell, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";  
import { confirmDialog } from '../components/AppDialog';

const Notifications = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); 

  
  const [currentUsername, setCurrentUsername] = useState(() => {
    const savedUser = localStorage.getItem('username');
    return savedUser ? savedUser.trim().toUpperCase() : 'DILUM';
  });

  const loadPendingApprovals = async (user) => {
    try {
      setLoading(true);
      
      
      const targetUser = user || currentUsername;
      const response = await axios.get(`${API_URL}/approvals/pending?username=${targetUser}`);
      
      setPendingApprovals(response.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error loading pending notifications:", err);
      setPendingApprovals([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    
    const savedUser = localStorage.getItem('username');
    if (savedUser) {
      const formattedUser = savedUser.trim().toUpperCase();
      setCurrentUsername(formattedUser);
      loadPendingApprovals(formattedUser); 
    } else {
      loadPendingApprovals('DILUM');
    }
  }, []);

  const handleApprovalAction = async (id, status) => {
    if (!await confirmDialog(`Are you sure you want to ${status.toLowerCase()} this request?`)) return;
    
    try {
      setActionLoading(id);
      
      
      await axios.post(`${API_URL}/approvals/${id}/action`, {
        status, 
        user: currentUsername
      });

      alert(`Request has been successfully ${status.toLowerCase()}!`);
      loadPendingApprovals(currentUsername); 
    } catch (err) {
      alert("Action processed locally or backend connection update pending.");
      setPendingApprovals(pendingApprovals.filter(item => item._id !== id));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-800" size={20} /> Loading your pending notifications & approvals...</div>;

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Bell size={20} className="text-emerald-900 animate-pulse"/> Notifications & Action Inbox</h2>
          <p className="text-slate-400 text-xs mt-0.5">Review, authorize, approve or decline pending ERP document route matrices assigned to your hierarchy level.</p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg uppercase">
          User: {currentUsername}
        </div>
      </div>

      {/* PENDING APPROVALS TABLE GRID */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-4 px-6 w-1/5">MODULE TYPE</th>
              <th className="py-4 px-6 w-1/6">DOC NO</th>
              <th className="py-4 px-6 w-1/5">REQUESTED BY</th>
              <th className="py-4 px-6">SUMMARY / DETAILS</th>
              <th className="py-4 px-6 text-center w-1/6">ACTIONS</th>
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
                          onClick={() => handleApprovalAction(item._id, 'APPROVED')}
                          className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-100 transition-all shadow-xs"
                          title="Approve Document"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          onClick={() => handleApprovalAction(item._id, 'REJECTED')}
                          className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-100 transition-all shadow-xs"
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