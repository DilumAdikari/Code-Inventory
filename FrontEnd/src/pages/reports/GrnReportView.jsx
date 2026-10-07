import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FileBarChart, Search, Printer, Loader2 } from 'lucide-react';

const GrnReportView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL එකෙන් ෆිල්ටර් පරාමිතීන් ලබා ගැනීම
  const warehouseId = searchParams.get('warehouse') || '';
  const grnNo = searchParams.get('grnNo') || '';
  const productId = searchParams.get('product') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [grns, setGrns] = useState([]);

  // Form State
  const [form, setForm] = useState({
    warehouse: warehouseId,
    grnNo: grnNo,
    product: productId,
    dateFrom: dateFrom,
    dateTo: dateTo
  });

  const [filteredStocks, setFilteredStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Dropdown ලැයිස්තු සඳහා ඩේටා ගෙන්වා ගැනීම
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [whRes, itemRes, grnRes] = await Promise.all([
          axios.get('http://192.168.1.30:5003/api/warehouses').catch(() => ({ data: [] })),
          axios.get('http://192.168.1.30:5003/api/grn/all-items-search').catch(() => ({ data: [] })),
          axios.get('http://192.168.1.30:5003/api/grn-history').catch(() => ({ data: [] }))
        ]);

        setWarehouses(whRes.data || []);
        setItems(Array.isArray(itemRes.data) ? itemRes.data : (itemRes.data?.data || []));
        setGrns(Array.isArray(grnRes.data) ? grnRes.data : (grnRes.data?.data || []));
      } catch (err) {
        console.error("Error loading filters:", err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. ඩේටා ෆිල්ටර් කර ලබා ගැනීම
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const stockRes = await axios.get('http://192.168.1.30:5003/api/stocks').catch(() => ({ data: [] }));
        let stocks = Array.isArray(stockRes.data) ? stockRes.data : (stockRes.data?.data || []);

        if (warehouseId) {
          stocks = stocks.filter(s => {
            const sWhId = s.warehouse?._id ? String(s.warehouse._id) : String(s.warehouse || '');
            return sWhId === String(warehouseId);
          });
        }

        if (productId) {
          stocks = stocks.filter(s => {
            const sMatId = s.material?._id ? String(s.material._id) : String(s.material || '');
            return sMatId === String(productId);
          });
        }

        setFilteredStocks(stocks);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching report data:", err);
        setLoading(false);
      }
    };

    fetchReportData();
  }, [warehouseId, productId, grnNo, dateFrom, dateTo]);

  // 'View Report' බටන් එක එබූ විට URL පරාමිතීන් යාවත්කාලීන කිරීම
  const handleViewReport = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.warehouse) params.set('warehouse', form.warehouse);
    if (form.grnNo) params.set('grnNo', form.grnNo);
    if (form.product) params.set('product', form.product);
    if (form.dateFrom) params.set('dateFrom', form.dateFrom);
    if (form.dateTo) params.set('dateTo', form.dateTo);

    setSearchParams(params);
  };

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 p-6 md:p-8 bg-slate-50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 shadow-xs print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileBarChart className="text-emerald-900" size={20} /> GRN Details Report
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Filter and generate Goods Received Note and stock match reports.</p>
        </div>
        <button 
          onClick={() => window.print()} 
          className="inline-flex items-center gap-2 text-white bg-emerald-900 hover:bg-emerald-800 font-semibold text-sm px-5 py-2 rounded-lg shadow-md transition-all cursor-pointer"
        >
          <Printer size={16} /> Print Report
        </button>
      </div>

      {/* FILTER FORM (ස්ක්‍රීන්ෂොට් එකේ ඇති ආකාරයටම සකස් කළ Form Layout එක) */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-xs max-w-5xl print:hidden">
        <form onSubmit={handleViewReport} className="space-y-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* WAREHOUSE */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Warehouse</label>
              <select 
                value={form.warehouse} 
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800 font-semibold text-slate-800"
              >
                <option value="">Select Warehouse / Depot</option>
                {warehouses.map(w => (
                  <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>
                ))}
              </select>
            </div>

            {/* GRN NO */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">GRN No</label>
              <select 
                value={form.grnNo} 
                onChange={(e) => setForm({ ...form, grnNo: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800 font-semibold text-slate-800"
              >
                <option value="">Select Grn</option>
                {grns.map(g => (
                  <option key={g._id || g.grnNo} value={g.grnNo}>{g.grnNo}</option>
                ))}
              </select>
            </div>

            {/* PRODUCT / ITEM */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Product / Item</label>
              <select 
                value={form.product} 
                onChange={(e) => setForm({ ...form, product: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800 font-semibold text-slate-800"
              >
                <option value="">Select an item</option>
                {items.map(item => (
                  <option key={item._id} value={item._id}>[{item.itemCode}] {item.itemName || item.materialName}</option>
                ))}
              </select>
            </div>

            {/* DATE RANGE */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="date" 
                  placeholder="Date From"
                  value={form.dateFrom} 
                  onChange={(e) => setForm({ ...form, dateFrom: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800" 
                />
                <input 
                  type="date" 
                  placeholder="Date To"
                  value={form.dateTo} 
                  onChange={(e) => setForm({ ...form, dateTo: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800" 
                />
              </div>
            </div>

          </div>

          {/* VIEW REPORT BUTTON (නිල් පාටින් යුත් අදාළ බොත්තම) */}
          <div className="pt-4 flex items-center justify-end">
            <button 
              type="submit" 
              className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 transition-all cursor-pointer"
            >
              <Search size={18} /> View Report
            </button>
          </div>

        </form>
      </div>

      {/* REPORT DATA RESULTS TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">Report Results</h3>
        {loading ? (
          <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={18} /> Loading records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Material / Item</th>
                  <th className="py-3 px-4">Color</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4 text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStocks.length > 0 ? filteredStocks.map((s, index) => (
                  <tr key={s._id || index} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {s.material?.itemName || s.material?.materialName || 'Item'} [{s.material?.itemCode || s.material?.materialCode || ''}]
                    </td>
                    <td className="py-3 px-4">{s.color?.colorName || s.color?.name || 'Default'}</td>
                    <td className="py-3 px-4">{s.size?.sizeCode || s.size?.name || 'Default'}</td>
                    <td className="py-3 px-4">{s.warehouse?.warehouseName || 'Depot'}</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-800">{s.qty || 0}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-slate-400 italic">No matching stock records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default GrnReportView;