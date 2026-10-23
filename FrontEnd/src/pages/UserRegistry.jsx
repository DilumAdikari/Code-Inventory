import React, { useState, useEffect } from 'react';
import { Plus, ShieldCheck, UserPlus, Users, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";

const UserRegistry = () => {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [matrix, setMatrix] = useState({
    dashboard: true,
    salesOrders: false,
    costing: false,
    materialIssuing: false,
    grnHistory: false,
    materialRegistry: false,
    partners: false,
    settings: false,
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/users`);
      setUsersList(res.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error loading users:", err);
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleUserSelect = (userId) => {
    setSelectedUserId(userId);
    if (!userId) return;
    const uObj = usersList.find(u => u._id === userId);
    if (uObj && uObj.permissions) {
      setMatrix({
        dashboard: uObj.permissions.dashboard ?? true,
        salesOrders: uObj.permissions.salesOrders ?? false,
        costing: uObj.permissions.costing ?? false,
        materialIssuing: uObj.permissions.materialIssuing ?? false,
        grnHistory: uObj.permissions.grnHistory ?? false,
        materialRegistry: uObj.permissions.materialRegistry ?? false,
        partners: uObj.permissions.partners ?? false,
        settings: uObj.permissions.settings ?? false,
      });
    }
  };

  const handleCheckboxChange = (e) => {
    setMatrix({ ...matrix, [e.target.name]: e.target.checked });
  };

  const handleRegisterUser = async (e) => {
    e.preventDefault();
    if (!regUsername || !regPassword) return alert("Please fill all fields.");
    try {
      await axios.post('${API_URL}/auth/register', {
        username: regUsername,
        password: regPassword
      });
      alert(`User "${regUsername}" registered successfully!`);
      setRegUsername(''); setRegPassword('');
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Error registering user.");
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUserId) return alert("Please select a user first.");
    try {
      await axios.put(`${API_URL}/auth/users/${selectedUserId}/permissions`, {
        permissions: matrix
      });
      alert("Access control matrix updated successfully!");
      loadUsers();
    } catch (err) {
      alert("Failed to update controls.");
    }
  };

  if (loading) return <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-800" size={20} /> Building user privilege matrix...</div>;

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 relative animate-in fade-in duration-200">
      <div className="bg-white p-5 rounded-xl border border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800">User Access Control Panel</h2>
        <p className="text-slate-400 text-xs mt-0.5">Define system permissions and screen restrictions per user account.</p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-4 bg-white p-5 rounded-xl border border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide border-b pb-2 flex items-center gap-1.5"><UserPlus size={15} className="text-emerald-800"/> Register Profile</h3>
          <form onSubmit={handleRegisterUser} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 uppercase font-medium">Username *</label>
              <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="username" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-800" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 uppercase font-medium">Password *</label>
              <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-slate-800" />
            </div>
            <button type="submit" className="w-full py-2 bg-emerald-900 hover:bg-emerald-800 text-white font-medium rounded-lg text-xs transition-all flex items-center justify-center gap-1.5"><Plus size={14}/> Save User</button>
          </form>
        </div>

        <div className="col-span-8 bg-white p-5 rounded-xl border border-slate-100 space-y-5">
          <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide border-b pb-2 flex items-center gap-1.5"><ShieldCheck size={16} className="text-emerald-800"/> Privilege Matrix Grid</h3>
          <div className="flex items-center gap-3 bg-slate-50/60 p-3 rounded-lg border border-slate-100">
            <Users size={16} className="text-slate-400 shrink-0" />
            <div className="flex-1">
              <select value={selectedUserId} onChange={(e) => handleUserSelect(e.target.value)} className="w-full bg-transparent font-medium text-slate-800 focus:outline-none text-sm">
                <option value="">-- Choose System User --</option>
                {usersList.map(u => <option key={u._id} value={u._id}>{u.username.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {selectedUserId ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 border border-slate-100 rounded-xl p-5 bg-white">
                {Object.keys(matrix).map((key) => (
                  <label key={key} className="flex items-center gap-3 p-2.5 bg-slate-50/40 border border-slate-100 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input type="checkbox" name={key} checked={matrix[key]} onChange={handleCheckboxChange} className="w-4 h-4 rounded text-emerald-800 accent-emerald-800" />
                    <span className="font-medium text-slate-700 uppercase text-xs tracking-wide">{key.replace(/([A-Z])/g, ' $1')}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={handleSavePermissions} className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white font-medium rounded-lg flex items-center gap-1.5 shadow-sm text-xs transition-all"><CheckCircle2 size={15}/> Commit Matrix Privileges</button>
              </div>
            </div>
          ) : (
            <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 italic">Choose a user profile to deploy access configuration rules.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserRegistry;