import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Loader2, Package, X, Edit2 } from 'lucide-react';
import { API_URL } from "../api/config";


const AddMaterialModal = ({ isOpen, onClose, onMaterialAdded, editingMaterial }) => {
  const [uoms, setUoms] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]); 

  const [itemCode, setItemCode] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [selectedUom, setSelectedUom] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]); 

  const [loadingSizes, setLoadingSizes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [colorSearch, setColorSearch] = useState('');
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);

  const [sizeSearch, setSizeSearch] = useState('');
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const loadMasters = async () => {
      try {
        setLoadingSizes(true);
        const [uomRes, colorRes, sizeRes] = await Promise.all([
          axios.get('${API_URL}/uoms').catch(() => ({ data: [] })),
          axios.get('${API_URL}/colors').catch(() => ({ data: [] })),
          axios.get('${API_URL}/sizes').catch(() => ({ data: [] }))
        ]);
        setUoms(uomRes.data || []);
        setColors(colorRes.data || []);
        setSizes(sizeRes.data || []);
      } catch (err) {
        console.error("Error loading master data:", err);
      } finally {
        setLoadingSizes(false);
      }
    };
    loadMasters();

   
    if (editingMaterial) {
      setItemCode(editingMaterial.itemCode || '');
      setMaterialName(editingMaterial.materialName || '');
      setSelectedUom(editingMaterial.uom?._id || editingMaterial.uom || '');
      setSelectedColors(Array.isArray(editingMaterial.colors) ? editingMaterial.colors.map(c => c._id || c) : []);
      setSelectedSizes(Array.isArray(editingMaterial.sizes) ? editingMaterial.sizes.map(s => s._id || s) : (editingMaterial.sizeId ? [editingMaterial.sizeId._id || editingMaterial.sizeId] : []));
    } else {
      setItemCode('');
      setMaterialName('');
      setSelectedUom('');
      setSelectedColors([]);
      setSelectedSizes([]);
    }
  }, [isOpen, editingMaterial]);

  const handleColorToggle = (colorId) => {
    if (selectedColors.includes(colorId)) {
      setSelectedColors(selectedColors.filter(id => id !== colorId));
    } else {
      setSelectedColors([...selectedColors, colorId]);
    }
  };

  const handleSizeToggle = (sizeId) => {
    if (selectedSizes.includes(sizeId)) {
      setSelectedSizes(selectedSizes.filter(id => id !== sizeId));
    } else {
      setSelectedSizes([...selectedSizes, sizeId]);
    }
  };

  const filteredColors = colors.filter(c => 
    (c.name || c.colorName || '').toLowerCase().includes(colorSearch.toLowerCase())
  );

  const filteredSizes = sizes.filter(s => 
    s.status === 'Active' && 
    ((s.sizeCode || '').toLowerCase().includes(sizeSearch.toLowerCase()) || 
     (s.sizeDescription || '').toLowerCase().includes(sizeSearch.toLowerCase()))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemCode || !materialName || !selectedUom) {
      alert("Please fill all required asterisk (*) fields.");
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        itemCode: itemCode.trim(),
        materialName: materialName.trim(),
        uom: selectedUom,
        colors: selectedColors,
        sizes: selectedSizes
      };

      const editId = editingMaterial?._id || editingMaterial?.id;

      if (editId) {
        await axios.put(`${API_URL}/materials/${editId}`, payload);
      } else {
        await axios.post('${API_URL}/materials', payload);
      }

      setItemCode('');
      setMaterialName('');
      setSelectedUom('');
      setSelectedColors([]);
      setSelectedSizes([]); 
      onMaterialAdded(); 
      onClose(); 
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to register material profile.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-100 flex flex-col overflow-hidden text-sm font-semibold text-slate-700 shadow-xl animate-in zoom-in-95 duration-200 max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Package size={16} className="text-emerald-800" /> {editingMaterial ? "Edit Material Profile" : "Register New Material"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-all border-none cursor-pointer"><X size={18} /></button>
        </div>

        {/* Modal Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">Item Code *</label>
            <input type="text" required value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="e.g., MAT-FAB-001" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-slate-400 h-9 text-sm uppercase shadow-none" />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">Material Name *</label>
            <input type="text" required value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="e.g., 100% Cotton Navy Fabric" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-slate-400 h-9 text-sm shadow-none" />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">UOM (Unit of Measure) *</label>
            <select required value={selectedUom} onChange={(e) => setSelectedUom(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-9 text-sm shadow-none">
              <option value="">-- Select Unit --</option>
              {uoms.map(u => <option key={u._id} value={u._id}>{u.name} ({u.abbreviation})</option>)}
            </select>
          </div>

          {/* Multiple Sizes Dropdown / Selection Section */}
          <div className="space-y-1 relative">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">Size Specs (Optional)</label>
            <div onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 cursor-pointer h-9 flex items-center justify-between text-xs shadow-none">
              {selectedSizes.length === 0 ? "Search & select sizes..." : <span className="text-emerald-900 font-bold">{selectedSizes.length} Size(s) Selected</span>}
            </div>

            {isSizeDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg z-50 p-2 space-y-2 shadow-xl">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={sizeSearch} 
                    onChange={(e) => setSizeSearch(e.target.value)} 
                    onClick={(e) => e.stopPropagation()} 
                    placeholder="Type to filter sizes..." 
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border rounded text-xs focus:outline-none font-medium shadow-none" 
                  />
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {loadingSizes ? (
                    <div className="p-2 text-center text-xs text-slate-400">Loading sizes...</div>
                  ) : filteredSizes.length > 0 ? (
                    filteredSizes.map(s => {
                      const isChecked = selectedSizes.includes(s._id);
                      return (
                        <div key={s._id} onClick={(e) => { e.stopPropagation(); handleSizeToggle(s._id); }} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs font-medium">
                          <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded border-slate-300 text-emerald-900 focus:ring-emerald-900" />
                          <span className="text-slate-700">{s.sizeCode} {s.sizeDescription ? `- ${s.sizeDescription}` : ''}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-2 text-center text-xs text-slate-400">No sizes found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Color Dropdown Section with Filter Search Bar */}
          <div className="space-y-1 relative">
            <label className="block text-[10px] text-slate-400 font-bold uppercase">Available Colors / Variants</label>
            <div onClick={() => setIsColorDropdownOpen(!isColorDropdownOpen)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 cursor-pointer h-9 flex items-center justify-between text-xs shadow-none">
              {selectedColors.length === 0 ? "Search & select colors..." : <span className="text-emerald-900 font-bold">{selectedColors.length} Color(s) Selected</span>}
            </div>
            
            {isColorDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg z-50 p-2 space-y-2 shadow-xl">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={colorSearch} 
                    onChange={(e) => setColorSearch(e.target.value)} 
                    onClick={(e) => e.stopPropagation()} 
                    placeholder="Type to filter colors..." 
                    className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border rounded text-xs focus:outline-none font-medium shadow-none" 
                  />
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {filteredColors.map(c => {
                    const isChecked = selectedColors.includes(c._id);
                    return (
                      <div key={c._id} onClick={(e) => { e.stopPropagation(); handleColorToggle(c._id); }} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer text-xs font-medium">
                        <input type="checkbox" checked={isChecked} onChange={() => {}} className="rounded border-slate-300 text-emerald-900 focus:ring-emerald-900" />
                        <span className="w-2.5 h-2.5 rounded-full border shrink-0" style={{ backgroundColor: c.colorCode || c.code || '#ccc' }}></span>
                        <span className="text-slate-700">{c.name || c.colorName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer (Buttons - Always Visible) */}
          <div className="flex gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 font-bold transition-all border-none shadow-none cursor-pointer">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all border-none shadow-none cursor-pointer">
              {submitting ? <Loader2 className="animate-spin" size={14} /> : (editingMaterial ? "Update Item" : "Save Item")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const MaterialRegistry = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get('${API_URL}/materials');
      setMaterials(response.data || []);
      setLoading(false);
    } catch (err) {
      console.error("❌ Error fetching material grid registry:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleOpenCreate = () => {
    setEditingMaterial(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (material) => {
    setEditingMaterial(material);
    setIsModalOpen(true);
  };

  const filteredMaterials = materials.filter(m => 
    (m.itemCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.materialName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2 font-sans">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Loading stock material profiles registry...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 font-sans text-xs font-semibold text-slate-800">
      
      {/* HEADER WIDGET */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Material Profiles Registry</h1>
          <p className="text-sm text-slate-500 font-normal mt-1">Configure and monitor core raw fabric rolls, buttons, and accessories logs.</p>
        </div>
        
        <button 
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-bold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl transition-all gap-2 border-none shadow-none cursor-pointer"
        >
          <Plus size={18} />
          Register New Material
        </button>
      </div>

      {/* FILTER SEARCH FIELD */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center w-full shadow-none">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Search size={18} /></span>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Item Code or Material Name..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:border-slate-400 transition-all shadow-none"
          />
        </div>
      </div>

      {/* MAIN DATA SHEET GRID TABLE */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden w-full shadow-none">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 px-6">Item Code</th>
                <th className="p-4 px-6">Material Name</th>
                <th className="p-4 px-6">Unit (UOM)</th>
                <th className="p-4 px-6">Assigned Sizes</th>
                <th className="p-4 px-6">Color Shading Variants</th>
                <th className="p-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-xs">
              {filteredMaterials.length > 0 ? (
                filteredMaterials.map((material, idx) => (
                  <tr key={material._id || idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 px-6 font-bold text-slate-900 uppercase tracking-wide font-mono">{material.itemCode}</td>
                    <td className="p-4 px-6 font-semibold text-slate-800">{material.materialName}</td>
                    <td className="p-4 px-6"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-bold">{material.uom?.name || material.uom || 'Pcs'}</span></td>
                    
                    <td className="p-4 px-6">
                      <div className="flex flex-wrap gap-1 items-center">
                        {material.sizes && material.sizes.length > 0 ? (
                          material.sizes.map((s, sIdx) => (
                            <span key={s._id || sIdx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-[11px] font-bold">
                              {s.sizeCode || s.sizeDescription || 'Size'}
                            </span>
                          ))
                        ) : material.sizeId ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-[11px] font-bold">
                            {material.sizeId?.sizeCode || '-'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic font-normal">No sizes assigned</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 px-6">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {material.colors && material.colors.length > 0 ? (
                          material.colors.map((c, cIdx) => (
                            <span key={c._id || cIdx} className="inline-flex items-center gap-1 px-2 py-0.5 border border-slate-200 bg-white rounded-md text-[11px] font-medium text-slate-600">
                              <span className="w-2 h-2 rounded-full border border-slate-300 block shrink-0" style={{ backgroundColor: c.colorCode || c.code || '#ccc' }}></span>
                              {c.name || c.colorName || 'Variant'}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[11px] italic font-normal">No color shades mapped</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 px-6 text-center">
                      <button 
                        onClick={() => handleOpenEdit(material)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 italic bg-white font-normal">
                    No matching material master profiles found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddMaterialModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onMaterialAdded={fetchMaterials} 
        editingMaterial={editingMaterial}
      />

    </div>
  );
};

export default MaterialRegistry;