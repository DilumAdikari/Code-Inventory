import React, { useState, useEffect } from 'react';
import { Search, Warehouse, Layers, Palette, DollarSign, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import axios from 'axios';
import { API_URL } from "../api/config";

const StockOverview = () => {
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const fetchStockData = async () => {
    try {
      setLoading(true);
      const [stockRes, whRes] = await Promise.all([
        axios.get('${API_URL}/stocks').catch(() => ({ data: [] })),
        axios.get('${API_URL}/warehouses').catch(() => ({ data: [] }))
      ]);
      setStocks(stockRes.data || []);
      setWarehouses(whRes.data || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching inventory ledger:", err);
      setLoading(false);
    }
  };

  useEffect(() => { fetchStockData(); }, []);

 
  const categories = [...new Set(stocks.map(s => s.material?.category || s.category).filter(Boolean))];

  
  const filteredStocks = stocks.filter(stock => {
    const itemQty = stock.qty || 0;
    if (itemQty <= 0) return false; 

    const mat = stock.material || {};
    const matName = (mat.materialName || mat.itemName || mat.styleName || mat.name || stock.itemName || stock.materialName || '').toLowerCase();
    const matCode = (mat.materialCode || mat.itemCode || mat.styleNo || mat.code || stock.itemCode || stock.materialCode || '').toLowerCase();
    
    const matchesSearch = matName.includes(searchTerm.toLowerCase()) || matCode.includes(searchTerm.toLowerCase());
    const matchesWarehouse = selectedWarehouse ? String(stock.warehouse?._id || stock.warehouse) === String(selectedWarehouse) : true;
    const matchesCategory = selectedCategory ? (mat.category || stock.category) === selectedCategory : true;

    return matchesSearch && matchesWarehouse && matchesCategory;
  });

  // Inventory Metrics
  const totalStockItems = filteredStocks.reduce((sum, s) => sum + (s.qty || 0), 0);
  const totalInventoryValue = filteredStocks.reduce((sum, s) => sum + ((s.qty || 0) * (s.unitPrice || 0)), 0);

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">
      
      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Warehouse className="text-emerald-950" size={22}/> Live Inventory Ledger
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Monitor real-time commercial stock balances, location-specific nodes and price-wise material evaluations.</p>
        </div>
        <button onClick={fetchStockData} className="p-2 bg-slate-50 border hover:bg-slate-100 rounded-lg text-slate-500 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Ledger
        </button>
      </div>

      {/* QUICK SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Stored Qty</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">{totalStockItems.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Units</span></h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800"><Layers size={20}/></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Inventory Valuation</span>
            <h3 className="text-xl font-black text-emerald-950 mt-1">LKR {totalInventoryValue.toLocaleString()}</h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-900 text-white"><DollarSign size={20}/></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Batches Loaded</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">{filteredStocks.length} <span className="text-xs font-semibold text-slate-400">Nodes</span></h3>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border text-slate-600"><SlidersHorizontal size={20}/></div>
        </div>
      </div>

      {/* FILTER CONTROL BAR PANEL */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 grid grid-cols-12 gap-4 items-center shadow-xs">
        <div className="col-span-5 relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={14} />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Material Name or Code..." 
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 h-10 text-xs font-medium" 
          />
        </div>

        <div className="col-span-4 relative">
          <select 
            value={selectedWarehouse} 
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-semibold text-emerald-950 h-10 text-xs"
          >
            <option value="">All Warehouses / Depots</option>
            {warehouses.map(w => <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>)}
          </select>
        </div>

        <div className="col-span-3 relative">
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-10 text-xs"
          >
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* LIVE STOCK DATA LEDGER TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={18} /> Syncing live stock ledger points...
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic">
            No matching inventory batches found with the active filter matrices.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-4 px-5">Material Description</th>
                <th className="py-4 px-5">Category</th>
                <th className="py-4 px-5">Color Shade</th>
                <th className="py-4 px-5">Size</th>
                <th className="py-4 px-5">Storage Warehouse Node</th>
                <th className="py-4 px-5 text-right">Unit Price (Cost)</th>
                <th className="py-4 px-5 text-center">UOM</th>
                <th className="py-4 px-5 text-right bg-emerald-50/20 text-emerald-900">Available Qty</th>
                <th className="py-4 px-5 text-right">Stock Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredStocks.map((stock) => {
                const mat = stock.material || {};
                
                const finalMaterialName = mat.materialName || mat.itemName || mat.styleName || mat.name || stock.itemName || stock.materialName || 'Unnamed Item';
                const finalMaterialCode = mat.materialCode || mat.itemCode || mat.styleNo || mat.code || stock.itemCode || stock.materialCode || 'N/A';
                
                const finalCategory = mat.category || stock.category || 'General';
                
                // Safe UOM resolution to prevent raw IDs
                const rawUom = mat.uom || stock.uom;
                const finalUom = typeof rawUom === 'object' && rawUom !== null
                  ? (rawUom.uomCode || rawUom.abbreviation || rawUom.name || rawUom.code || 'Pcs')
                  : (typeof rawUom === 'string' && /^[0-9a-fA-F]{24}$/.test(rawUom) ? 'Pcs' : (rawUom || 'Pcs'));

                const finalColorName = stock.color?.colorName || stock.color?.name || stock.color?.nameS || 'Default';
                const finalColorCode = stock.color?.colorCode || stock.color?.code || 'N/A';

                // Safe Size resolution to prevent raw IDs
                const rawSize = stock.size;
                const finalSizeName = typeof rawSize === 'object' && rawSize !== null
                  ? (rawSize.sizeCode || rawSize.sizeDescription || rawSize.name || rawSize.code || '-')
                  : (typeof rawSize === 'string' && /^[0-9a-fA-F]{24}$/.test(rawSize) ? '-' : (rawSize || '-'));
                
                const itemQty = stock.qty || 0;
                const itemPrice = stock.unitPrice || 0;

                return (
                  <tr key={stock._id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Material / Style Name */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-800">{finalMaterialName}</div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Code: {finalMaterialCode}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-5 text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-600">{finalCategory}</span>
                    </td>

                    {/* Color */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="w-2.5 h-3 rounded-full border shrink-0" style={{ backgroundColor: stock.color?.code || stock.color?.colorCode || '#ccc' }}></span>
                        {finalColorName} <span className="text-slate-400 font-normal">({finalColorCode})</span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-5">
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold text-emerald-900">{finalSizeName}</span>
                    </td>

                    {/* Warehouse Location */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <Warehouse size={12} className="text-slate-400" />
                        {stock.warehouse?.warehouseName || 'Main Depot'}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Node: {stock.warehouse?.warehouseCode || 'WH'}</div>
                    </td>

                    {/* Unit Price */}
                    <td className="py-3.5 px-5 text-right text-slate-600">LKR {itemPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>

                    {/* UOM */}
                    <td className="py-3.5 px-5 text-center text-xs text-slate-400 uppercase">{finalUom}</td>

                    {/* Quantity */}
                    <td className={`py-3.5 px-5 text-right font-black text-sm bg-emerald-50/10 ${itemQty <= 10 ? 'text-rose-600 font-bold' : 'text-emerald-900'}`}>
                      {itemQty.toLocaleString()}
                      {itemQty <= 10 && <span className="block text-[9px] text-rose-400 uppercase tracking-tight font-medium mt-0.5">Low Stock</span>}
                    </td>

                    {/* Total Stock Value */}
                    <td className="py-3.5 px-5 text-right font-bold text-slate-900">LKR {(itemQty * itemPrice).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default StockOverview;