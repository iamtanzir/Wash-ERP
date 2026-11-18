import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Save,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  WashingMachine,
  Layers,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { api, Order } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { formatNumber } from '../lib/utils';

export type ShiftCode = 'A' | 'B' | 'C';

export interface MachineLotEntry {
  style: string;
  buyer: string;
  color: string;
  washType: string;
}

export interface ShiftMachineRow {
  id: string;
  mcNo: string;
  operatorName: string;
  lots: MachineLotEntry[];
  dyeingBatch: number;
  dyeingPcs: number;
  neutralHeavyBatch: number;
  neutralHeavyPcs: number;
  acidWashBatch: number;
  acidWashPcs: number;
  weightKg: number;
  remarks: string;
}

export interface WashShiftReportDoc {
  id: string;
  date: string;
  shift: ShiftCode;
  unitName: string;
  achievementNote: string;
  targetKg: number;
  rows: ShiftMachineRow[];
  updatedAt: string;
  updatedBy?: string;
}

export const SHIFT_DEFINITIONS: Record<ShiftCode, { label: string; shortLabel: string; timing: string; badgeColor: string }> = {
  A: {
    label: 'Shift: Day (A) (6:00 AM - 02:00 PM)',
    shortLabel: 'Shift A (Day)',
    timing: '6:00 AM - 02:00 PM',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200'
  },
  B: {
    label: 'Shift: Evening (B) (2:00 PM - 10:00 PM)',
    shortLabel: 'Shift B (Evening)',
    timing: '2:00 PM - 10:00 PM',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  C: {
    label: 'Shift: Night (C) (10:00 PM - 6:00 AM)',
    shortLabel: 'Shift C (Night)',
    timing: '10:00 PM - 6:00 AM',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  }
};

const DEFAULT_MACHINE_NAMES = [
  'Belly-01',
  'Belly-02',
  'Belly-03',
  'Yilmak-01',
  'Yilmak-02',
  'Yilmak-03',
  'Yilmak-04',
  'Acidwash-01',
  'Acidwash-02',
  'Acidwash-03'
];

function getDhakaTodayIso(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function createEmptyRows(): ShiftMachineRow[] {
  return DEFAULT_MACHINE_NAMES.map((mcNo, idx) => ({
    id: `mc-${idx}-${mcNo.toLowerCase()}`,
    mcNo,
    operatorName: '',
    lots: [{ style: '', buyer: '', color: '', washType: '' }],
    dyeingBatch: 0,
    dyeingPcs: 0,
    neutralHeavyBatch: 0,
    neutralHeavyPcs: 0,
    acidWashBatch: 0,
    acidWashPcs: 0,
    weightKg: 0,
    remarks: ''
  }));
}

function computeTotals(rows: ShiftMachineRow[]) {
  return rows.reduce(
    (acc, r) => ({
      dyeingBatch: acc.dyeingBatch + (Number(r.dyeingBatch) || 0),
      dyeingPcs: acc.dyeingPcs + (Number(r.dyeingPcs) || 0),
      neutralHeavyBatch: acc.neutralHeavyBatch + (Number(r.neutralHeavyBatch) || 0),
      neutralHeavyPcs: acc.neutralHeavyPcs + (Number(r.neutralHeavyPcs) || 0),
      acidWashBatch: acc.acidWashBatch + (Number(r.acidWashBatch) || 0),
      acidWashPcs: acc.acidWashPcs + (Number(r.acidWashPcs) || 0),
      weightKg: acc.weightKg + (Number(r.weightKg) || 0)
    }),
    {
      dyeingBatch: 0,
      dyeingPcs: 0,
      neutralHeavyBatch: 0,
      neutralHeavyPcs: 0,
      acidWashBatch: 0,
      acidWashPcs: 0,
      weightKg: 0
    }
  );
}

export default function ShiftProductionReport() {
  const queryClient = useQueryClient();
  const { user, isViewer } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>(getDhakaTodayIso);
  const [selectedShift, setSelectedShift] = useState<ShiftCode | 'ALL'>('A');
  const [unitName, setUnitName] = useState<string>('Industrial Garment ERP — Washing Unit');
  const [targetKg, setTargetKg] = useState<number>(2500);
  const [achievementNote, setAchievementNote] = useState<string>('');
  const [rows, setRows] = useState<ShiftMachineRow[]>(createEmptyRows);
  const [saving, setSaving] = useState<boolean>(false);

  const { data: allReports = [], isLoading: reportsLoading } = useQuery<WashShiftReportDoc[]>({
    queryKey: ['wash_shift_reports'],
    queryFn: async () => {
      const res = await fetch('/api/db/wash_shift_reports');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: activeOrders = [] } = useQuery<Order[]>({
    queryKey: ['activeOrdersForShiftReport'],
    queryFn: () => api.getActiveOrders()
  });

  // Order autocomplete suggestions
  const uniqueStyles = useMemo(
    () => Array.from(new Set(activeOrders.map(o => o.style_no).filter(Boolean))),
    [activeOrders]
  );
  const uniqueBuyers = useMemo(
    () => Array.from(new Set(activeOrders.map(o => o.buyer).filter(Boolean))),
    [activeOrders]
  );
  const uniqueColors = useMemo(
    () => Array.from(new Set(activeOrders.map(o => o.color).filter(Boolean))),
    [activeOrders]
  );

  // Reports for the selected date (A, B, C)
  const dayReportsByShift = useMemo(() => {
    const map: Partial<Record<ShiftCode, WashShiftReportDoc>> = {};
    for (const r of allReports) {
      if (r.date === selectedDate && (r.shift === 'A' || r.shift === 'B' || r.shift === 'C')) {
        map[r.shift] = r;
      }
    }
    return map;
  }, [allReports, selectedDate]);

  // Sync editor rows whenever date/shift or fetched reports change
  useEffect(() => {
    if (selectedShift === 'ALL') return;
    const found = dayReportsByShift[selectedShift];
    if (found && Array.isArray(found.rows) && found.rows.length > 0) {
      setRows(
        found.rows.map(r => ({
          ...r,
          lots: Array.isArray(r.lots) && r.lots.length > 0 ? r.lots : [{ style: '', buyer: '', color: '', washType: '' }]
        }))
      );
      setUnitName(found.unitName || 'Industrial Garment ERP — Washing Unit');
      setTargetKg(Number(found.targetKg) || 2500);
      setAchievementNote(found.achievementNote || '');
    } else {
      setRows(createEmptyRows());
      setAchievementNote('');
    }
  }, [selectedDate, selectedShift, dayReportsByShift]);

  const currentTotals = useMemo(() => computeTotals(rows), [rows]);

  // Consolidated 24h (A + B + C) summary for selectedDate
  const consolidatedDaySummary = useMemo(() => {
    const shifts: ShiftCode[] = ['A', 'B', 'C'];
    const perShift = shifts.map(code => {
      const doc = code === selectedShift ? { rows, targetKg } : dayReportsByShift[code];
      const totals = computeTotals(doc?.rows || []);
      const totalBatches = totals.dyeingBatch + totals.neutralHeavyBatch + totals.acidWashBatch;
      const totalPcs = totals.dyeingPcs + totals.neutralHeavyPcs + totals.acidWashPcs;
      return {
        shift: code,
        ...SHIFT_DEFINITIONS[code],
        totals,
        totalBatches,
        totalPcs,
        recorded: Boolean(dayReportsByShift[code])
      };
    });

    const grand = perShift.reduce(
      (acc, s) => ({
        dyeingBatch: acc.dyeingBatch + s.totals.dyeingBatch,
        dyeingPcs: acc.dyeingPcs + s.totals.dyeingPcs,
        neutralHeavyBatch: acc.neutralHeavyBatch + s.totals.neutralHeavyBatch,
        neutralHeavyPcs: acc.neutralHeavyPcs + s.totals.neutralHeavyPcs,
        acidWashBatch: acc.acidWashBatch + s.totals.acidWashBatch,
        acidWashPcs: acc.acidWashPcs + s.totals.acidWashPcs,
        weightKg: acc.weightKg + s.totals.weightKg,
        totalBatches: acc.totalBatches + s.totalBatches,
        totalPcs: acc.totalPcs + s.totalPcs
      }),
      {
        dyeingBatch: 0,
        dyeingPcs: 0,
        neutralHeavyBatch: 0,
        neutralHeavyPcs: 0,
        acidWashBatch: 0,
        acidWashPcs: 0,
        weightKg: 0,
        totalBatches: 0,
        totalPcs: 0
      }
    );

    return { perShift, grand };
  }, [dayReportsByShift, selectedShift, rows, targetKg]);

  const updateRowField = <K extends keyof ShiftMachineRow>(rowIdx: number, field: K, value: ShiftMachineRow[K]) => {
    setRows(prev => prev.map((r, i) => (i === rowIdx ? { ...r, [field]: value } : r)));
  };

  const updateLotField = (rowIdx: number, lotIdx: number, field: keyof MachineLotEntry, value: string) => {
    setRows(prev =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const nextLots = r.lots.map((l, j) => (j === lotIdx ? { ...l, [field]: value } : l));
        return { ...r, lots: nextLots };
      })
    );
  };

  const addLotToMachine = (rowIdx: number) => {
    setRows(prev =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, lots: [...r.lots, { style: '', buyer: '', color: '', washType: '' }] }
          : r
      )
    );
  };

  const removeLotFromMachine = (rowIdx: number, lotIdx: number) => {
    setRows(prev =>
      prev.map((r, i) => {
        if (i !== rowIdx || r.lots.length <= 1) return r;
        return { ...r, lots: r.lots.filter((_, j) => j !== lotIdx) };
      })
    );
  };

  const addCustomMachineRow = () => {
    const num = rows.length + 1;
    setRows(prev => [
      ...prev,
      {
        id: `mc-custom-${Date.now()}`,
        mcNo: `Machine-${String(num).padStart(2, '0')}`,
        operatorName: '',
        lots: [{ style: '', buyer: '', color: '', washType: '' }],
        dyeingBatch: 0,
        dyeingPcs: 0,
        neutralHeavyBatch: 0,
        neutralHeavyPcs: 0,
        acidWashBatch: 0,
        acidWashPcs: 0,
        weightKg: 0,
        remarks: ''
      }
    ]);
  };

  const removeMachineRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== rowIdx));
  };

  const handleSaveShiftReport = async () => {
    if (selectedShift === 'ALL') return;
    setSaving(true);
    try {
      const id = `${selectedDate}_${selectedShift}`;
      const doc: WashShiftReportDoc = {
        id,
        date: selectedDate,
        shift: selectedShift,
        unitName: unitName.trim() || 'Industrial Garment ERP — Washing Unit',
        achievementNote: achievementNote.trim(),
        targetKg: Number(targetKg) || 2500,
        rows,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.username || 'operator'
      };

      const res = await fetch('/api/db/batch/wash_shift_reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operations: [{ type: 'set', id, data: doc }]
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save shift production report');
      }

      await queryClient.invalidateQueries({ queryKey: ['wash_shift_reports'] });
      toast.success(`Saved Shift ${selectedShift} Production Report (${selectedDate})`);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (selectedShift === 'ALL') {
      const sheetRows = consolidatedDaySummary.perShift.map(s => ({
        Shift: s.label,
        Timing: s.timing,
        'Dyeing Batch': s.totals.dyeingBatch,
        'Dyeing Pcs': s.totals.dyeingPcs,
        'Neutral/Heavy Batch': s.totals.neutralHeavyBatch,
        'Neutral/Heavy Pcs': s.totals.neutralHeavyPcs,
        'AcidWash Batch': s.totals.acidWashBatch,
        'AcidWash Pcs': s.totals.acidWashPcs,
        'Total Weight (Kg)': s.totals.weightKg
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All_Shifts_Summary');
      XLSX.writeFile(wb, `Wash_3Shift_Report_${selectedDate}.xlsx`);
      toast.success('Exported 24h 3-Shift Consolidated Report to Excel');
      return;
    }

    const flatRows = rows.map(r => ({
      'M/C No.': r.mcNo,
      'Operator Name': r.operatorName,
      Style: r.lots.map(l => l.style).filter(Boolean).join(' / '),
      Buyer: r.lots.map(l => l.buyer).filter(Boolean).join(' / '),
      Color: r.lots.map(l => l.color).filter(Boolean).join(' / '),
      'Wash Type': r.lots.map(l => l.washType).filter(Boolean).join(' / '),
      'Dyeing Batch': r.dyeingBatch,
      'Dyeing Pcs': r.dyeingPcs,
      'Neutral/Heavy Batch': r.neutralHeavyBatch,
      'Neutral/Heavy Pcs': r.neutralHeavyPcs,
      'AcidWash Batch': r.acidWashBatch,
      'AcidWash Pcs': r.acidWashPcs,
      'Weight (Kg)': r.weightKg,
      Remarks: r.remarks
    }));

    flatRows.push({
      'M/C No.': 'Total',
      'Operator Name': '',
      Style: '',
      Buyer: '',
      Color: '',
      'Wash Type': '',
      'Dyeing Batch': currentTotals.dyeingBatch,
      'Dyeing Pcs': currentTotals.dyeingPcs,
      'Neutral/Heavy Batch': currentTotals.neutralHeavyBatch,
      'Neutral/Heavy Pcs': currentTotals.neutralHeavyPcs,
      'AcidWash Batch': currentTotals.acidWashBatch,
      'AcidWash Pcs': currentTotals.acidWashPcs,
      'Weight (Kg)': currentTotals.weightKg,
      Remarks: achievementNote || `Achievement ${Math.round((currentTotals.weightKg / Math.max(1, targetKg)) * 100)}%`
    });

    const ws = XLSX.utils.json_to_sheet(flatRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Shift_${selectedShift}`);
    XLSX.writeFile(wb, `Daily_Production_Report_Shift_${selectedShift}_${selectedDate}.xlsx`);
    toast.success(`Exported Shift ${selectedShift} Daily Production Report to Excel`);
  };

  const achievementPct = Math.round((currentTotals.weightKg / Math.max(1, targetKg)) * 100);

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto pb-12">
      {/* Header Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <WashingMachine className="text-blue-600" size={24} />
              <span>Daily Production Report — 3 Shift (A, B, C)</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              24h Wash Floor Tracking
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Machine-wise batch log across Belly, Yilmak &amp; Acidwash machines • Operator attendance, Weight (Kg) &amp; Downtime Remarks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar size={14} className="text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
            />
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>

          {selectedShift !== 'ALL' && !isViewer && (
            <button
              onClick={handleSaveShiftReport}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Save Shift {selectedShift}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Shift Switcher + All Shifts 24h Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        {(['A', 'B', 'C'] as ShiftCode[]).map(code => {
          const def = SHIFT_DEFINITIONS[code];
          const active = selectedShift === code;
          const summary = consolidatedDaySummary.perShift.find(s => s.shift === code)!;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setSelectedShift(code)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-black uppercase tracking-wider">Shift {code}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    active ? 'bg-blue-500/20 text-blue-300' : summary.recorded ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {summary.recorded ? 'Saved' : 'Draft'}
                </span>
              </div>
              <p className={`text-[11px] flex items-center gap-1 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                <Clock size={11} /> {def.timing}
              </p>
              <div className="mt-2.5 pt-2 border-t border-current/10 flex items-baseline justify-between text-xs font-mono">
                <span className="font-bold">{formatNumber(summary.totals.weightKg)} Kg</span>
                <span className={active ? 'text-cyan-300' : 'text-slate-600'}>
                  {summary.totalBatches} Batch • {formatNumber(summary.totalPcs)} Pcs
                </span>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedShift('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedShift === 'ALL'
              ? 'bg-blue-700 text-white border-blue-700 shadow-md'
              : 'bg-white hover:bg-blue-50/40 text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
              <Layers size={13} /> All 3 Shifts (24h)
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedShift === 'ALL' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>
              A + B + C
            </span>
          </div>
          <p className={`text-[11px] ${selectedShift === 'ALL' ? 'text-blue-100' : 'text-slate-500'}`}>
            Consolidated Full Day Production
          </p>
          <div className="mt-2.5 pt-2 border-t border-current/10 flex items-baseline justify-between text-xs font-mono">
            <span className="font-bold">{formatNumber(consolidatedDaySummary.grand.weightKg)} Kg</span>
            <span className={selectedShift === 'ALL' ? 'text-amber-200' : 'text-blue-700'}>
              {consolidatedDaySummary.grand.totalBatches} Batch • {formatNumber(consolidatedDaySummary.grand.totalPcs)} Pcs
            </span>
          </div>
        </button>
      </div>

      {/* Autocomplete Datalists from active ERP orders */}
      <datalist id="shift-erp-styles">
        {uniqueStyles.map(s => <option key={s} value={s} />)}
      </datalist>
      <datalist id="shift-erp-buyers">
        {uniqueBuyers.map(b => <option key={b} value={b} />)}
      </datalist>
      <datalist id="shift-erp-colors">
        {uniqueColors.map(c => <option key={c} value={c} />)}
      </datalist>

      {reportsLoading ? (
        <div className="bg-white p-14 rounded-2xl border border-slate-200 text-center">
          <RefreshCw className="animate-spin text-blue-600 mx-auto mb-2" size={28} />
          <p className="text-sm font-bold text-slate-700">Loading 3-Shift Wash Production Reports...</p>
        </div>
      ) : selectedShift === 'ALL' ? (
        /* CONSOLIDATED A + B + C 24-HOUR VIEW */
        <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 text-center bg-slate-50">
            <h2 className="text-xl font-black text-slate-900">Daily Production Report — Consolidated (Shift A + B + C)</h2>
            <p className="text-sm font-bold text-slate-700 mt-0.5">{unitName}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">Production Date: {selectedDate} (24 Hours)</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                  <th className="p-3 text-left border-r border-slate-200">Shift</th>
                  <th className="p-3 text-left border-r border-slate-200">Shift Timing</th>
                  <th className="p-3 text-center border-r border-slate-200">Dyeing (Batch / Pcs)</th>
                  <th className="p-3 text-center border-r border-slate-200">Neutral / Heavy Wash (Batch / Pcs)</th>
                  <th className="p-3 text-center border-r border-slate-200">AcidWash (Batch / Pcs)</th>
                  <th className="p-3 text-right border-r border-slate-200">Total Weight (Kg)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {consolidatedDaySummary.perShift.map(s => (
                  <tr
                    key={s.shift}
                    onClick={() => setSelectedShift(s.shift)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-black text-slate-900 border-r border-slate-200">{s.shortLabel}</td>
                    <td className="p-3.5 font-mono text-slate-600 border-r border-slate-200">{s.timing}</td>
                    <td className="p-3.5 text-center font-mono border-r border-slate-200">
                      <span className="font-bold">{s.totals.dyeingBatch} Batch</span> / {formatNumber(s.totals.dyeingPcs)} Pcs
                    </td>
                    <td className="p-3.5 text-center font-mono border-r border-slate-200">
                      <span className="font-bold">{s.totals.neutralHeavyBatch} Batch</span> / {formatNumber(s.totals.neutralHeavyPcs)} Pcs
                    </td>
                    <td className="p-3.5 text-center font-mono border-r border-slate-200">
                      <span className="font-bold">{s.totals.acidWashBatch} Batch</span> / {formatNumber(s.totals.acidWashPcs)} Pcs
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900 border-r border-slate-200">
                      {formatNumber(s.totals.weightKg)} Kg
                    </td>
                    <td className="p-3.5 text-center">
                      {s.recorded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          <CheckCircle2 size={11} /> Logged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          <AlertTriangle size={11} /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-yellow-300 border-t-2 border-slate-800 font-black text-slate-900">
                  <td colSpan={2} className="p-3.5 text-center border-r border-slate-700 text-sm">
                    24h Total (Shift A + B + C)
                  </td>
                  <td className="p-3.5 text-center font-mono border-r border-slate-700">
                    <div>{consolidatedDaySummary.grand.dyeingBatch} Batch</div>
                    <div>{formatNumber(consolidatedDaySummary.grand.dyeingPcs)} Pcs</div>
                  </td>
                  <td className="p-3.5 text-center font-mono border-r border-slate-700">
                    <div>{consolidatedDaySummary.grand.neutralHeavyBatch} Batch</div>
                    <div>{formatNumber(consolidatedDaySummary.grand.neutralHeavyPcs)} Pcs</div>
                  </td>
                  <td className="p-3.5 text-center font-mono border-r border-slate-700">
                    <div>{consolidatedDaySummary.grand.acidWashBatch} Batch</div>
                    <div>{formatNumber(consolidatedDaySummary.grand.acidWashPcs)} Pcs</div>
                  </td>
                  <td className="p-3.5 text-right font-mono bg-orange-400 text-slate-950 text-sm border-r border-slate-700">
                    {formatNumber(consolidatedDaySummary.grand.weightKg)} Kg
                  </td>
                  <td className="p-3.5 text-center bg-amber-400 text-slate-950">
                    {consolidatedDaySummary.grand.totalBatches} Batch • {formatNumber(consolidatedDaySummary.grand.totalPcs)} Pcs
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* INDIVIDUAL SHIFT SHEET (MATCHING OFFICIAL DAILY PRODUCTION REPORT LAYOUT) */
        <div className="bg-white rounded-2xl border border-slate-400 shadow-sm overflow-hidden">
          {/* Official Sheet Header */}
          <div className="p-5 border-b border-slate-300 bg-white">
            <div className="text-center mb-3">
              <h2 className="text-xl font-black text-slate-950">Daily Production Report</h2>
              <input
                type="text"
                disabled={isViewer}
                value={unitName}
                onChange={e => setUnitName(e.target.value)}
                className="text-center text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-full max-w-md mx-auto block"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-bold text-slate-900">
              <span>{SHIFT_DEFINITIONS[selectedShift].label}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 print:hidden">
                  <span>Shift Target (Kg):</span>
                  <input
                    type="number"
                    disabled={isViewer}
                    value={targetKg}
                    onChange={e => setTargetKg(Number(e.target.value) || 0)}
                    className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-0.5 font-mono text-slate-900"
                  />
                </label>
                <span className="font-mono font-black">Date: {selectedDate}</span>
              </div>
            </div>
          </div>

          {/* Main 10-Machine Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[1150px]">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-800 text-slate-900 font-bold text-center">
                  <th className="p-2.5 border-r border-slate-300 w-24">M/C No.</th>
                  <th className="p-2.5 border-r border-slate-300 w-32">Operator Name</th>
                  <th className="p-2.5 border-r border-slate-300 w-24">Style</th>
                  <th className="p-2.5 border-r border-slate-300 w-28">Buyer</th>
                  <th className="p-2.5 border-r border-slate-300 w-24">Color</th>
                  <th className="p-2.5 border-r border-slate-300 w-32">Wash Type</th>
                  <th className="p-2.5 border-r border-slate-300 w-28">Dyeing<br /><span className="text-[10px] font-normal text-slate-500">Batch / Pcs</span></th>
                  <th className="p-2.5 border-r border-slate-300 w-32">Neutral/Heavy Wash<br /><span className="text-[10px] font-normal text-slate-500">Batch / Pcs</span></th>
                  <th className="p-2.5 border-r border-slate-300 w-28">AcidWash<br /><span className="text-[10px] font-normal text-slate-500">Batch / Pcs</span></th>
                  <th className="p-2.5 border-r border-slate-300 w-24">Weight (Kg)</th>
                  <th className="p-2.5 min-w-[240px]">Remarks</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {rows.map((row, rowIdx) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 align-top">
                    {/* M/C No. */}
                    <td className="p-2 border-r border-slate-300 font-bold text-slate-900 bg-slate-50/40">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          disabled={isViewer}
                          value={row.mcNo}
                          onChange={e => updateRowField(rowIdx, 'mcNo', e.target.value)}
                          className="w-full bg-transparent font-bold text-slate-900 focus:bg-white focus:outline-none px-1 py-0.5 rounded"
                        />
                        {!isViewer && rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMachineRow(rowIdx)}
                            className="text-slate-300 hover:text-rose-500 print:hidden"
                            title="Remove Machine Row"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Operator Name */}
                    <td className="p-2 border-r border-slate-300">
                      <input
                        type="text"
                        disabled={isViewer}
                        value={row.operatorName}
                        onChange={e => updateRowField(rowIdx, 'operatorName', e.target.value)}
                        placeholder="Operator"
                        className="w-full bg-transparent text-center font-semibold uppercase text-slate-800 focus:bg-white focus:outline-none px-1 py-1 rounded"
                      />
                    </td>

                    {/* Style / Buyer / Color / Wash Type multi-lot column group */}
                    <td colSpan={4} className="p-1.5 border-r border-slate-300">
                      <div className="space-y-1">
                        {row.lots.map((lot, lotIdx) => (
                          <div key={lotIdx} className="grid grid-cols-4 gap-1 items-center">
                            <input
                              type="text"
                              list="shift-erp-styles"
                              disabled={isViewer}
                              value={lot.style}
                              onChange={e => updateLotField(rowIdx, lotIdx, 'style', e.target.value)}
                              placeholder="Style"
                              className="bg-slate-50/80 border border-slate-200 rounded px-1.5 py-1 text-center font-mono text-[11px] focus:bg-white focus:outline-none"
                            />
                            <input
                              type="text"
                              list="shift-erp-buyers"
                              disabled={isViewer}
                              value={lot.buyer}
                              onChange={e => updateLotField(rowIdx, lotIdx, 'buyer', e.target.value)}
                              placeholder="Buyer"
                              className="bg-slate-50/80 border border-slate-200 rounded px-1.5 py-1 text-center font-semibold text-[11px] focus:bg-white focus:outline-none"
                            />
                            <input
                              type="text"
                              list="shift-erp-colors"
                              disabled={isViewer}
                              value={lot.color}
                              onChange={e => updateLotField(rowIdx, lotIdx, 'color', e.target.value)}
                              placeholder="Color"
                              className="bg-slate-50/80 border border-slate-200 rounded px-1.5 py-1 text-center text-[11px] focus:bg-white focus:outline-none"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                disabled={isViewer}
                                value={lot.washType}
                                onChange={e => updateLotField(rowIdx, lotIdx, 'washType', e.target.value)}
                                placeholder="Wash Type"
                                className="w-full bg-slate-50/80 border border-slate-200 rounded px-1.5 py-1 text-[11px] focus:bg-white focus:outline-none"
                              />
                              {!isViewer && row.lots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeLotFromMachine(rowIdx, lotIdx)}
                                  className="text-rose-400 hover:text-rose-600 print:hidden shrink-0"
                                  title="Remove Lot"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {!isViewer && (
                          <button
                            type="button"
                            onClick={() => addLotToMachine(rowIdx)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 print:hidden px-1"
                          >
                            + Add Style / Lot
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Dyeing (Batch / Pcs) */}
                    <td className="p-2 border-r border-slate-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.dyeingBatch || ''}
                            onChange={e => updateRowField(rowIdx, 'dyeingBatch', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-500">B</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.dyeingPcs || ''}
                            onChange={e => updateRowField(rowIdx, 'dyeingPcs', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Pcs</span>
                        </div>
                      </div>
                    </td>

                    {/* Neutral / Heavy Wash (Batch / Pcs) */}
                    <td className="p-2 border-r border-slate-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.neutralHeavyBatch || ''}
                            onChange={e => updateRowField(rowIdx, 'neutralHeavyBatch', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-500">B</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.neutralHeavyPcs || ''}
                            onChange={e => updateRowField(rowIdx, 'neutralHeavyPcs', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Pcs</span>
                        </div>
                      </div>
                    </td>

                    {/* AcidWash (Batch / Pcs) */}
                    <td className="p-2 border-r border-slate-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.acidWashBatch || ''}
                            onChange={e => updateRowField(rowIdx, 'acidWashBatch', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono font-bold"
                          />
                          <span className="text-[10px] text-slate-500">B</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            disabled={isViewer}
                            value={row.acidWashPcs || ''}
                            onChange={e => updateRowField(rowIdx, 'acidWashPcs', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center font-mono"
                          />
                          <span className="text-[10px] text-slate-500">Pcs</span>
                        </div>
                      </div>
                    </td>

                    {/* Weight (Kg) */}
                    <td className="p-2 border-r border-slate-300">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          disabled={isViewer}
                          value={row.weightKg || ''}
                          onChange={e => updateRowField(rowIdx, 'weightKg', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-right font-mono font-black text-slate-900"
                        />
                        <span className="text-[10px] font-bold text-slate-500">Kg</span>
                      </div>
                    </td>

                    {/* Remarks */}
                    <td className="p-2">
                      <textarea
                        rows={2}
                        disabled={isViewer}
                        value={row.remarks}
                        onChange={e => updateRowField(rowIdx, 'remarks', e.target.value)}
                        placeholder="e.g. 30m delay r/w gmts load, M/C clean 02:00-02:40..."
                        className="w-full bg-slate-50/70 border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800 focus:bg-white focus:outline-none resize-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Yellow / Orange Totals Footer Row matching official report */}
              <tfoot>
                <tr className="bg-yellow-300 border-t-2 border-slate-900 font-black text-slate-950">
                  <td colSpan={6} className="p-3 text-center text-sm border-r border-slate-800">
                    Total
                  </td>
                  <td className="p-2.5 text-center font-mono border-r border-slate-800">
                    <div>{currentTotals.dyeingBatch} Batch</div>
                    <div className="border-t border-slate-700/40 pt-0.5 mt-0.5">{formatNumber(currentTotals.dyeingPcs)} Pcs</div>
                  </td>
                  <td className="p-2.5 text-center font-mono border-r border-slate-800">
                    <div>{currentTotals.neutralHeavyBatch} Batch</div>
                    <div className="border-t border-slate-700/40 pt-0.5 mt-0.5">{formatNumber(currentTotals.neutralHeavyPcs)} Pcs</div>
                  </td>
                  <td className="p-2.5 text-center font-mono border-r border-slate-800">
                    <div>{currentTotals.acidWashBatch} Batch</div>
                    <div className="border-t border-slate-700/40 pt-0.5 mt-0.5">{formatNumber(currentTotals.acidWashPcs)} Pcs</div>
                  </td>
                  <td className="p-2.5 text-center font-mono bg-orange-400 text-slate-950 text-sm border-r border-slate-800">
                    {formatNumber(currentTotals.weightKg)} Kg
                  </td>
                  <td className="p-2 bg-amber-400 text-slate-950">
                    <input
                      type="text"
                      disabled={isViewer}
                      value={achievementNote}
                      onChange={e => setAchievementNote(e.target.value)}
                      placeholder={`Achievement: ${achievementPct}% (Target ${targetKg} Kg)`}
                      className="w-full bg-transparent text-center font-bold text-xs text-slate-950 placeholder:text-slate-800 focus:bg-white/60 rounded px-2 py-1 focus:outline-none"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!isViewer && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <button
                type="button"
                onClick={addCustomMachineRow}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer"
              >
                <Plus size={14} /> Add Custom Machine Row
              </button>

              <button
                type="button"
                onClick={handleSaveShiftReport}
                disabled={saving}
                className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>{saving ? 'Saving...' : `Save Shift ${selectedShift} to Database`}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
