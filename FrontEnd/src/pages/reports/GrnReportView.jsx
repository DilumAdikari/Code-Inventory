import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FileBarChart, Search, Printer, Loader2, RotateCcw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_URL } from '../../api/config';

const API = API_URL;


const getId = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : String(v ?? ''));
const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  return d?.data || d?.sizes || [];
};
const num = (v) => Number(v) || 0;
const fmt = (v) => num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toDay = (d) => (d ? String(d).slice(0, 10) : '');

const statusCls = (s) => {
  if (s === 'Completed') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-slate-100 border-slate-200 text-slate-600';
};

const GrnReportView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const warehouseId = searchParams.get('warehouse') || '';
  const grnNo = searchParams.get('grnNo') || '';
  const productId = searchParams.get('product') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const status = searchParams.get('status') ?? 'Completed'; 

  const [grns, setGrns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ warehouse: warehouseId, grnNo, product: productId, dateFrom, dateTo, status });

  useEffect(() => {
    setForm({ warehouse: warehouseId, grnNo, product: productId, dateFrom, dateTo, status });
  }, [warehouseId, grnNo, productId, dateFrom, dateTo, status]);


  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const safe = (url) =>
          axios.get(url).catch((err) => {
            console.error(`Failed to load ${url}:`, err?.response?.status, err?.message);
            return { data: [] };
          });
        const [grnRes, whRes, supRes, matRes, fgRes, colRes, sizeRes] = await Promise.all([
          safe(`${API}/grn`),
          safe(`${API}/warehouses`),
          safe(`${API}/suppliers`),
          safe(`${API}/materials`),
          safe(`${API}/finished-goods`),
          safe(`${API}/colors`),
          safe(`${API}/sizes`),
        ]);

        const combined = [
          ...asArray(matRes).map((m) => ({
            _id: String(m._id),
            itemCode: m.materialCode || m.itemCode || 'MAT',
            itemName: m.materialName || m.itemName || 'Material',
            itemType: 'RM',
          })),
          ...asArray(fgRes).map((f) => ({
            _id: String(f._id),
            itemCode: f.itemCode || f.code || 'FG',
            itemName: f.itemName || f.name || 'Finished Good',
            itemType: 'FG',
          })),
        ];

        setGrns(asArray(grnRes));
        setWarehouses(asArray(whRes));
        setSuppliers(asArray(supRes));
        setItemList(combined);
        setColors(asArray(colRes));
        setSizes(asArray(sizeRes));
      } catch (err) {
        console.error('Error loading GRN report:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

 
  const maps = useMemo(() => {
    const byId = (arr) => new Map(arr.map((x) => [String(x._id), x]));
    return {
      wh: byId(warehouses),
      sup: byId(suppliers),
      item: byId(itemList),
      color: byId(colors),
      size: byId(sizes),
    };
  }, [warehouses, suppliers, itemList, colors, sizes]);

  const grnOptions = useMemo(
    () => [...grns].sort((a, b) => String(b.grnNo || '').localeCompare(String(a.grnNo || ''))),
    [grns]
  );

  // GRN items -> report rows
  const rows = useMemo(() => {
    const out = [];
    grns.forEach((g) => {
      const gStatus = g.status || 'Draft';
      if (status && gStatus !== status) return;
      if (grnNo && String(g.grnNo) !== grnNo) return;

      const day = toDay(g.grnDate);
      if (dateFrom && (!day || day < dateFrom)) return;
      if (dateTo && (!day || day > dateTo)) return;

      const supId = getId(g.supplier);
      const sup = (typeof g.supplier === 'object' && g.supplier) || maps.sup.get(supId);
      const supplierName = sup?.supplierName || sup?.name || sup?.companyName || g.supplierName || '-';
      const typeName = g.grnType?.typeName || g.grnType?.name || 'General';

      (g.items || []).forEach((l, i) => {
        
        const whId = getId(l.storeLocation) || getId(g.globalWarehouse);
        if (warehouseId && whId !== warehouseId) return;

        const matId = getId(l.material);
        if (productId && matId !== productId) return;

        const matPop = typeof l.material === 'object' ? l.material : null;
        const mat = maps.item.get(matId);
        const colObj = (typeof l.color === 'object' && l.color) || maps.color.get(getId(l.color));
        const sizeObj = (typeof l.size === 'object' && l.size) || maps.size.get(getId(l.size));
        const whObj = (typeof l.storeLocation === 'object' && l.storeLocation) || maps.wh.get(whId);

        const qty = num(l.receivedQty);
        const price = num(l.unitPrice);

        out.push({
          key: `${g._id}-${l._id || i}`,
          grnNo: g.grnNo || '-',
          date: day,
          type: typeName,
          status: gStatus,
          invoiceNo: g.invoiceNo || '-',
          supplier: supplierName,
          warehouse: whObj?.warehouseName || '-',
          itemName: mat?.itemName || matPop?.materialName || matPop?.itemName || 'Item',
          itemCode: mat?.itemCode || matPop?.materialCode || matPop?.itemCode || '',
          color: colObj ? colObj.colorName || colObj.name : '-',
          size: sizeObj ? sizeObj.sizeCode || sizeObj.sizeDescription || sizeObj.name : '-',
          uom: typeof l.uom === 'object' ? l.uom?.abbreviation || l.uom?.uomCode || '' : l.uom || '',
          qty,
          price,
          amount: num(l.totalPrice) || qty * price,
        });
      });
    });

    return out.sort((a, b) => b.date.localeCompare(a.date) || String(b.grnNo).localeCompare(String(a.grnNo)));
  }, [grns, maps, warehouseId, grnNo, productId, dateFrom, dateTo, status]);

  const totals = useMemo(
    () => ({
      qty: rows.reduce((s, r) => s + r.qty, 0),
      amount: rows.reduce((s, r) => s + r.amount, 0),
      grnCount: new Set(rows.map((r) => r.grnNo)).size,
    }),
    [rows]
  );

  const handleViewReport = (e) => {
    e.preventDefault();
    if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
      alert('Date From must be before Date To');
      return;
    }
    const params = new URLSearchParams();
    ['warehouse', 'grnNo', 'product', 'dateFrom', 'dateTo'].forEach((k) => form[k] && params.set(k, form[k]));
    params.set('status', form.status); // "" = All statuses
    setSearchParams(params);
  };

  const handleReset = () => setSearchParams(new URLSearchParams());

 
  const handleExportExcel = () => {
    if (rows.length === 0) {
      alert('No records to export.');
      return;
    }

    const headers = [
      '#', 'GRN No', 'Date', 'Type', 'Invoice', 'Supplier', 'Warehouse',
      'Item Code', 'Item Name', 'Color', 'Size', 'UOM',
      'Received Qty', 'Unit Cost', 'Amount', 'Status',
    ];

    const body = rows.map((r, i) => [
      i + 1, r.grnNo, r.date, r.type, r.invoiceNo, r.supplier, r.warehouse,
      r.itemCode, r.itemName, r.color, r.size, r.uom,
      r.qty, r.price, r.amount, r.status,
    ]);

    const whName = maps.wh.get(warehouseId)?.warehouseName || 'All Warehouses';
    const filterLines = [
      ['GRN Details Report'],
      [`Warehouse: ${whName}`],
      [`Status: ${status || 'All Statuses'}`],
      [`Period: ${dateFrom || '-'} to ${dateTo || '-'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
    ];

    const totalRow = [
      '', `Total — ${totals.grnCount} GRN(s), ${rows.length} line(s)`,
      '', '', '', '', '', '', '', '', '', '',
      totals.qty, '', totals.amount, '',
    ];

    const ws = XLSX.utils.aoa_to_sheet([...filterLines, headers, ...body, [], totalRow]);

    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 24 }, { wch: 22 },
      { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 8 },
      { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    ];

  
    const headerRow = filterLines.length;
    const lastRow = headerRow + body.length + 2;
    for (let r = headerRow + 1; r <= lastRow; r++) {
      [[12, '#,##0.##'], [13, '#,##0.00'], [14, '#,##0.00']].forEach(([c, z]) => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === 'number') cell.z = z;
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GRN Details');

    const datePart = dateFrom || dateTo ? `_${dateFrom || 'start'}_to_${dateTo || 'end'}` : '';
    XLSX.writeFile(wb, `GRN_Report${datePart}.xlsx`);
  };

  const selectCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800 font-semibold text-slate-800';
  const inputCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wider';

  const selectedWh = maps.wh.get(warehouseId);

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 p-6 md:p-8 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 shadow-xs print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileBarChart className="text-emerald-900" size={20} /> GRN Details Report
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Goods received by GRN, item, warehouse and date.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={loading || rows.length === 0}
            className="inline-flex items-center gap-2 text-emerald-900 bg-white border border-emerald-900 hover:bg-emerald-50 font-semibold text-sm px-5 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 text-white bg-emerald-900 hover:bg-emerald-800 font-semibold text-sm px-5 py-2 rounded-lg shadow-md transition-all cursor-pointer"
          >
            <Printer size={16} /> Print Report
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-xs max-w-5xl print:hidden">
        <form onSubmit={handleViewReport} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className={labelCls}>Warehouse</label>
              <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} className={selectCls}>
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>[{w.warehouseCode}] {w.warehouseName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>GRN No</label>
              <select value={form.grnNo} onChange={(e) => setForm({ ...form, grnNo: e.target.value })} className={selectCls}>
                <option value="">All GRNs</option>
                {grnOptions.map((g) => (
                  <option key={g._id} value={g.grnNo}>
                    {g.grnNo} — {toDay(g.grnDate)} {g.invoiceNo ? `(${g.invoiceNo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Product / Item</label>
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className={selectCls}>
                <option value="">All Items</option>
                {itemList.map((it) => (
                  <option key={it._id} value={it._id}>[{it.itemCode}] {it.itemName} ({it.itemType})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} className={inputCls} />
                <input type="date" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} className={inputCls} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={selectCls}>
                <option value="Completed">Completed (stock updated)</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Draft">Draft</option>
                <option value="">All Statuses</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button type="button" onClick={handleReset} className="inline-flex items-center px-5 py-3 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg gap-2 cursor-pointer">
              <RotateCcw size={16} /> Reset
            </button>
            <button type="submit" className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm gap-2 transition-all cursor-pointer">
              <Search size={18} /> View Report
            </button>
          </div>
        </form>
      </div>

      {/* RESULTS */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">GRN Details</h3>
          <span className="text-xs text-slate-500">
            {selectedWh ? `${selectedWh.warehouseName} · ` : ''}
            {status || 'All statuses'}
            {(dateFrom || dateTo) ? ` · ${dateFrom || '…'} to ${dateTo || '…'}` : ''}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-emerald-900" size={18} /> Loading records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">GRN No</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Invoice</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Warehouse</th>
                  <th className="py-3 px-3">Material / Item</th>
                  <th className="py-3 px-3">Color</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3 text-right">Received Qty</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  {!status && <th className="py-3 px-3">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rows.length > 0 ? (
                  rows.map((r, i) => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3 font-bold text-emerald-950 whitespace-nowrap">{r.grnNo}</td>
                      <td className="py-3 px-3 whitespace-nowrap">{r.date || '-'}</td>
                      <td className="py-3 px-3 text-emerald-800">{r.type}</td>
                      <td className="py-3 px-3">{r.invoiceNo}</td>
                      <td className="py-3 px-3">{r.supplier}</td>
                      <td className="py-3 px-3">{r.warehouse}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {r.itemName} {r.itemCode && <span className="text-slate-500 font-medium">[{r.itemCode}]</span>}
                      </td>
                      <td className="py-3 px-3">{r.color}</td>
                      <td className="py-3 px-3">{r.size}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800 whitespace-nowrap">
                        {r.qty.toLocaleString()} {r.uom && <span className="text-xs text-slate-400 uppercase">{r.uom}</span>}
                      </td>
                      <td className="py-3 px-3 text-right">{fmt(r.price)}</td>
                      <td className="py-3 px-3 text-right font-semibold">{fmt(r.amount)}</td>
                      {!status && (
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase whitespace-nowrap ${statusCls(r.status)}`}>{r.status}</span>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={status ? 13 : 14} className="py-16 text-center text-slate-400 italic">
                      No GRN records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                    <td colSpan="10" className="py-3 px-3">
                      Total — {totals.grnCount} GRN(s), {rows.length} line(s)
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-800">{totals.qty.toLocaleString()}</td>
                    <td className="py-3 px-3"></td>
                    <td className="py-3 px-3 text-right">LKR {fmt(totals.amount)}</td>
                    {!status && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrnReportView;