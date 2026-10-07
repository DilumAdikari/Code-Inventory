import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Loader2, X, Shirt, Package, Edit2 } from 'lucide-react';

const FinishedGoods = () => {
  const [products, setProducts] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null); // 🌟 Edit කරන ID එක රඳවා ගැනීමට

  const [form, setForm] = useState({
    itemCode: '',
    itemName: '',
    uom: ''
  });
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, uomsRes, sizesRes, colorsRes] = await Promise.all([
        axios.get('http://192.168.1.30:5003/api/finished-goods').catch(() => ({ data: [] })),
        axios.get('http://192.168.1.30:5003/api/uoms').catch(() => ({ data: [] })),
        axios.get('http://192.168.1.30:5003/api/sizes').catch(() => ({ data: [] })),
        axios.get('http://192.168.1.30:5003/api/colors').catch(() => ({ data: [] }))
      ]);

      const rawSizes = sizesRes.data;
      const parsedSizes = Array.isArray(rawSizes) ? rawSizes : (rawSizes.data || rawSizes.sizes || []);

      const rawUoms = uomsRes.data;
      const parsedUoms = Array.isArray(rawUoms) ? rawUoms : (rawUoms.data || rawUoms.uoms || []);

      const rawColors = colorsRes.data;
      const parsedColors = Array.isArray(rawColors) ? rawColors : (rawColors.data || rawColors.colors || []);

      setProducts(productsRes.data || []);
      setUoms(parsedUoms);
      setSizes(parsedSizes);
      setColors(parsedColors);
      setLoading(false);
    } catch (err) {
      console.error("❌ Error loading data:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleColorSelect = (e) => {
    const colorId = e.target.value;
    if (colorId && !selectedColors.includes(colorId)) {
      setSelectedColors([...selectedColors, colorId]);
    }
    e.target.value = '';
  };

  const removeColor = (colorIdToRemove) => {
    setSelectedColors(selectedColors.filter(id => id !== colorIdToRemove));
  };

  const handleSizeSelect = (e) => {
    const sizeId = e.target.value;
    if (sizeId && !selectedSizes.includes(sizeId)) {
      setSelectedSizes([...selectedSizes, sizeId]);
    }
    e.target.value = '';
  };

  const removeSize = (sizeIdToRemove) => {
    setSelectedSizes(selectedSizes.filter(id => id !== sizeIdToRemove));
  };

  // 🌟 Open Modal for Registering New Item
  const handleOpenCreateModal = () => {
    setEditingId(null);
    setForm({ itemCode: '', itemName: '', uom: '' });
    setSelectedColors([]);
    setSelectedSizes([]);
    setIsModalOpen(true);
  };

  // 🌟 Open Modal for Editing Existing Item
  const handleOpenEditModal = (p) => {
    setEditingId(p._id);
    setForm({
      itemCode: p.itemCode || '',
      itemName: p.itemName || '',
      uom: p.uom?._id || p.uom || ''
    });
    setSelectedSizes(Array.isArray(p.sizes) ? p.sizes.map(s => s._id || s) : []);
    setSelectedColors(Array.isArray(p.colors) ? p.colors.map(c => c._id || c) : []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemCode || !form.itemName || !form.uom) {
      alert("Please fill all required fields (Item Code, Name, UOM).");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        itemCode: form.itemCode,
        itemName: form.itemName,
        uom: form.uom,
        sizes: selectedSizes, 
        colors: selectedColors
      };

      if (editingId) {
        // 🌟 Update (PUT) Request
        await axios.put(`http://192.168.1.30:5003/api/finished-goods/${editingId}`, payload);
      } else {
        // 🌟 Create (POST) Request
        await axios.post('http://192.168.1.30:5003/api/finished-goods/create', payload);
      }
      
      setForm({ itemCode: '', itemName: '', uom: '' });
      setSelectedColors([]);
      setSelectedSizes([]);
      setEditingId(null);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to register finished good item profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    (p.itemCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.itemName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-12 text-base flex items-center justify-center gap-2 text-slate-500 font-sans tracking-wide">
        <Loader2 className="animate-spin text-emerald-800" size={20} /> Syncing finished goods registry indices...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 text-sm font-normal text-slate-700 font-sans tracking-wide">
      
      {/* HEADER WIDGET */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 w-full">
        <div>
          <h1 className="text-2xl font-normal text-slate-900 tracking-tight">Finished Goods Registry</h1>
          <p className="text-sm text-slate-500 font-normal mt-1">Configure and monitor manufactured garment styles, size specs, and variations.</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-normal text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all gap-2 border-none cursor-pointer"
        >
          <Plus size={18} /> Register New Item
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center w-full">
        <div className="relative w-full max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"><Search size={18} /></span>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Item Code or Name..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:border-slate-400 transition-all"
          />
        </div>
      </div>

      {/* DATA GRID TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold tracking-wider text-xs uppercase">
                <th className="p-4 px-6">Item Code</th>
                <th className="p-4">Item Name</th>
                <th className="p-4">Unit (UOM)</th>
                <th className="p-4">Assigned Sizes</th>
                <th className="p-4">Color Shading Variants</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-normal">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p, idx) => (
                  <tr key={p._id || `prod-${idx}`} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 px-6 text-sm text-slate-900 font-bold">{p.itemCode}</td>
                    <td className="p-4 text-sm text-slate-800">{p.itemName}</td>
                    <td className="p-4 text-sm text-slate-800">
                      <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium">
                        {p.uom?.abbreviation || p.uom?.name || p.uom?.uomName || 'N/A'}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex flex-wrap gap-1.5">
                        {p.sizes && p.sizes.length > 0 ? (
                          p.sizes.map((sz, szIdx) => (
                            <span key={sz?._id || `table-size-${szIdx}`} className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-800 font-bold">
                              {sz?.sizeName || sz?.name || sz?.title || sz?.size || sz?.code || 'Size'}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex flex-wrap gap-1.5">
                        {p.colors && p.colors.length > 0 ? (
                          p.colors.map((c, cIdx) => (
                            <span key={c?._id || `color-${cIdx}`} className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-600 flex items-center gap-1.5 shadow-sm">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c?.hexCode || '#ccc' }}></div>
                              {c?.colorName || c?.name || 'Color'}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleOpenEditModal(p)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-16 text-center text-slate-400 italic bg-white">
                    No active finished garment items registered in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER / EDIT NEW ITEM MODAL POPUP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Package size={18} className="text-emerald-800" /> {editingId ? "Edit Finished Good Item" : "Register New Item"}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm bg-white">
              
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Item Code *</label>
                <input 
                  type="text" required name="itemCode" value={form.itemCode} onChange={handleChange}
                  placeholder="e.g., FG-TSHIRT-001" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Item Name *</label>
                <input 
                  type="text" required name="itemName" value={form.itemName} onChange={handleChange}
                  placeholder="e.g., Slim Fit Mens T-Shirt" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider">UOM (Unit of Measure) *</label>
                <select 
                  required name="uom" value={form.uom} onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all"
                >
                  <option value="">-- Select Unit --</option>
                  {uoms.map(u => (
                    <option key={u._id} value={u._id}>{u.name || u.uomName} ({u.abbreviation || u.code})</option>
                  ))}
                </select>
              </div>

              {/* Size Specs / Variants */}
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Size Specs / Variants (Optional)</label>
                
                {selectedSizes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedSizes.map((sId, sIdx) => {
                      const sizeObj = sizes.find(s => String(s._id) === String(sId));
                      const finalSizeText = sizeObj ? (sizeObj.sizeName || sizeObj.name || sizeObj.title || sizeObj.size || sizeObj.code || sizeObj.sizeCode || 'Size') : 'Size';

                      return sizeObj ? (
                        <span key={sId || `sel-size-${sIdx}`} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          {finalSizeText}
                          <button type="button" onClick={() => removeSize(sId)} className="text-slate-400 hover:text-rose-500 ml-1 focus:outline-none"><X size={12}/></button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                <select 
                  onChange={handleSizeSelect}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all text-slate-500"
                >
                  <option value="">Search & select sizes...</option>
                  {Array.isArray(sizes) && sizes.map(s => {
                    const sName = s.sizeName || s.name || s.title || s.size || s.code || 'Size';
                    const sCode = s.code || s.sizeCode || '';
                    return (
                      <option key={s._id} value={s._id}>
                        {sName} {sCode && sName !== sCode ? `(${sCode})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Available Colors / Variants */}
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Available Colors / Variants</label>
                
                {selectedColors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedColors.map((cId, sIdx) => {
                      const colorObj = colors.find(c => String(c._id) === String(cId));
                      return colorObj ? (
                        <span key={cId || `sel-${sIdx}`} className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colorObj.hexCode || '#ccc' }}></div>
                          {colorObj.colorName || colorObj.name}
                          <button type="button" onClick={() => removeColor(cId)} className="text-slate-400 hover:text-rose-500 ml-1 focus:outline-none"><X size={12}/></button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                <select 
                  onChange={handleColorSelect}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all text-slate-500"
                >
                  <option value="">Search & select colors...</option>
                  {Array.isArray(colors) && colors.map(c => (
                    <option key={c._id} value={c._id}>{c.colorName || c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold border-none cursor-pointer text-sm transition-colors">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center border-none cursor-pointer text-sm transition-colors shadow-md">
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : (editingId ? "Update Item" : "Save Item")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinishedGoods;