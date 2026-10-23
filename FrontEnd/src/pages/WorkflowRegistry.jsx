import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, Loader2, ArrowLeft, GitBranch, ListFilter, X } from 'lucide-react';
import axios from 'axios';
import { confirmDialog } from '../components/AppDialog';
import { API_URL } from '../api/config';

const WorkflowRegistry = () => {
  const [workflows, setWorkflows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [isListView, setIsListView] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [permission, setPermission] = useState('NEED_ALL');

  // Matrix Grid Configuration states
  const [configUsers, setUsersConfiguration] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMode, setSelectedMode] = useState('APPROVER');
  const [selectedOrder, setSelectedOrder] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      const [wfRes, userRes] = await Promise.all([
        axios.get(`${API_URL}/workflows`),
        axios.get(`${API_URL}/auth/users`).catch(() => ({ data: [] })),
      ]);
      setWorkflows(wfRes.data || []);
      setUsers(userRes?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setDescription('');
    setPermission('NEED_ALL');
    setUsersConfiguration([]);
    setSelectedUser('');
    setSelectedMode('APPROVER');
    setSelectedOrder(1);
  };

  const openCreate = () => {
    resetForm();
    setIsListView(false);
  };

  const backToList = () => {
    resetForm();
    setIsListView(true);
  };

  // Loads an existing workflow into the form so it can be edited
  const handleEdit = (wf) => {
    setEditingId(wf._id);
    setCode(wf.code || '');
    setDescription(wf.description || '');
    setPermission(wf.permission || 'NEED_ALL');
    setUsersConfiguration(
      (wf.usersConfiguration || []).map((uc) => ({
        user: uc.user?._id || uc.user,
        username: uc.user?.username || uc.username || 'User',
        mode: uc.mode || 'APPROVER',
        order: Number(uc.order) || 1,
      }))
    );
    setSelectedUser('');
    setSelectedMode('APPROVER');
    setSelectedOrder(1);
    setIsListView(false);
  };

  const handleAddUserLine = () => {
    if (!selectedUser) return alert('Please select an employee user first.');
    const uObj = users.find((u) => u._id === selectedUser);
    if (!uObj) return alert('Selected user not found. Please reload the page.');

    if (configUsers.some((cu) => cu.user === selectedUser)) {
      alert('This user is already added to the configuration matrix.');
      return;
    }

    const newLine = {
      user: selectedUser,
      username: uObj.username,
      mode: selectedMode,
      order: Number(selectedOrder),
    };

    setUsersConfiguration([...configUsers, newLine].sort((a, b) => a.order - b.order));
    setSelectedUser('');
  };

  const handleSaveWorkflow = async () => {
    if (!code.trim() || configUsers.length === 0) {
      alert('Please enter Workflow Code and assign at least one authorization user.');
      return;
    }

    const payload = {
      code: code.trim(),
      description,
      permission,
      usersConfiguration: configUsers.map((cu) => ({
        user: cu.user,
        mode: cu.mode,
        order: cu.order,
      })),
    };

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`${API_URL}/workflows/${editingId}`, payload);
        alert('Workflow template updated successfully!');
      } else {
        await axios.post(`${API_URL}/workflows`, payload);
        alert('Workflow registration template saved successfully!');
      }
      resetForm();
      setIsListView(true);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving workflow matrix configuration.');
    } finally {
      setSaving(false);
    }
  };

  // Deletes a workflow after confirmation. The server refuses if it is already used in other records.
  const handleDeleteWorkflow = async (wf) => {
    if (!(await confirmDialog(`"${wf.code}" delete karanna da? Mema action eka undo karanna ba.`))) return;
    try {
      setDeletingId(wf._id);
      await axios.delete(`${API_URL}/workflows/${wf._id}`);
      if (editingId === wf._id) resetForm();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete workflow template.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin text-emerald-800" size={20} />
        Loading active approval configurations...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 relative animate-in fade-in duration-200">

      {/* HEADER BANNER SECTION */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">WORKFLOW Registry</h2>
          <p className="text-slate-400 text-xs mt-0.5">Manage organization sign-off structures, authorization controls and multi-tier routing paths.</p>
        </div>

        {isListView && (
          <button
            onClick={openCreate}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all"
          >
            <Plus size={16} /> Add New Matrix
          </button>
        )}
      </div>

      {/* --- SAVED WORKFLOWS LIST TABLE VIEW --- */}
      {isListView ? (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-6 w-1/3">CODE / TEMPLATE NAME</th>
                <th className="py-4 px-6 w-1/2">APPROVAL ROUTING DESCRIPTION PATHWAY</th>
                <th className="py-4 px-6 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {workflows.length > 0 ? (
                workflows.map((wf) => (
                  <tr key={wf._id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6 font-semibold text-slate-800">{wf.code}</td>
                    <td className="py-4 px-6 text-slate-600">
                      {wf.description || (
                        <span className="flex flex-wrap gap-1.5 items-center text-xs">
                          Approval By: {wf.usersConfiguration?.map((uc, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-50 border border-slate-200/60 rounded text-slate-700">
                              {uc.order}.{uc.user?.username || uc.username || 'User'} ({uc.mode})
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEdit(wf)}
                        title="Edit workflow"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkflow(wf)}
                        disabled={deletingId === wf._id}
                        title="Delete workflow"
                        className="ml-1.5 text-slate-400 hover:text-rose-600 p-1.5 rounded-md transition-all disabled:opacity-50"
                      >
                        {deletingId === wf._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="py-16 text-center text-slate-400 italic">
                    No configured authorization workflow matrices registered yet. Click 'Add New Matrix' to build.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (

        /* --- WORKFLOW CREATE / EDIT FORM VIEW --- */
        <div className="space-y-6">
          <div className="flex items-center">
            <button
              onClick={backToList}
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-all font-medium text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft size={14} /> Back to Registry List
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6 items-start animate-in fade-in zoom-in-95 duration-150">
            {/* Left Form */}
            <div className="col-span-4 bg-white p-5 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  <GitBranch size={14} className="text-emerald-800" />
                  {editingId ? 'Edit Workflow Template' : 'Workflow Template'}
                </h3>
                {editingId && (
                  <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 cursor-pointer">
                    <X size={12} /> Cancel edit
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-medium">Workflow Code / Name *</label>
                <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g., Purchasing Approval Elisha Corewear" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-800 font-medium text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-medium">Description Path Log</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Approval By 1.Dushmantha 2.Imasha" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg h-24 focus:outline-none text-slate-800 font-medium text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-medium">Permission Rule Set</label>
                <select value={permission} onChange={(e) => setPermission(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-sm text-slate-700">
                  <option value="NEED_ALL">NEED ALL (Everyone must sign off)</option>
                  <option value="ANY_ONE">ANY ONE (At least one signature required)</option>
                </select>
              </div>
            </div>

            {/* Right Form */}
            <div className="col-span-8 bg-white p-5 rounded-xl border border-slate-100 space-y-4">
              <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide border-b pb-2 flex items-center gap-1.5"><ListFilter size={14} className="text-emerald-800" /> User Configuration Matrix</h3>

              <div className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Select User *</label>
                  <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-sm text-slate-800 h-10">
                    <option value="">{users.length ? 'Select the User' : 'No users found'}</option>
                    {users.map((u) => <option key={u._id} value={u._id}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Mode Type</label>
                  <select value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-sm text-slate-800 h-10">
                    <option value="APPROVER">APPROVER</option>
                    <option value="RECEIVER">RECEIVER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Order Level Hierarchy</label>
                  <select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-medium text-sm text-slate-800 h-10">
                    <option value="1">Level - 1</option>
                    <option value="2">Level - 2</option>
                    <option value="3">Level - 3</option>
                  </select>
                </div>
                <button type="button" onClick={handleAddUserLine} className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-1"><Plus size={16} /> Add Level</button>
              </div>

              {/* Configured Table Grid */}
              <div className="border border-slate-100 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-4 text-center">ORDER</th>
                      <th className="py-2.5 px-4">EMPLOYEE</th>
                      <th className="py-2.5 px-4">TYPE</th>
                      <th className="py-2.5 px-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {configUsers.length > 0 ? configUsers.map((cu, idx) => (
                      <tr key={`${cu.user}-${idx}`} className="hover:bg-slate-50/20">
                        <td className="py-3 px-4 text-center font-semibold text-emerald-800">{cu.order}</td>
                        <td className="py-3 px-4">{cu.username}</td>
                        <td className="py-3 px-4"><span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600 font-medium">{cu.mode}</span></td>
                        <td className="py-3 px-4 text-center">
                          <button type="button" onClick={() => setUsersConfiguration(configUsers.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-600 transition-colors"><X size={16} /></button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="py-8 text-center text-slate-400 italic">No structural hierarchy paths built yet. Add lines using the panel controls.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={handleSaveWorkflow} disabled={saving} className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white font-medium rounded-lg shadow-sm flex items-center gap-1.5 text-sm transition-all disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingId ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowRegistry;