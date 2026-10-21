import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { PackageMinus, Search, Printer, Loader2, RotateCcw, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_URL } from '../../api/config';

const API = API_URL;

// Populate කරලා object එකක් ආවත්, ID string එකක් ආවත් ID එක ගන්න
const getId = (v) => (v && typeof v === 'object' ? String(v._id ?? v.id ?? '') : String(v ?? ''));
const asArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  return d?.data || [];
};
const num = (v) => Number(v) || 0;
const fmtQty = (v) => num(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
const fmtMoney = (v) => num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "2026-09-15" නම් එහෙමම; ISO timestamp (createdAt) නම් local (Sri Lanka) දවසට convert කරනවා
const toDay = (d) => {
  if (!d) return '';
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (isNaN(dt)) return s.slice(0, 10);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

// Material Issuing page එකේ status අනුව
const STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'Fully Issued (stock deducted)' },
  { value: 'Pending Approval', label: 'Pending Approval' },
  { value: 'DRAFT_GROUP', label: 'Draft / Pending' },
  { value: '', label: 'All Statuses' },
];
const statusLabel = (s) => {
  if (s === 'ISSUED') return 'Fully Issued';
  if (s === 'Pending Approval') return 'Pending Approval';
  return 'Draft / Pending';
};
const statusMatches = (issueStatus, filter) => {
  if (!filter) return true;
  if (filter === 'DRAFT_GROUP') return issueStatus !== 'ISSUED' && issueStatus !== 'Pending Approval';
  return issueStatus === filter;
};
const statusCls = (s) => {
  if (s === 'ISSUED') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s === 'Pending Approval') return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-slate-100 border-slate-200 text-slate-600';
};

