import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, ArrowLeft, Loader2, Check, AlertCircle, CheckCircle2, X, Printer, Search } from 'lucide-react';
import { colorApi } from '../api/colorApi';

const SalesOrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [allColors, setAllColors] = useState([]);
  const [filteredColors, setFilteredColors] = useState([]);
  const [allSizes, setAllSizes] = useState([]);
  const [filteredSizes, setFilteredSizes] = useState([]); 
  const [finishedGoods, setFinishedGoods] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modern Floating Toast Notification State
  const [toast, setToast] = useState({ show: false, type: '', message: '' });

  // Custom Delete Confirmation Modal States
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null });

  // Row Input Form States
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState(''); 
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');

  // Searchable Dropdown States and Ref
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const showNotification = (type, message) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: '', message: '' });
    }, 4000);
  };

  // Dropdown එකෙන් පිටත ක්ලික් කළහොත් එය වැසීමට
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadOrderData = async () => {
    try {
      const [orderRes, colorRes, fgRes, sizeRes] = await Promise.all([
        axios.get(`http://192.168.1.30:5003/api/sales-orders/${id}`),
        colorApi.getAllColors(),
        axios.get('http://192.168.1.30:5003/api/finished-goods').catch(() => ({ data: [] })),
        axios.get('http://192.168.1.30:5003/api/sizes').catch(() => ({ data: [] }))
      ]);
      
      setOrder(orderRes.data);
      setAllColors(colorRes.data);
      setFinishedGoods(fgRes.data || []);

      const rawSizes = sizeRes.data;
      const parsedSizes = Array.isArray(rawSizes) ? rawSizes : (rawSizes.data || rawSizes.sizes || []);
      setAllSizes(parsedSizes);

      setLoading(false);
    } catch (err) {
      console.error("Error loading order details:", err);
      showNotification('error', 'Failed to fetch database masters.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrderData();
  }, [id]);

  // 🌟 Material Change -> Filter Colors & Sizes
  useEffect(() => {
    if (!selectedMaterial) {
      setFilteredColors([]);
      setFilteredSizes([]);
      setSelectedColor('');
      setSelectedSize('');
      return;
    }

    const currentFg = finishedGoods.find(f => String(f._id) === String(selectedMaterial));
    
    if (currentFg) {
      // 1. Colors Filter
      setFilteredColors(currentFg.colors && currentFg.colors.length > 0 ? currentFg.colors : allColors);

      // 2. Sizes Filter
      if (currentFg.sizes && currentFg.sizes.length > 0) {
        const fgSizeIds = currentFg.sizes.map(s => String(typeof s === 'object' && s !== null ? (s._id || s.id || s) : s));
        
        const matchedSizes = allSizes.filter(masterSize => 
          fgSizeIds.includes(String(masterSize._id)) || fgSizeIds.includes(String(masterSize.id))
        );

        setFilteredSizes(matchedSizes.length > 0 ? matchedSizes : allSizes);
      } else {
        setFilteredSizes(allSizes);
      }
    } else {
      setFilteredColors(allColors);
      setFilteredSizes(allSizes);
    }

    setSelectedColor('');
    setSelectedSize('');
  }, [selectedMaterial, finishedGoods, allColors, allSizes]);

  const handlePriceChange = (e) => {
    const value = e.target.value;
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setPrice(cleanValue);
  };

  // ADD ITEM ROW
  const handleAddItem = async () => {
    if (!selectedMaterial || !selectedColor || !selectedSize || !qty || !price) {
      showNotification('error', 'Please select Finished Good, Colour, Size, Price and Quantity!');
      return;
    }

    if (Number(qty) <= 0 || Number(price) <= 0) {
      showNotification('error', 'Price and Quantity must be greater than 0.');
      return;
    }

    const materialId = typeof selectedMaterial === 'object' ? selectedMaterial._id : selectedMaterial;
    const colorId = typeof selectedColor === 'object' ? selectedColor._id : selectedColor;

    setActionLoading(true);
    try {
      const newItemPayload = {
        material: materialId, 
        color: colorId,       
        size: selectedSize,
        quantity: Number(qty),
        unitPrice: Number(price)
      };

      await axios.post(`http://192.168.1.30:5003/api/sales-orders/${id}/items`, newItemPayload);
      await loadOrderData(); 
      
      showNotification('success', 'Breakdown line added successfully!');
      
      setPrice('');
      setQty('');
      setSelectedColor('');
      setSelectedSize('');
      setSelectedMaterial('');
      setSearchTerm('');
    } catch (err) {
      console.error(err);
      showNotification('error', err.response?.data?.message || 'Failed to add row item.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit For Approval
  const handleConfirmOrder = async () => {
    setActionLoading(true);
    try {
      const currentUsername = localStorage.getItem('username') || 'DILUM';
      const response = await axios.put(`http://192.168.1.30:5003/api/sales-orders/${id}/status`, {
        status: 'Pending Approval',
        workflowId: order.workflowTemplate, 
        requestedBy: currentUsername
      });
      
      setOrder(response.data);
      showNotification('success', 'Sales Order submitted for approval successfully!');
      
      setTimeout(() => {
        navigate('/sales-orders');
      }, 1500);
    } catch (err) {
      console.error(err);
      showNotification('error', err.response?.data?.message || 'Failed to submit sales order.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDeleteItem = (itemId) => {
    setDeleteModal({ isOpen: true, itemId });
  };

  const executeDeleteItem = async () => {
    const itemId = deleteModal.itemId;
    setDeleteModal({ isOpen: false, itemId: null }); 
    
    try {
      await axios.delete(`http://192.168.1.30:5003/api/sales-orders/${id}/items/${itemId}`);
      await loadOrderData();
      showNotification('success', 'Row item removed successfully.');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to remove row item.');
    }
  };

  const filteredFinishedGoods = searchTerm.trim().length >= 2 
    ? finishedGoods.filter(fg => 
        (fg.itemCode || fg.styleNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fg.itemName || fg.styleName || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const getMaterialDisplayName = (item) => {
    if (!item || !item.material) return 'N/A';

    const matId = typeof item.material === 'object' && item.material !== null
      ? String(item.material._id || '')
      : String(item.material);
    
    if (matId && finishedGoods && finishedGoods.length > 0) {
      const fgObj = finishedGoods.find(f => String(f._id) === matId);
      if (fgObj) {
        const code = fgObj.itemCode || fgObj.styleNo || fgObj.code || '';
        const name = fgObj.itemName || fgObj.styleName || fgObj.materialName || '';
        if (name) {
          return code ? `[${code}] ${name}` : name;
        }
      }
    }

    if (typeof item.material === 'object' && item.material !== null) {
      const code = item.material.itemCode || item.material.styleNo || item.material.code || '';
      const name = item.material.itemName || item.material.styleName || item.material.materialName || '';
      if (name) {
        return code ? `[${code}] ${name}` : name;
      }
    }

    return typeof item.material === 'string' ? item.material : 'Finished Good Style';
  };

  // 🌟 ටේබල් එකේ සයිස් එකේ නම (sizeCode) නිවැරදිව පෙන්වා ගැනීමට හෙල්පර් פන්ක්ෂන් එක
  const getSizeDisplayName = (itemSize) => {
    if (!itemSize) return 'N/A';
    if (typeof itemSize === 'object') {
      return itemSize.sizeCode || itemSize.sizeDescription || itemSize.name || 'N/A';
    }
    // itemSize එක ID එකක් ලෙස පැමිණියහොත් allSizes මාස්ටර් ලිස්ට් එකෙන් සෙවීම
    const foundSize = allSizes.find(s => String(s._id) === String(itemSize) || String(s.id) === String(itemSize));
    if (foundSize) {
      return foundSize.sizeCode || foundSize.sizeDescription || foundSize.name || itemSize;
    }
    return itemSize;
  };

  if (loading) return <div className="p-12 text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin text-emerald-800" size={20} /> Loading grid layout...</div>;
  if (!order) return <div className="p-8 text-sm text-rose-600 font-semibold">Sales Order entry not found.</div>;

  const isReadOnly = order.status !== 'Draft'; 

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 relative animate-in fade-in duration-200">
      
      {toast.show && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg text-sm font-medium min-w-[320px] ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
            <div className="flex-1">{toast.message}</div>
            <button onClick={() => setToast({ show: false, type: '', message: '' })} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-xl border border-slate-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><AlertCircle size={22} /></div>
            <div>
              <h4 className="text-base font-semibold text-slate-800">Remove Line Item?</h4>
              <p className="text-slate-500 text-xs mt-1">Are you sure you want to delete this row?</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteModal({ isOpen: false, itemId: null })} className="flex-1 py-2.5 font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all">Cancel</button>
              <button onClick={executeDeleteItem} className="flex-1 py-2.5 font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sales-orders')} className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 transition-all"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">SO - {order.orderRef}</h2>
            <p className="text-slate-400 text-xs mt-0.5">Manage color/size matrix and breakdown metrics.</p>
          </div>
        </div>
        <button 
          onClick={() => window.print()}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg shadow-xs gap-2 transition-all"
        >
          <Printer size={16} /> Print Sheet
        </button>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-100 grid grid-cols-4 gap-6">
        <div><span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider block mb-1">Customer / Buyer</span><span className="text-slate-800 font-semibold text-base">{order.buyerName}</span></div>
        <div><span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider block mb-1">Delivery Date</span><span className="text-slate-700 font-medium text-base">{new Date(order.shipmentDate).toISOString().split('T')[0]}</span></div>
        <div><span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider block mb-1.5">Status</span><span className={`inline-block font-medium px-3 py-1 rounded-md border text-xs ${order.status === 'Completed' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : order.status === 'Pending Approval' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>✓ {order.status}</span></div>
        <div><span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider block mb-1">Logged Date</span><span className="text-slate-700 font-medium text-base">{new Date(order.createdAt).toISOString().split('T')[0]}</span></div>
      </div>

      {/* CONTROL PANEL */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 space-y-4 print:hidden disabled:opacity-50">
        <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-2">
          Add Order Breakdown Details 
          {isReadOnly && <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded normal-case tracking-normal">Worksheet Locked ({order.status})</span>}
        </h3>
        <div className="grid grid-cols-6 gap-4 items-end">
          
          <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1.5">Material *</label>
            <div 
              onClick={() => !isReadOnly && setIsDropdownOpen(true)}
              className={`w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 flex items-center justify-between h-11 text-sm ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={selectedMaterial ? "text-slate-800 font-medium truncate" : "text-slate-400"}>
                {selectedMaterial 
                  ? (() => {
                      const found = finishedGoods.find(f => String(f._id) === String(selectedMaterial));
                      return found ? `[${found.itemCode || found.styleNo}] ${found.itemName || found.styleName}` : 'Select Material';
                    })()
                  : 'Search & Select Material...'}
              </span>
              <Search size={14} className="text-slate-400 shrink-0 ml-1" />
            </div>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                  <input 
                    type="text"
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type first 2 letters to search..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {searchTerm.trim().length < 2 ? (
                    <div className="p-3 text-center text-xs text-slate-400 italic">Type at least 2 letters to search...</div>
                  ) : filteredFinishedGoods.length > 0 ? (
                    filteredFinishedGoods.map(fg => (
                      <div 
                        key={fg._id}
                        onClick={() => {
                          setSelectedMaterial(fg._id);
                          setIsDropdownOpen(false);
                          setSearchTerm('');
                        }}
                        className="p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-normal text-slate-700 flex justify-between items-center"
                      >
                        <span className="font-bold text-slate-900 font-mono">[{fg.itemCode || fg.styleNo}]</span>
                        <span className="text-slate-600 truncate ml-2">{fg.itemName || fg.styleName}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400 italic">No matching items found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1.5">Colour *</label>
            <select 
              disabled={isReadOnly || !selectedMaterial} 
              value={selectedColor} 
              onChange={(e) => setSelectedColor(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-11 text-sm disabled:opacity-50"
            >
              <option value="">{selectedMaterial ? "Select Colour" : "Choose Material"}</option>
              {filteredColors.map(c => <option key={c._id} value={c._id}>{c.name || c.colorName}</option>)}
            </select>
          </div>

          {/* 🌟 සයිස් නම (sizeCode) නිවැරදිව පෙන්වීම සහ ID එක value ලෙස යැවීම */}
          <div>
            <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1.5">Size *</label>
            <select 
              disabled={isReadOnly || !selectedMaterial}
              value={selectedSize} 
              onChange={(e) => setSelectedSize(e.target.value)} 
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none h-11 text-sm font-medium disabled:opacity-50"
            >
              <option value="">{selectedMaterial ? (filteredSizes.length > 0 ? "Select Size" : "No Sizes Registered") : "Choose Material"}</option>
              {filteredSizes.map((sz, idx) => {
                const isObject = typeof sz === 'object' && sz !== null;
                const displayLabel = isObject ? (sz.sizeCode || sz.sizeDescription || sz.name || sz._id) : sz;
                const valueId = isObject ? (sz._id || sz.id) : sz;

                return (
                  <option key={valueId || idx} value={valueId}>
                    {displayLabel}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1.5">Price (LKR) *</label>
            <input 
              type="text" 
              disabled={isReadOnly}
              value={price} 
              onChange={handlePriceChange} 
              placeholder="0.00" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-11 text-sm disabled:opacity-50" 
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 font-medium uppercase mb-1.5">Qty *</label>
            <input 
              type="number" 
              disabled={isReadOnly}
              value={qty} 
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))} 
              placeholder="Qty" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-11 text-sm disabled:opacity-50" 
            />
          </div>
          <button 
            onClick={handleAddItem} 
            disabled={actionLoading || isReadOnly} 
            className="w-full h-11 bg-emerald-800 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-xs disabled:opacity-40"
          >
            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Add Line</>}
          </button>
        </div>
      </div>

      {/* ITEMS BREAKDOWN TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden print:border-none print:p-0">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-4 px-6">Material Name</th>
              <th className="py-4 px-6">Colour</th>
              <th className="py-4 px-6 text-center">Size</th>
              <th className="py-4 px-6 text-right">Unit Price</th>
              <th className="py-4 px-6 text-right">Order Qty (Gross)</th>
              <th className="py-4 px-6 text-right text-emerald-700 bg-emerald-50/40 print:hidden">Stock Allocated</th>
              <th className="py-4 px-6 text-right text-amber-700 bg-amber-50/40 print:hidden">To Costing (Net)</th>
              <th className="py-4 px-6 text-right">Line Total</th>
              <th className="py-4 px-6 text-center print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <tr key={item._id || idx} className="hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 px-6 text-slate-800 font-medium">
                    {getMaterialDisplayName(item)}
                  </td>
                  <td className="py-4 px-6 flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: item.color?.code || '#ccc' }}></span>
                    {item.color?.name || item.color?.colorName || 'Default'}
                  </td>
                  {/* 🌟 ටේබල් එකේ සයිස් නම නිවැරදිව පෙන්වීම */}
                  <td className="py-4 px-6 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-700">
                      {getSizeDisplayName(item.size)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right text-slate-700">LKR {(item.unitPrice || 0).toLocaleString()}</td>
                  <td className="py-4 px-6 text-right font-bold text-slate-800">{(item.quantity || 0).toLocaleString()}</td>
                  
                  <td className="py-4 px-6 text-right font-bold text-emerald-700 bg-emerald-50/10 print:hidden">
                    {(item.autoIssuedQty || 0).toLocaleString()}
                  </td>
                  
                  <td className="py-4 px-6 text-right font-bold text-amber-700 bg-amber-50/10 print:hidden">
                    {(item.netRequiredQty !== undefined ? item.netRequiredQty : item.quantity || 0).toLocaleString()}
                  </td>
                  
                  <td className="py-4 px-6 text-right font-semibold text-slate-800">LKR {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString()}</td>
                  <td className="py-4 px-6 text-center print:hidden">
                    <button 
                      disabled={isReadOnly}
                      onClick={() => confirmDeleteItem(item._id)} 
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md transition-all disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="py-16 text-center text-slate-400 italic">No commercial item breakdowns logged yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Section */}
      <div className="flex justify-between items-start gap-8 print:hidden">
        <div className="w-7/12 bg-white p-5 rounded-xl border border-slate-100">
          <textarea placeholder="Additional Remarks / Notes..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[100px] focus:outline-none font-medium text-slate-700 placeholder-slate-400 text-sm" />
        </div>
        <div className="w-5/12 bg-white border border-slate-100 p-5 rounded-xl space-y-3 font-medium text-slate-500 text-sm">
          <div className="flex justify-between items-center">
            <span>Nett Value Total: &nbsp;</span>
            <span className="text-slate-800 font-semibold text-base">LKR {(order?.totalAmount || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-slate-800 font-semibold">
            <span>Gross Total Amount: &nbsp;</span>
            <span className="text-base text-emerald-800 font-bold">LKR {(order?.totalAmount || 0).toLocaleString()}</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => navigate('/sales-orders')} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-all font-medium text-sm">Cancel</button>
            <button 
              disabled={actionLoading || isReadOnly}
              onClick={handleConfirmOrder} 
              className="flex-1 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-lg flex items-center justify-center gap-1.5 transition-all font-medium text-sm disabled:opacity-40"
            >
              {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><Check size={16} /> Submit For Approval</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesOrderDetails;