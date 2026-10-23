import React, { useState, useEffect } from 'react';
import { Search, Warehouse, Layers, DollarSign, Loader2, RefreshCw, SlidersHorizontal, Eraser, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../api/config';

// Rows per page on the stock ledger
const PAGE_SIZE = 15;

// Empty filter form
const EMPTY_FILTERS = { item: '', itemId: '', warehouse: '', category: '', grnFrom: '', grnTo: '' };

// Returns the value as an array, or an empty array if it is not one
const toArray = (value) => (Array.isArray(value) ? value : []);

// Checks whether a value looks like a MongoDB ObjectId (24 hex characters)
const isObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);

// Returns YYYY-MM-DD for a date string or Date value
const dayOf = (v) => {
  if (!v) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// GRN date of a stock batch (falls back to the record date if the GRN date is not stored on the row)
const grnDayOf = (s) => dayOf(s.grnDate || s.grn?.grnDate || s.createdAt);

const materialNameOf = (s) => {
  const mat = s.material && typeof s.material === 'object' ? s.material : {};
  return (mat.materialName || mat.itemName || mat.styleName || mat.name || s.itemName || s.materialName || '');
};

const materialCodeOf = (s) => {
  const mat = s.material && typeof s.material === 'object' ? s.material : {};
  return (mat.materialCode || mat.itemCode || mat.styleNo || mat.code || s.itemCode || s.materialCode || '');
};

const materialIdOf = (s) => String(s.material?._id || s.material || '');

const categoryOf = (s) => {
  const mat = s.material && typeof s.material === 'object' ? s.material : {};
  return mat.category || s.category || '';
};

// Returns true if one stock batch matches the filter form
const matchesFilters = (s, f) => {
  if (Number(s.qty || 0) <= 0) return false;

  if (f.itemId) {
    // An item picked from the suggestion list: match the exact material
    if (materialIdOf(s) !== String(f.itemId)) return false;
  } else if (f.item) {
    const q = f.item.trim().toLowerCase();
    const name = materialNameOf(s).toLowerCase();
    const code = materialCodeOf(s).toLowerCase();
    if (!name.includes(q) && !code.includes(q)) return false;
  }

  if (f.warehouse && String(s.warehouse?._id || s.warehouse) !== String(f.warehouse)) return false;
  if (f.category && categoryOf(s) !== f.category) return false;

  const day = grnDayOf(s);
  if (f.grnFrom && (!day || day < f.grnFrom)) return false;
  if (f.grnTo && (!day || day > f.grnTo)) return false;

  return true;
};

const StockOverview = () => {
  const [stocks, setStocks] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter form (what the user is typing) and the filters applied by the View button
  const [form, setForm] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(null); // null = not viewed yet
  const [page, setPage] = useState(1);
  const [itemOpen, setItemOpen] = useState(false);

  // Loads the stock ledger and the warehouse list from the server
  const fetchStockData = async () => {
    try {
      setLoading(true);
      const [stockRes, whRes] = await Promise.all([
        axios.get(`${API_URL}/stocks`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/warehouses`).catch(() => ({ data: [] }))
      ]);
      setStocks(toArray(stockRes.data));
      setWarehouses(toArray(whRes.data));
    } catch (err) {
      console.error('Error fetching inventory ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStockData(); }, []);

  // Suggestions for the item field: unique materials in stock whose name or code matches the typed text
  const itemOptions = (() => {
    const q = form.item.trim().toLowerCase();
    if (!q) return [];
    const seen = new Map();
    toArray(stocks).forEach((s) => {
      const id = materialIdOf(s);
      if (!id || seen.has(id)) return;
      const name = materialNameOf(s);
      const code = materialCodeOf(s);
      if (name.toLowerCase().includes(q) || code.toLowerCase().includes(q)) {
        seen.set(id, { id, name, code });
      }
    });
    return [...seen.values()].slice(0, 30);
  })();

  // Unique category names for the category filter
  const categories = [...new Set(toArray(stocks).map(categoryOf).filter(Boolean))].sort();

  // Rows only appear after View is clicked
  const viewed = applied !== null;
  const rows = viewed ? toArray(stocks).filter(s => matchesFilters(s, applied)) : [];

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Summary cards use every matching batch, not only the current page
  const totalStockItems = rows.reduce((sum, s) => sum + Number(s.qty || 0), 0);
  const totalInventoryValue = rows.reduce(
    (sum, s) => sum + (Number(s.qty || 0) * Number(s.unitPrice || 0)),
    0
  );

  const handleView = () => {
    setApplied({ ...form });
    setPage(1);
  };

  const handleClear = () => {
    setForm(EMPTY_FILTERS);
    setApplied(null);
    setPage(1);
  };

  // Exports every batch that matches the applied filters (not only the current page) as a CSV file
  const exportCsv = () => {
    const headers = [
      'Material Name', 'Material Code', 'Category', 'Colour', 'Colour Code', 'Size',
      'Warehouse', 'Warehouse Code', 'GRN Date', 'UOM', 'Available Qty', 'Unit Price (LKR)', 'Stock Value (LKR)'
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(esc).join(',')];

    rows.forEach((s) => {
      const mat = s.material && typeof s.material === 'object' ? s.material : {};
      const rawUom = mat.uom || s.uom;
      const uom = rawUom && typeof rawUom === 'object'
        ? (rawUom.uomCode || rawUom.abbreviation || rawUom.name || rawUom.code || 'Pcs')
        : (isObjectId(rawUom) ? 'Pcs' : (rawUom || 'Pcs'));

      const rawSize = s.size;
      const size = rawSize && typeof rawSize === 'object'
        ? (rawSize.sizeCode || rawSize.sizeDescription || rawSize.name || rawSize.code || '-')
        : (isObjectId(rawSize) ? '-' : (rawSize || '-'));

      const qty = Number(s.qty || 0);
      const price = Number(s.unitPrice || 0);

      lines.push([
        materialNameOf(s) || 'Unnamed Item',
        materialCodeOf(s) || 'N/A',
        categoryOf(s) || 'General',
        s.color?.colorName || s.color?.name || 'Default',
        s.color?.colorCode || s.color?.code || '',
        size,
        s.warehouse?.warehouseName || '',
        s.warehouse?.warehouseCode || '',
        grnDayOf(s) || '',
        uom,
        qty,
        price.toFixed(2),
        (qty * price).toFixed(2),
      ].map(esc).join(','));
    });

    // Byte order mark at the start so Excel reads Sinhala text correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const hasFormValues = Object.values(form).some(v => v !== '');

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 animate-in fade-in duration-200">

      {/* HEADER BANNER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Warehouse className="text-emerald-950" size={22} /> Live Inventory Ledger
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Filter the stock by item, warehouse, category and GRN date, then press View to load it.</p>
        </div>
        <button
          onClick={fetchStockData}
          className="p-2 bg-slate-50 border hover:bg-slate-100 rounded-lg text-slate-500 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Ledger
        </button>
      </div>

      {/* FILTER FORM */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-3 space-y-1">
          <label className="block text-[11px] text-slate-400 font-medium uppercase">Item (name or code)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={14} />
            <input
              type="text"
              value={form.item}
              onChange={(e) => {
                // Typing again drops the picked item, so the text is searched freely
                setForm({ ...form, item: e.target.value, itemId: '' });
                setItemOpen(true);
              }}
              onFocus={() => setItemOpen(true)}
              onBlur={() => setTimeout(() => setItemOpen(false), 150)}
              placeholder="Type item name or code..."
              autoComplete="off"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 h-10 text-xs font-medium"
            />
            {itemOpen && !form.itemId && form.item.trim() !== '' && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                {itemOptions.length === 0 ? (
                  <div className="px-3 py-2.5 text-xs text-slate-400">No matching item in stock</div>
                ) : (
                  itemOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setForm({ ...form, item: opt.name, itemId: opt.id });
                        setItemOpen(false);
                      }}
                      className="flex w-full justify-between items-center px-3 py-2 text-xs text-left hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-none"
                    >
                      <span className="font-semibold text-slate-800">{opt.name || 'Unnamed Item'}</span>
                      <span className="font-mono text-[10px] text-slate-400 uppercase">{opt.code || 'N/A'}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-3 space-y-1">
          <label className="block text-[11px] text-slate-400 font-medium uppercase">Warehouse / Depot</label>
          <select
            value={form.warehouse}
            onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-semibold text-emerald-950 h-10 text-xs"
          >
            <option value="">All Warehouses / Depots</option>
            {warehouses.map(w => (
              <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="block text-[11px] text-slate-400 font-medium uppercase">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 font-medium h-10 text-xs"
          >
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="block text-[11px] text-slate-400 font-medium uppercase">GRN Date From</label>
          <input
            type="date"
            value={form.grnFrom}
            onChange={(e) => setForm({ ...form, grnFrom: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 h-10 text-xs font-medium"
          />
        </div>

        <div className="md:col-span-2 space-y-1">
          <label className="block text-[11px] text-slate-400 font-medium uppercase">GRN Date To</label>
          <input
            type="date"
            value={form.grnTo}
            onChange={(e) => setForm({ ...form, grnTo: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-slate-400 h-10 text-xs font-medium"
          />
        </div>

        <div className="md:col-span-12 flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasFormValues && !viewed}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none"
          >
            <Eraser size={14} /> Clear
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!viewed || rows.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleView}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg disabled:opacity-60 cursor-pointer border-none"
          >
            <Search size={14} /> View
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Stored Qty</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">
              {totalStockItems.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Units</span>
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800"><Layers size={20} /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Inventory Valuation</span>
            <h3 className="text-xl font-black text-emerald-950 mt-1">LKR {totalInventoryValue.toLocaleString()}</h3>
          </div>
          <div className="p-3 rounded-lg bg-emerald-900 text-white"><DollarSign size={20} /></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Batches Loaded</span>
            <h3 className="text-xl font-black text-slate-800 mt-1">
              {rows.length} <span className="text-xs font-semibold text-slate-400">Nodes</span>
            </h3>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border text-slate-600"><SlidersHorizontal size={20} /></div>
        </div>
      </div>

      {/* STOCK LEDGER TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={18} /> Syncing live stock ledger points...
          </div>
        ) : !viewed ? (
          <div className="p-16 text-center text-slate-400 italic">
            Filters select karala <strong className="not-italic text-slate-600">View</strong> click karanna.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-16 text-center text-slate-400 italic">
            No matching inventory batches found with the active filters.
          </div>
        ) : (
          <>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-4 px-5">Material Description</th>
                  <th className="py-4 px-5">Category</th>
                  <th className="py-4 px-5">Color Shade</th>
                  <th className="py-4 px-5">Size</th>
                  <th className="py-4 px-5">Storage Warehouse Node</th>
                  <th className="py-4 px-5">GRN Date</th>
                  <th className="py-4 px-5 text-right">Unit Price (Cost)</th>
                  <th className="py-4 px-5 text-center">UOM</th>
                  <th className="py-4 px-5 text-right bg-emerald-50/20 text-emerald-900">Available Qty</th>
                  <th className="py-4 px-5 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pagedRows.map((stock, idx) => {
                  const finalMaterialName = materialNameOf(stock) || 'Unnamed Item';
                  const finalMaterialCode = materialCodeOf(stock) || 'N/A';
                  const finalCategory = categoryOf(stock) || 'General';

                  // UOM: show the name, never a raw ID
                  const mat = stock.material && typeof stock.material === 'object' ? stock.material : {};
                  const rawUom = mat.uom || stock.uom;
                  const finalUom = rawUom && typeof rawUom === 'object'
                    ? (rawUom.uomCode || rawUom.abbreviation || rawUom.name || rawUom.code || 'Pcs')
                    : (isObjectId(rawUom) ? 'Pcs' : (rawUom || 'Pcs'));

                  const finalColorName = stock.color?.colorName || stock.color?.name || stock.color?.nameS || 'Default';
                  const finalColorCode = stock.color?.colorCode || stock.color?.code || 'N/A';
                  const colorSwatch = stock.color?.code || stock.color?.colorCode || '#ccc';

                  // Size: show the code, never a raw ID
                  const rawSize = stock.size;
                  const finalSizeName = rawSize && typeof rawSize === 'object'
                    ? (rawSize.sizeCode || rawSize.sizeDescription || rawSize.name || rawSize.code || '-')
                    : (isObjectId(rawSize) ? '-' : (rawSize || '-'));

                  const itemQty = Number(stock.qty || 0);
                  const itemPrice = Number(stock.unitPrice || 0);

                  return (
                    <tr key={stock._id || idx} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-800">{finalMaterialName}</div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Code: {finalMaterialCode}</div>
                      </td>

                      <td className="py-3.5 px-5 text-slate-500">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-600">{finalCategory}</span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <span className="w-2.5 h-3 rounded-full border shrink-0" style={{ backgroundColor: colorSwatch }}></span>
                          {finalColorName} <span className="text-slate-400 font-normal">({finalColorCode})</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold text-emerald-900">{finalSizeName}</span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Warehouse size={12} className="text-slate-400" />
                          {stock.warehouse?.warehouseName || 'Main Depot'}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-semibold">Node: {stock.warehouse?.warehouseCode || 'WH'}</div>
                      </td>

                      <td className="py-3.5 px-5 text-xs text-slate-500">{grnDayOf(stock) || '-'}</td>

                      <td className="py-3.5 px-5 text-right text-slate-600">
                        LKR {itemPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-5 text-center text-xs text-slate-400 uppercase">{finalUom}</td>

                      <td className={`py-3.5 px-5 text-right font-black text-sm bg-emerald-50/10 ${itemQty <= 10 ? 'text-rose-600 font-bold' : 'text-emerald-900'}`}>
                        {itemQty.toLocaleString()}
                        {itemQty <= 10 && <span className="block text-[9px] text-rose-400 uppercase tracking-tight font-medium mt-0.5">Low Stock</span>}
                      </td>

                      <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                        LKR {(itemQty * itemPrice).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* PAGINATION */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
              <span>{rows.length.toLocaleString()} batches matched</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 bg-white cursor-pointer"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="px-2">Page {safePage} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1 bg-white cursor-pointer"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default StockOverview;