const GoodsIssueReportView = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const warehouseId = searchParams.get('warehouse') || '';
  const plantId = searchParams.get('plant') || '';
  const issueNo = searchParams.get('issueNo') || '';
  const prodOrderId = searchParams.get('productionOrder') || '';
  const soRef = searchParams.get('salesOrder') || '';
  const productId = searchParams.get('product') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const status = searchParams.get('status') ?? 'ISSUED'; // Default: stock එකෙන් අඩු වුණ issues විතරයි

  const [issues, setIssues] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [factories, setFactories] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [colors, setColors] = useState([]);
  const [loading, setLoading] = useState(true);

  const emptyForm = {
    warehouse: '', plant: '', issueNo: '', productionOrder: '', salesOrder: '',
    product: '', dateFrom: '', dateTo: '', status: 'ISSUED',
  };
  const [form, setForm] = useState({
    warehouse: warehouseId, plant: plantId, issueNo, productionOrder: prodOrderId, salesOrder: soRef,
    product: productId, dateFrom, dateTo, status,
  });

  useEffect(() => {
    setForm({
      warehouse: warehouseId, plant: plantId, issueNo, productionOrder: prodOrderId, salesOrder: soRef,
      product: productId, dateFrom, dateTo, status,
    });
  }, [warehouseId, plantId, issueNo, prodOrderId, soRef, productId, dateFrom, dateTo, status]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const safe = (url) => axios.get(url).catch(() => ({ data: [] }));
        const [issRes, whRes, facRes, matRes, colRes] = await Promise.all([
          safe(`${API}/material-issues`),
          safe(`${API}/warehouses`),
          safe(`${API}/factories`),
          safe(`${API}/materials`),
          safe(`${API}/colors`),
        ]);
        setIssues(asArray(issRes));
        setWarehouses(asArray(whRes));
        setFactories(asArray(facRes));
        setMaterials(asArray(matRes));
        setColors(asArray(colRes));
      } catch (err) {
        console.error('Error loading Goods Issue report:', err);
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
      plant: byId(factories),
      mat: byId(materials),
      color: byId(colors),
    };
  }, [warehouses, factories, materials, colors]);

  const issueNoOf = (iss) => iss.issueNo || `ISS-${String(iss._id || '').slice(-6).toUpperCase()}`;
  const issueDateOf = (iss) => toDay(iss.issueDate || iss.createdAt);

  // Dropdown options — දැනට තියෙන issues වලින්ම හදනවා
  const issueOptions = useMemo(
    () => [...issues].sort((a, b) => issueDateOf(b).localeCompare(issueDateOf(a))),
    [issues]
  );

  const prodOrderOptions = useMemo(() => {
    const m = new Map();
    issues.forEach((iss) => {
      const id = getId(iss.productionOrder);
      if (id && !m.has(id)) m.set(id, iss.productionOrder?.productionOrderNo || `PO-${id.slice(-6).toUpperCase()}`);
    });
    return [...m.entries()].sort((a, b) => b[1].localeCompare(a[1]));
  }, [issues]);

  const soOptions = useMemo(() => {
    const s = new Set();
    issues.forEach((iss) => iss.salesOrder?.orderRef && s.add(iss.salesOrder.orderRef));
    return [...s].sort();
  }, [issues]);

  // Issue items -> report rows
  const rows = useMemo(() => {
    const out = [];
    issues.forEach((iss) => {
      if (!statusMatches(iss.status, status)) return;

      const no = issueNoOf(iss);
      if (issueNo && no !== issueNo) return;

      const day = issueDateOf(iss);
      if (dateFrom && (!day || day < dateFrom)) return;
      if (dateTo && (!day || day > dateTo)) return;

      const whId = getId(iss.warehouse);
      if (warehouseId && whId !== warehouseId) return;

      const plId = getId(iss.plant);
      if (plantId && plId !== plantId) return;

      if (prodOrderId && getId(iss.productionOrder) !== prodOrderId) return;
      if (soRef && iss.salesOrder?.orderRef !== soRef) return;

      const whObj = (typeof iss.warehouse === 'object' && iss.warehouse) || maps.wh.get(whId);
      const plObj = (typeof iss.plant === 'object' && iss.plant) || maps.plant.get(plId);

      (iss.items || []).forEach((l, i) => {
        const matId = getId(l.material);
        if (productId && matId !== productId) return;

        const matPop = typeof l.material === 'object' ? l.material : null;
        const matObj = maps.mat.get(matId);
        const colObj = (typeof l.color === 'object' && l.color) || maps.color.get(getId(l.color));

        const allocated = num(l.allocatedQty);
        const issued = num(l.issuedQty);

        out.push({
          key: `${iss._id}-${l._id || i}`,
          issueNo: no,
          date: day,
          status: iss.status,
          salesOrder: iss.salesOrder?.orderRef || '-',
          productionOrder: iss.productionOrder?.productionOrderNo || '-',
          plant: plObj?.name || plObj?.factoryCode || '-',
          warehouse: whObj?.warehouseName || '-',
          itemCode: matPop?.itemCode || matPop?.materialCode || matObj?.materialCode || matObj?.itemCode || '',
          itemName: matPop?.materialName || matPop?.itemName || matObj?.materialName || matObj?.itemName || 'Material',
          color: colObj ? colObj.colorName || colObj.name : '-',
          uom: typeof l.uom === 'object' ? l.uom?.abbreviation || l.uom?.uomCode || '' : l.uom || '',
          allocated,
          issued,
          balance: allocated - issued,
          value: num(l.value),
        });
      });
    });

    return out.sort((a, b) => b.date.localeCompare(a.date) || b.issueNo.localeCompare(a.issueNo));
  }, [issues, maps, warehouseId, plantId, issueNo, prodOrderId, soRef, productId, dateFrom, dateTo, status]);

  const totals = useMemo(
    () => ({
      allocated: rows.reduce((s, r) => s + r.allocated, 0),
      issued: rows.reduce((s, r) => s + r.issued, 0),
      balance: rows.reduce((s, r) => s + r.balance, 0),
      value: rows.reduce((s, r) => s + r.value, 0),
      issueCount: new Set(rows.map((r) => r.issueNo)).size,
    }),
    [rows]
  );

  // Value field එක පාවිච්චි වෙනවා නම් විතරක් Value column එක පෙන්නන්න
  const showValue = totals.value !== 0;
  const showStatus = status !== 'ISSUED' && status !== 'Pending Approval';

  const handleViewReport = (e) => {
    e.preventDefault();
    if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
      alert('Date From must be before Date To');
      return;
    }
    const params = new URLSearchParams();
    ['warehouse', 'plant', 'issueNo', 'productionOrder', 'salesOrder', 'product', 'dateFrom', 'dateTo']
      .forEach((k) => form[k] && params.set(k, form[k]));
    params.set('status', form.status); // "" = All statuses
    setSearchParams(params);
  };

  const handleReset = () => {
    setForm(emptyForm);
    setSearchParams(new URLSearchParams());
  };

  // Excel Export
  const handleExportExcel = () => {
    if (rows.length === 0) {
      alert('No records to export.');
      return;
    }

    const headers = [
      '#', 'Issue No', 'Date', 'Sales Order', 'Production Order', 'Plant / Factory', 'Warehouse',
      'Material Code', 'Material Name', 'Color', 'UOM', 'Allocated Qty', 'Issued Qty', 'Balance Qty',
      ...(showValue ? ['Value'] : []), 'Status',
    ];

    const body = rows.map((r, i) => [
      i + 1, r.issueNo, r.date, r.salesOrder, r.productionOrder, r.plant, r.warehouse,
      r.itemCode, r.itemName, r.color, r.uom, r.allocated, r.issued, r.balance,
      ...(showValue ? [r.value] : []), statusLabel(r.status),
    ]);

    const filterLines = [
      ['Goods Issue Report'],
      [`Warehouse: ${maps.wh.get(warehouseId)?.warehouseName || 'All Warehouses'}`],
      [`Plant / Factory: ${maps.plant.get(plantId)?.name || 'All'}`],
      [`Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label || 'All Statuses'}`],
      [`Period: ${dateFrom || '-'} to ${dateTo || '-'}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
    ];

    const totalRow = [
      '', `Total — ${totals.issueCount} Issue(s), ${rows.length} line(s)`,
      '', '', '', '', '', '', '', '', '',
      totals.allocated, totals.issued, totals.balance,
      ...(showValue ? [totals.value] : []), '',
    ];

    const ws = XLSX.utils.aoa_to_sheet([...filterLines, headers, ...body, [], totalRow]);

    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
      ...(showValue ? [{ wch: 14 }] : []), { wch: 18 },
    ];

    // Qty / Value columns වලට number format
    const headerRow = filterLines.length;
    const lastRow = headerRow + body.length + 2;
    const numCols = [[11, '#,##0.###'], [12, '#,##0.###'], [13, '#,##0.###'], ...(showValue ? [[14, '#,##0.00']] : [])];
    for (let r = headerRow + 1; r <= lastRow; r++) {
      numCols.forEach(([c, z]) => {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && typeof cell.v === 'number') cell.z = z;
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Goods Issues');

    const datePart = dateFrom || dateTo ? `_${dateFrom || 'start'}_to_${dateTo || 'end'}` : '';
    XLSX.writeFile(wb, `Goods_Issue_Report${datePart}.xlsx`);
  };

  const selectCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800 font-semibold text-slate-800';
  const inputCls =
    'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-800';
  const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wider';

  const selectedWh = maps.wh.get(warehouseId);
  const selectedPlant = maps.plant.get(plantId);
  const colCount = 13 + (showValue ? 1 : 0) + (showStatus ? 1 : 0);

  return (
    <div className="w-full space-y-6 text-sm font-normal text-slate-700 p-6 md:p-8 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-100 shadow-xs print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <PackageMinus className="text-emerald-900" size={20} /> Goods Issue Report
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">Materials issued by issue note, production order, plant, warehouse and date.</p>
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
                  <option key={w._id} value={w._id}>
                    {w.warehouseCode ? `[${w.warehouseCode}] ` : ''}{w.warehouseName || w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Plant / Factory</label>
              <select value={form.plant} onChange={(e) => setForm({ ...form, plant: e.target.value })} className={selectCls}>
                <option value="">All Plants</option>
                {factories.map((f) => (
                  <option key={f._id} value={f._id}>{f.name || f.factoryCode}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Issue No</label>
              <select value={form.issueNo} onChange={(e) => setForm({ ...form, issueNo: e.target.value })} className={selectCls}>
                <option value="">All Issues</option>
                {issueOptions.map((iss) => (
                  <option key={iss._id} value={issueNoOf(iss)}>
                    {issueNoOf(iss)} — {issueDateOf(iss)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Production Order</label>
              <select value={form.productionOrder} onChange={(e) => setForm({ ...form, productionOrder: e.target.value })} className={selectCls}>
                <option value="">All Production Orders</option>
                {prodOrderOptions.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Sales Order</label>
              <select value={form.salesOrder} onChange={(e) => setForm({ ...form, salesOrder: e.target.value })} className={selectCls}>
                <option value="">All Sales Orders</option>
                {soOptions.map((ref) => (
                  <option key={ref} value={ref}>{ref}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Material</label>
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className={selectCls}>
                <option value="">All Materials</option>
                {materials.map((m) => (
                  <option key={m._id} value={m._id}>
                    [{m.materialCode || m.itemCode}] {m.materialName || m.itemName}
                  </option>
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
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
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
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Goods Issue Details</h3>
          <span className="text-xs text-slate-500">
            {selectedWh ? `${selectedWh.warehouseName} · ` : ''}
            {selectedPlant ? `${selectedPlant.name || selectedPlant.factoryCode} · ` : ''}
            {STATUS_OPTIONS.find((o) => o.value === status)?.label || 'All statuses'}
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
                  <th className="py-3 px-3">Issue No</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Sales Order</th>
                  <th className="py-3 px-3">Prod. Order</th>
                  <th className="py-3 px-3">Plant</th>
                  <th className="py-3 px-3">Warehouse</th>
                  <th className="py-3 px-3">Material</th>
                  <th className="py-3 px-3">Color</th>
                  <th className="py-3 px-3 text-center">UOM</th>
                  <th className="py-3 px-3 text-right">Allocated</th>
                  <th className="py-3 px-3 text-right">Issued</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  {showValue && <th className="py-3 px-3 text-right">Value</th>}
                  {showStatus && <th className="py-3 px-3">Status</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rows.length > 0 ? (
                  rows.map((r, i) => (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="py-3 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-3 px-3 font-bold text-emerald-950 whitespace-nowrap uppercase">{r.issueNo}</td>
                      <td className="py-3 px-3 whitespace-nowrap">{r.date || '-'}</td>
                      <td className="py-3 px-3 text-emerald-800 font-semibold uppercase">{r.salesOrder}</td>
                      <td className="py-3 px-3 whitespace-nowrap">{r.productionOrder}</td>
                      <td className="py-3 px-3">{r.plant}</td>
                      <td className="py-3 px-3">{r.warehouse}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {r.itemName} {r.itemCode && <span className="text-slate-500 font-medium">[{r.itemCode}]</span>}
                      </td>
                      <td className="py-3 px-3">{r.color}</td>
                      <td className="py-3 px-3 text-center text-xs text-slate-500 uppercase">{r.uom || '-'}</td>
                      <td className="py-3 px-3 text-right">{fmtQty(r.allocated)}</td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800">{fmtQty(r.issued)}</td>
                      <td className={`py-3 px-3 text-right font-semibold ${r.balance > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {fmtQty(r.balance)}
                      </td>
                      {showValue && <td className="py-3 px-3 text-right">{fmtMoney(r.value)}</td>}
                      {showStatus && (
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 border rounded text-[10px] font-bold uppercase whitespace-nowrap ${statusCls(r.status)}`}>
                            {statusLabel(r.status)}
                          </span>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={colCount} className="py-16 text-center text-slate-400 italic">
                      No goods issue records found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-800">
                    <td colSpan="10" className="py-3 px-3">
                      Total — {totals.issueCount} Issue(s), {rows.length} line(s)
                    </td>
                    <td className="py-3 px-3 text-right">{fmtQty(totals.allocated)}</td>
                    <td className="py-3 px-3 text-right text-emerald-800">{fmtQty(totals.issued)}</td>
                    <td className="py-3 px-3 text-right text-amber-600">{fmtQty(totals.balance)}</td>
                    {showValue && <td className="py-3 px-3 text-right">LKR {fmtMoney(totals.value)}</td>}
                    {showStatus && <td></td>}
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

export default GoodsIssueReportView;
