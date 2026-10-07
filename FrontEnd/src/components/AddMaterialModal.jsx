import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Package, Search } from 'lucide-react';
import { materialApi } from '../api/materialApi';
import { colorApi } from '../api/colorApi';
import { uomApi } from '../api/uomApi';

const AddMaterialModal = ({ isOpen, onClose, onMaterialAdded }) => {
  const [dbColors, setDbColors] = useState([]);
  const [dbUoms, setDbUoms] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Form States
  const [formData, setFormData] = useState({ code: '', name: '', uom: '' });
  const [selectedColors, setSelectedColors] = useState([]); // Array of selected color objects
  
  // Search & Dropdown States
  const [searchTerm, setSearchTerm] = useState('');
  const [isColorDropdownOpen, setIsColorDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown එකෙන් පිට ක්ලික් කරාම dropdown එක වහන්න
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsColorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const fetchMasterData = async () => {
        try {
          setLoadingMaster(true);
          const [colorRes, uomRes] = await Promise.all([
            colorApi.getAllColors(),
            uomApi.getAllUoms()
          ]);
          setDbColors(colorRes.data);
          setDbUoms(uomRes.data);
        } catch (err) {
          console.error("Failed to load master data", err);
        } finally {
          setLoadingMaster(false);
        }
      };
      fetchMasterData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // කලර් එකක් සිලෙක්ට් කරද්දී ක්‍රියාත්මක වන function එක
  const handleSelectColor = (color) => {
    if (!selectedColors.some(c => c._id === color._id)) {
      setSelectedColors([...selectedColors, color]);
    }
    setSearchTerm(''); // Search එක reset කරන්න
    setIsColorDropdownOpen(false);
  };

  // සිලෙක්ට් කරපු කලර් එකක් අයින් (Remove) කරද්දී
  const handleRemoveColor = (colorId) => {
    setSelectedColors(selectedColors.filter(c => c._id !== colorId));
  };

  // Type කරන නමට අනුව කලර්ස් filter කිරීම (කලින් සිලෙක්ට් කරපු ඒවා අයින් කරලා පෙන්වයි)
  const filteredColors = dbColors.filter(color => 
    color.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedColors.some(sc => sc._id === color._id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.uom) {
      setError('Please select a Unit of Measure (UOM).');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await materialApi.createMaterial({
        itemCode: formData.code,
        materialName: formData.name,
        uom: formData.uom,
        colors: selectedColors.map(c => c._id) // Backend එකට යවන්නේ ID ටික විතරයි
      });
      
      setSubmitting(false);
      onMaterialAdded(); 
      onClose(); 
      setFormData({ code: '', name: '', uom: '' }); 
      setSelectedColors([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add material.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package size={16} className="text-emerald-800" /> Register New Material
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* MODAL FORM */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl font-semibold text-rose-800">
              {error}
            </div>
          )}

          {/* Item Code */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-600 uppercase tracking-wider">Item Code *</label>
            <input type="text" name="code" required value={formData.code} onChange={handleChange} placeholder="e.g., MAT-FAB-001" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all" />
          </div>

          {/* Material Name */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-600 uppercase tracking-wider">Material Name *</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} placeholder="e.g., 100% Cotton Navy Fabric" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all" />
          </div>

          {/* UOM DROPDOWN */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-600 uppercase tracking-wider">UOM (Unit of Measure) *</label>
            {loadingMaster ? (
              <div className="text-slate-400 py-1 flex items-center gap-1"><Loader2 className="animate-spin" size={12} /> Loading units...</div>
            ) : (
              <select name="uom" required value={formData.uom} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-all">
                <option value="">-- Select Unit --</option>
                {dbUoms.map((uom) => (
                  <option key={uom._id} value={uom._id}>{uom.name} ({uom.abbreviation})</option>
                ))}
              </select>
            )}
          </div>

          {/* 🌟 SEARCHABLE MULTI-SELECT COLORS (NEW OPTION) */}
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block font-bold text-slate-600 uppercase tracking-wider">Available Colors / Variants</label>
            
            {/* Main Selection Area & Search Input */}
            <div 
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5 items-center min-h-10 cursor-text focus-within:ring-2 focus-within:ring-emerald-800/20 focus-within:border-emerald-800 bg-slate-50 transition-all"
              onClick={() => setIsColorDropdownOpen(true)}
            >
              {/* Selected Color Tags */}
              {selectedColors.map((color) => (
                <span key={color._id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: color.colorCode }}></span>
                  {color.name}
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveColor(color._id); }} className="text-slate-400 hover:text-slate-600 ml-0.5">
                    <X size={12} />
                  </button>
                </span>
              ))}

              {/* Live Search Field */}
              <input 
                type="text"
                placeholder={selectedColors.length === 0 ? "Search & select colors..." : ""}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setIsColorDropdownOpen(true); }}
                className="flex-1 min-w-[120px] bg-transparent border-none outline-none py-0.5 font-medium text-slate-700 placeholder-slate-400 text-xs"
              />
            </div>

            {/* Filtered Dropdown Results List */}
            {isColorDropdownOpen && !loadingMaster && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 p-1 space-y-0.5">
                {filteredColors.length === 0 ? (
                  <div className="p-3 text-slate-400 text-center italic">No colors found matching "{searchTerm}"</div>
                ) : (
                  filteredColors.map((color) => (
                    <button
                      key={color._id}
                      type="button"
                      onClick={() => handleSelectColor(color)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 rounded-lg transition-all font-medium text-slate-700"
                    >
                      <span className="w-3 h-3 rounded-full border border-slate-300 shrink-0" style={{ backgroundColor: color.colorCode }}></span>
                      <span className="truncate">{color.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-auto uppercase">{color.colorCode}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 py-2 font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-2 font-bold text-white bg-emerald-900 hover:bg-emerald-800 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all">
              {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMaterialModal;