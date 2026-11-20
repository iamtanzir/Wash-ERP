import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  Upload,
  Search,
  AlertTriangle,
  CheckCircle2,
  Database,
  Save,
  Filter,
  Ruler,
  BarChart3,
  RotateCcw,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { cn, formatNumber } from '../lib/utils';

interface RejectionEntry {
  id: string;
  buyer: string;
  erpNo: string;
  colour: string;
  country: string;
  rDate: string;
  xs: number;
  s: number;
  m: number;
  l: number;
  xl: number;
  xxl: number;
  noSize: number;
  customSizes?: Record<string, number>;
  ttl: number;
  rejectionType: string;
  remarks: string;
}

interface CustomErpMaster {
  erpNo: string;
  buyer: string;
  colour: string;
  recvQty: number;
}

const DEFAULT_SIZE_LIST = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const NO_SIZE_LABEL = 'No Size';

const DEFAULT_SIZE_RATIOS: Record<string, number> = {
  XS: 5,
  S: 10,
  M: 20,
  L: 25,
  XL: 25,
  XXL: 15,
  'No Size': 0
};

const COMMON_DEFECT_REMARKS = [
  'Wash Reject',
  'Shade Reject',
  'Body Hole',
  'Needle Cut',
  'Part & Sleeve Shade',
  'Part Shade',
  'Big Spot',
  'Zipper Rejection',
  'Broken Stitch',
  'Oil Spot'
];

const COMMON_COUNTRIES = ['Normal', 'US', 'Asia', 'EU', 'UK', 'Global'];

const REJECTION_TYPES = ['Before Wash Rejections', 'After Wash Rejections'];

function getDhakaTodayIso(): string {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().split('T')[0];
}

function normalizeDefectLabel(raw: string): string {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const low = clean.toLowerCase();
  const aliasMap: Record<string, string> = {
    'wash raject': 'Wash Reject',
    'wash reject': 'Wash Reject',
    'wash rejt': 'Wash Reject',
    'neddle cut': 'Needle Cut',
    'needle cut': 'Needle Cut',
    'big sport': 'Big Spot',
    'big spot': 'Big Spot',
    'shade raject': 'Shade Reject',
    'shade reject': 'Shade Reject',
    'part shade': 'Part Shade',
    'part & sleeve shade': 'Part & Sleeve Shade',
    'part & sleeve shde': 'Part & Sleeve Shade',
    'body hole': 'Body Hole',
    'zipper rejection': 'Zipper Rejection',
    'broken stitch': 'Broken Stitch',
    'broken stich': 'Broken Stitch',
    'oil spot': 'Oil Spot',
    'oil sport': 'Oil Spot'
  };
  return aliasMap[low] || clean;
}

function parseSizeListText(text: string): string[] {
  const parts = String(text || '')
    .split(/[,\n|]+/)
    .map(p => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (p.toLowerCase().replace(/\s+/g, '') === 'nosize') continue;
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function getEntrySizeQty(entry: RejectionEntry, sizeLabel: string): number {
  const norm = sizeLabel.toLowerCase().replace(/\s+/g, '');
  if (entry.customSizes && typeof entry.customSizes === 'object') {
    for (const [k, v] of Object.entries(entry.customSizes)) {
      if (k.toLowerCase().replace(/\s+/g, '') === norm) {
        return Number(v) || 0;
      }
    }
  }
  if (norm === 'xs') return Number(entry.xs) || 0;
  if (norm === 's') return Number(entry.s) || 0;
  if (norm === 'm') return Number(entry.m) || 0;
  if (norm === 'l') return Number(entry.l) || 0;
  if (norm === 'xl') return Number(entry.xl) || 0;
  if (norm === 'xxl') return Number(entry.xxl) || 0;
  if (norm === 'nosize') return Number(entry.noSize) || 0;
  return 0;
}

function getExtraCustomSizeTags(entry: RejectionEntry): string[] {
  if (!entry.customSizes || typeof entry.customSizes !== 'object') return [];
  const std = new Set(['xs', 's', 'm', 'l', 'xl', 'xxl', 'nosize']);
  return Object.entries(entry.customSizes)
    .filter(([k, v]) => !std.has(k.toLowerCase().replace(/\s+/g, '')) && Number(v) > 0)
    .map(([k, v]) => `${k}:${v}`);
}

function normalizeExcelDateValue(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 25000 && raw < 70000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const s = String(raw || '').trim();
  if (!s) return getDhakaTodayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return getDhakaTodayIso();
}

export default function WashRejectionReport() {
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;

  const [activeTab, setActiveTab] = useState<'size_list' | 'rejection_db' | 'erp_recv' | 'buyer_sizes'>('size_list');
  const [entries, setEntries] = useState<RejectionEntry[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [dailyLogs, setDailyLogs] = useState<any[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters — Multi-Buyer Ready + Date Range
  const [selectedBuyer, setSelectedBuyer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [importDefaultBuyer, setImportDefaultBuyer] = useState<string>('H&M');

  // Config (Size List Ratios + ERP Recv Qty Overrides + Custom ERP Master rows + Per-Buyer Custom Size Lists)
  const [sizeRatios, setSizeRatios] = useState<Record<string, number>>(DEFAULT_SIZE_RATIOS);
  const [recvOverrides, setRecvOverrides] = useState<Record<string, number>>({});
  const [customErpMasters, setCustomErpMasters] = useState<CustomErpMaster[]>([]);
  const [buyerSizeLists, setBuyerSizeLists] = useState<Record<string, string[]>>({});

  // Inline Quick Add State (supports both standard XS–XXL and dynamic per-buyer sizes)
  const [draftMeta, setDraftMeta] = useState({
    buyer: '',
    erpNo: '',
    colour: '',
    country: 'Normal',
    rDate: getDhakaTodayIso(),
    rejectionType: 'Before Wash Rejections',
    remarks: 'Shade Reject'
  });
  const [draftSizes, setDraftSizes] = useState<Record<string, number>>({});
  const [draftManualRecv, setDraftManualRecv] = useState<string>('');
  const [confirmOverRecv, setConfirmOverRecv] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const firstSizeInputRef = useRef<HTMLInputElement | null>(null);

  // Buyer Size Lists Tab State
  const [sizeCfgBuyer, setSizeCfgBuyer] = useState('');
  const [sizeCfgText, setSizeCfgText] = useState(DEFAULT_SIZE_LIST.join(', '));

  // Custom ERP Master add state (Tab 3)
  const [newMaster, setNewMaster] = useState<CustomErpMaster>({
    erpNo: '',
    buyer: '',
    colour: '',
    recvQty: 0
  });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [rejRes, ordRes, logRes, archRes] = await Promise.all([
        api.getWashRejections(),
        api.getActiveOrders().catch(() => []),
        api.getAllDailyLogs().catch(() => []),
        api.getArchiveData().catch(() => [])
      ]);

      setEntries(Array.isArray(rejRes?.entries) ? rejRes.entries : []);
      if (rejRes?.config?.sizeRatios) {
        setSizeRatios({ ...DEFAULT_SIZE_RATIOS, ...rejRes.config.sizeRatios });
      }
      if (rejRes?.config?.recvOverrides) {
        setRecvOverrides(rejRes.config.recvOverrides);
      }
      if (Array.isArray(rejRes?.config?.customErpMasters)) {
        setCustomErpMasters(rejRes.config.customErpMasters);
      }
      if (rejRes?.config?.buyerSizeLists && typeof rejRes.config.buyerSizeLists === 'object') {
        setBuyerSizeLists(rejRes.config.buyerSizeLists);
      }
      setOrders(Array.isArray(ordRes) ? ordRes : []);
      setDailyLogs(Array.isArray(logRes) ? logRes : []);
      setArchivedOrders(Array.isArray(archRes) ? archRes : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load rejection data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Resolve active size list for any buyer (always appends No Size)
  const baseSizesForBuyer = (buyerName: string): string[] => {
    const clean = buyerName.trim().toLowerCase();
    if (clean) {
      for (const [bKey, list] of Object.entries(buyerSizeLists)) {
        if (bKey.trim().toLowerCase() === clean && Array.isArray(list) && list.length > 0) {
          return list;
        }
      }
    }
    return DEFAULT_SIZE_LIST;
  };

  const fullSizesForBuyer = (buyerName: string): string[] => {
    return [...baseSizesForBuyer(buyerName), NO_SIZE_LABEL];
  };

  // Sync Buyer Size List editor text when buyer changes in Tab 4
  useEffect(() => {
    const clean = sizeCfgBuyer.trim().toLowerCase();
    if (!clean) {
      setSizeCfgText(DEFAULT_SIZE_LIST.join(', '));
      return;
    }
    const existingKey = Object.keys(buyerSizeLists).find(k => k.trim().toLowerCase() === clean);
    const list = existingKey ? buyerSizeLists[existingKey] : DEFAULT_SIZE_LIST;
    setSizeCfgText((list && list.length > 0 ? list : DEFAULT_SIZE_LIST).join(', '));
  }, [sizeCfgBuyer, buyerSizeLists]);

  // Build Unified ERP Master Map across ALL Buyers (Active ERP + Daily Logs + Archive + Custom Overrides)
  const erpMasterList = useMemo(() => {
    const logsByOrder = new Map<string, number>();
    for (const l of dailyLogs) {
      const key = String(l.erp_order || '').trim();
      if (!key) continue;
      logsByOrder.set(key, (logsByOrder.get(key) || 0) + (Number(l.received_qty) || 0));
    }

    const masterMap = new Map<
      string,
      { erpNo: string; buyer: string; colour: string; autoRecvQty: number; recvQty: number; type: string }
    >();

    for (const o of orders) {
      const erpNo = String(o.file_no || o.id || '').trim();
      if (!erpNo) continue;
      const byId = logsByOrder.get(String(o.id)) || 0;
      const byFile = o.file_no ? logsByOrder.get(String(o.file_no).trim()) || 0 : 0;
      const autoRecv = byId > 0 ? byId : byFile;
      const key = erpNo.toLowerCase();
      const override = recvOverrides[erpNo];
      const washType = String(o.wash_type || o.type || 'Wash').trim() || 'Wash';
      if (!masterMap.has(key)) {
        masterMap.set(key, {
          erpNo,
          buyer: String(o.buyer || 'Unknown').trim(),
          colour: String(o.color || o.colour || '').trim(),
          autoRecvQty: autoRecv,
          recvQty: typeof override === 'number' ? override : autoRecv,
          type: washType
        });
      } else {
        const cur = masterMap.get(key)!;
        cur.autoRecvQty += autoRecv;
        cur.recvQty = typeof override === 'number' ? override : cur.autoRecvQty;
      }
    }

    for (const a of archivedOrders) {
      const erpNo = String(a.file_no || a.erp_order || '').trim();
      if (!erpNo) continue;
      const key = erpNo.toLowerCase();
      const autoRecv = Number(a.total_received) || 0;
      const override = recvOverrides[erpNo];
      if (!masterMap.has(key)) {
        masterMap.set(key, {
          erpNo,
          buyer: String(a.buyer || 'Unknown').trim(),
          colour: String(a.color || a.colour || '').trim(),
          autoRecvQty: autoRecv,
          recvQty: typeof override === 'number' ? override : autoRecv,
          type: String(a.wash_type || 'Wash').trim() || 'Wash'
        });
      }
    }

    for (const cm of customErpMasters) {
      const erpNo = String(cm.erpNo || '').trim();
      if (!erpNo) continue;
      const key = erpNo.toLowerCase();
      const override = recvOverrides[erpNo];
      if (!masterMap.has(key)) {
        masterMap.set(key, {
          erpNo,
          buyer: String(cm.buyer || 'Unknown').trim(),
          colour: String(cm.colour || '').trim(),
          autoRecvQty: Number(cm.recvQty) || 0,
          recvQty: typeof override === 'number' ? override : Number(cm.recvQty) || 0,
          type: 'Wash'
        });
      }
    }

    // Ensure every rejection entry's ERP shows up in ERP MASTER even if added standalone
    for (const e of entries) {
      const erpNo = String(e.erpNo || '').trim();
      if (!erpNo) continue;
      const key = erpNo.toLowerCase();
      if (!masterMap.has(key)) {
        const override = recvOverrides[erpNo];
        masterMap.set(key, {
          erpNo,
          buyer: String(e.buyer || 'Unknown').trim(),
          colour: String(e.colour || '').trim(),
          autoRecvQty: 0,
          recvQty: typeof override === 'number' ? override : 0,
          type: 'Wash'
        });
      }
    }

    return Array.from(masterMap.values()).sort((a, b) => a.erpNo.localeCompare(b.erpNo));
  }, [orders, dailyLogs, archivedOrders, customErpMasters, entries, recvOverrides]);

  const recvByErpLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of erpMasterList) {
      map.set(m.erpNo.toLowerCase(), m.recvQty);
    }
    return map;
  }, [erpMasterList]);

  // All distinct Buyers across ERP + Rejection logs + Buyer Size Lists
  const allBuyers = useMemo(() => {
    const set = new Set<string>();
    for (const m of erpMasterList) {
      if (m.buyer && m.buyer !== 'Unknown') set.add(m.buyer);
    }
    for (const e of entries) {
      if (e.buyer && e.buyer !== 'Unknown') set.add(e.buyer);
    }
    for (const b of Object.keys(buyerSizeLists)) {
      if (b.trim()) set.add(b.trim());
    }
    return Array.from(set).sort();
  }, [erpMasterList, entries, buyerSizeLists]);

  // Filtered Rejection Entries (Buyer + Search + Stage + Date Range)
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries
      .filter(e => {
        if (selectedBuyer !== 'ALL' && e.buyer.toLowerCase() !== selectedBuyer.toLowerCase()) return false;
        if (typeFilter !== 'ALL' && e.rejectionType !== typeFilter) return false;
        if (dateFrom && e.rDate < dateFrom) return false;
        if (dateTo && e.rDate > dateTo) return false;
        if (q) {
          const hay = `${e.buyer} ${e.erpNo} ${e.colour} ${e.country} ${normalizeDefectLabel(e.remarks)} ${e.rDate}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => `${a.rDate}_${a.erpNo}`.localeCompare(`${b.rDate}_${b.erpNo}`));
  }, [entries, selectedBuyer, typeFilter, dateFrom, dateTo, searchQuery]);

  // Active display size columns for tables: respects Buyer Custom Size List when a single buyer is selected
  const activeTableSizeColumns = useMemo(() => {
    if (selectedBuyer === 'ALL') {
      return [...DEFAULT_SIZE_LIST, NO_SIZE_LABEL];
    }
    const base = baseSizesForBuyer(selectedBuyer);
    const seen = new Set(base.map(s => s.toLowerCase().replace(/\s+/g, '')));
    const extras: string[] = [];
    for (const e of filteredEntries) {
      if (e.customSizes && typeof e.customSizes === 'object') {
        for (const [k, v] of Object.entries(e.customSizes)) {
          const norm = k.toLowerCase().replace(/\s+/g, '');
          if (norm !== 'nosize' && !seen.has(norm) && Number(v) > 0) {
            seen.add(norm);
            extras.push(k);
          }
        }
      }
    }
    return [...base, ...extras, NO_SIZE_LABEL];
  }, [selectedBuyer, buyerSizeLists, filteredEntries]);

  // Active size inputs for entry draft form
  const draftSizeFields = useMemo(() => {
    return fullSizesForBuyer(draftMeta.buyer || (selectedBuyer !== 'ALL' ? selectedBuyer : ''));
  }, [draftMeta.buyer, selectedBuyer, buyerSizeLists]);

  // Size-List Bottom Totals (includes dynamic sizeTotals map + standard KPIs)
  const { totals, sizeColumnTotals } = useMemo(() => {
    const colTotals: Record<string, number> = {};
    for (const col of activeTableSizeColumns) colTotals[col] = 0;

    const acc = { xs: 0, s: 0, m: 0, l: 0, xl: 0, xxl: 0, noSize: 0, ttl: 0, before: 0, after: 0 };
    for (const r of filteredEntries) {
      acc.xs += Number(r.xs) || 0;
      acc.s += Number(r.s) || 0;
      acc.m += Number(r.m) || 0;
      acc.l += Number(r.l) || 0;
      acc.xl += Number(r.xl) || 0;
      acc.xxl += Number(r.xxl) || 0;
      acc.noSize += Number(r.noSize) || 0;
      const rowTtl = Number(r.ttl) || 0;
      acc.ttl += rowTtl;
      if (/after/i.test(r.rejectionType)) acc.after += rowTtl;
      else acc.before += rowTtl;

      for (const col of activeTableSizeColumns) {
        colTotals[col] = (colTotals[col] || 0) + getEntrySizeQty(r, col);
      }
    }
    return { totals: acc, sizeColumnTotals: colTotals };
  }, [filteredEntries, activeTableSizeColumns]);

  // Rejection DB Grouped Subtotals (Buyer + ERP + Colour + Rejection Type -> Percentage Upto + Recv Qty)
  const groupedRejectionDb = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        buyer: string;
        erpNo: string;
        colour: string;
        rejectionType: string;
        rows: RejectionEntry[];
        groupTtl: number;
        recvQty: number;
        pctUpto: number;
      }
    >();

    for (const e of filteredEntries) {
      const key = `${e.buyer}||${e.erpNo}||${e.colour}||${e.rejectionType}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          buyer: e.buyer,
          erpNo: e.erpNo,
          colour: e.colour,
          rejectionType: e.rejectionType,
          rows: [],
          groupTtl: 0,
          recvQty: recvByErpLookup.get(e.erpNo.trim().toLowerCase()) || 0,
          pctUpto: 0
        });
      }
      const g = groups.get(key)!;
      g.rows.push(e);
      g.groupTtl += Number(e.ttl) || 0;
      g.pctUpto = g.recvQty > 0 ? Number(((g.groupTtl / g.recvQty) * 100).toFixed(2)) : 0;
    }

    return Array.from(groups.values());
  }, [filteredEntries, recvByErpLookup]);

  // Combined Per-(Buyer + ERP + Colour) Stage Summary (Before vs After vs TTL % with >= 1.00% flag)
  const erpColourStageSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        buyer: string;
        erpNo: string;
        colour: string;
        recvQty: number;
        before: number;
        after: number;
        total: number;
        beforePct: number;
        afterPct: number;
        totalPct: number;
      }
    >();

    for (const e of filteredEntries) {
      const key = `${e.buyer}||${e.erpNo}||${e.colour}`;
      if (!map.has(key)) {
        const recvQty = recvByErpLookup.get(e.erpNo.trim().toLowerCase()) || 0;
        map.set(key, {
          key,
          buyer: e.buyer,
          erpNo: e.erpNo,
          colour: e.colour,
          recvQty,
          before: 0,
          after: 0,
          total: 0,
          beforePct: 0,
          afterPct: 0,
          totalPct: 0
        });
      }
      const row = map.get(key)!;
      const qty = Number(e.ttl) || 0;
      if (/after/i.test(e.rejectionType)) row.after += qty;
      else row.before += qty;
      row.total = row.before + row.after;
      if (row.recvQty > 0) {
        row.beforePct = Number(((row.before / row.recvQty) * 100).toFixed(2));
        row.afterPct = Number(((row.after / row.recvQty) * 100).toFixed(2));
        row.totalPct = Number(((row.total / row.recvQty) * 100).toFixed(2));
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalPct - a.totalPct || b.total - a.total);
  }, [filteredEntries, recvByErpLookup]);

  // Defect-Wise Pareto Breakdown (auto-normalized labels)
  const defectPareto = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of filteredEntries) {
      const defectName = normalizeDefectLabel(e.remarks) || 'Unspecified Defect';
      counts.set(defectName, (counts.get(defectName) || 0) + (Number(e.ttl) || 0));
    }
    return Array.from(counts.entries())
      .map(([defect, qty]) => ({
        defect,
        qty,
        sharePct: totals.ttl > 0 ? Number(((qty / totals.ttl) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.qty - a.qty);
  }, [filteredEntries, totals.ttl]);

  // Covered Recv Qty across filtered ERPs
  const totalCoveredRecvQty = useMemo(() => {
    const seen = new Set<string>();
    let sum = 0;
    const filteredErps =
      dateFrom || dateTo || typeFilter !== 'ALL' || searchQuery.trim()
        ? new Set(filteredEntries.map(e => e.erpNo.trim().toLowerCase()))
        : null;

    for (const m of erpMasterList) {
      if (selectedBuyer !== 'ALL' && m.buyer.toLowerCase() !== selectedBuyer.toLowerCase()) continue;
      const erpKey = m.erpNo.toLowerCase();
      if (filteredErps && !filteredErps.has(erpKey)) continue;
      if (!seen.has(erpKey)) {
        seen.add(erpKey);
        sum += m.recvQty;
      }
    }
    return sum;
  }, [erpMasterList, selectedBuyer, filteredEntries, dateFrom, dateTo, typeFilter, searchQuery]);

  // Live Entry Telemetry calculations
  const draftTtl = useMemo(() => {
    return draftSizeFields.reduce((sum, sz) => sum + (Number(draftSizes[sz]) || 0), 0);
  }, [draftSizeFields, draftSizes]);

  const draftAutoRecv = useMemo(() => {
    const key = draftMeta.erpNo.trim().toLowerCase();
    if (!key) return 0;
    return recvByErpLookup.get(key) || 0;
  }, [draftMeta.erpNo, recvByErpLookup]);

  const effectiveDraftRecv = draftAutoRecv > 0 ? draftAutoRecv : Number(draftManualRecv) || 0;
  const draftEntryPct = effectiveDraftRecv > 0 ? (draftTtl / effectiveDraftRecv) * 100 : 0;

  const ratioCheckSum =
    (Number(sizeRatios.XS) || 0) +
    (Number(sizeRatios.S) || 0) +
    (Number(sizeRatios.M) || 0) +
    (Number(sizeRatios.L) || 0) +
    (Number(sizeRatios.XL) || 0) +
    (Number(sizeRatios.XXL) || 0);

  const handleSelectErpForDraft = (erpNo: string) => {
    const found = erpMasterList.find(m => m.erpNo.toLowerCase() === erpNo.trim().toLowerCase());
    setConfirmOverRecv(false);
    setDraftManualRecv('');
    setDraftMeta(prev => ({
      ...prev,
      erpNo,
      buyer: found ? found.buyer : prev.buyer,
      colour: found && found.colour ? found.colour : prev.colour
    }));
  };

  const handleAddRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const cleanErp = draftMeta.erpNo.trim();
    if (!cleanErp) {
      toast.error('Please enter or select ERP / File / Job No');
      return;
    }
    if (draftTtl <= 0) {
      toast.error('Enter at least 1 garment rejection quantity');
      firstSizeInputRef.current?.focus();
      return;
    }
    if (effectiveDraftRecv > 0 && draftTtl > effectiveDraftRecv && !confirmOverRecv) {
      setConfirmOverRecv(true);
      return;
    }

    setSaving(true);
    try {
      // Build both standard xs..xxl/noSize AND customSizes map cleanly
      let xs = 0,
        s = 0,
        m = 0,
        l = 0,
        xl = 0,
        xxl = 0,
        noSize = 0;
      const customSizes: Record<string, number> = {};
      for (const sz of draftSizeFields) {
        const val = Math.max(0, Number(draftSizes[sz]) || 0);
        if (val <= 0) continue;
        customSizes[sz] = val;
        const norm = sz.toLowerCase().replace(/\s+/g, '');
        if (norm === 'xs') xs = val;
        else if (norm === 's') s = val;
        else if (norm === 'm') m = val;
        else if (norm === 'l') l = val;
        else if (norm === 'xl') xl = val;
        else if (norm === 'xxl') xxl = val;
        else if (norm === 'nosize') noSize = val;
      }

      const normalizedBuyer = draftMeta.buyer.trim() || 'Unknown';
      const normalizedRemarks = normalizeDefectLabel(draftMeta.remarks);

      // If user supplied a manual Recv Qty inline for an unlinked ERP, persist override alongside saving the row
      if (draftAutoRecv === 0 && Number(draftManualRecv) > 0) {
        const manualVal = Number(draftManualRecv);
        const updatedOverrides = { ...recvOverrides, [cleanErp]: manualVal };
        const updatedCustoms = [
          ...customErpMasters.filter(c => c.erpNo.toLowerCase() !== cleanErp.toLowerCase()),
          {
            erpNo: cleanErp,
            buyer: normalizedBuyer,
            colour: draftMeta.colour.trim(),
            recvQty: manualVal
          }
        ];
        setRecvOverrides(updatedOverrides);
        setCustomErpMasters(updatedCustoms);
        await api
          .saveWashRejectionConfig({
            sizeRatios,
            recvOverrides: updatedOverrides,
            customErpMasters: updatedCustoms,
            buyerSizeLists
          })
          .catch(() => null);
      }

      const saved = await api.saveWashRejection({
        ...draftMeta,
        buyer: normalizedBuyer,
        erpNo: cleanErp,
        remarks: normalizedRemarks,
        xs,
        s,
        m,
        l,
        xl,
        xxl,
        noSize,
        customSizes
      });

      setEntries(prev => [...prev, saved]);
      // Sticky metadata for fast sequential size rows; reset size counts & guardrail
      setDraftSizes({});
      setDraftManualRecv('');
      setConfirmOverRecv(false);
      toast.success(`Saved ${draftTtl} pcs rejection for ${saved.buyer} (${saved.erpNo})`);
      setTimeout(() => firstSizeInputRef.current?.focus(), 0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save rejection');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!canEdit) return;
    try {
      await api.deleteWashRejection(id);
      setEntries(prev => prev.filter(r => r.id !== id));
      setConfirmDeleteId(null);
      toast.success('Rejection entry deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete');
    }
  };

  const handleSaveConfig = async (
    nextOverrides?: Record<string, number>,
    nextCustoms?: CustomErpMaster[],
    nextBuyerSizes?: Record<string, string[]>
  ) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.saveWashRejectionConfig({
        sizeRatios,
        recvOverrides: nextOverrides ?? recvOverrides,
        customErpMasters: nextCustoms ?? customErpMasters,
        buyerSizeLists: nextBuyerSizes ?? buyerSizeLists
      });
      toast.success('Master configuration saved');
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBuyerSizeList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const cleanBuyer = sizeCfgBuyer.trim();
    const parsed = parseSizeListText(sizeCfgText);
    if (!cleanBuyer || parsed.length === 0) {
      toast.error('Enter a Buyer name and at least one size label');
      return;
    }
    // Preserve exact casing or overwrite matching buyer case-insensitively
    const nextMap: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(buyerSizeLists) as [string, string[]][]) {
      if (k.trim().toLowerCase() !== cleanBuyer.toLowerCase()) {
        nextMap[k] = Array.isArray(v) ? v : [];
      }
    }
    nextMap[cleanBuyer] = parsed;
    setBuyerSizeLists(nextMap);
    await handleSaveConfig(undefined, undefined, nextMap);
    toast.success(`Saved ${parsed.length} size columns for ${cleanBuyer}`);
  };

  const handleResetBuyerSizeList = async (buyerName: string) => {
    if (!canEdit) return;
    const nextMap: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(buyerSizeLists) as [string, string[]][]) {
      if (k.trim().toLowerCase() !== buyerName.trim().toLowerCase()) {
        nextMap[k] = Array.isArray(v) ? v : [];
      }
    }
    setBuyerSizeLists(nextMap);
    if (sizeCfgBuyer.trim().toLowerCase() === buyerName.trim().toLowerCase()) {
      setSizeCfgText(DEFAULT_SIZE_LIST.join(', '));
    }
    await handleSaveConfig(undefined, undefined, nextMap);
    toast.success(`Reset ${buyerName} to default XS–XXL sizes`);
  };

  const handleAddCustomMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newMaster.erpNo.trim() || !newMaster.buyer.trim()) {
      toast.error('Buyer and ERP / File No are required');
      return;
    }
    const updatedCustoms = [
      ...customErpMasters.filter(c => c.erpNo.toLowerCase() !== newMaster.erpNo.trim().toLowerCase()),
      {
        erpNo: newMaster.erpNo.trim(),
        buyer: newMaster.buyer.trim(),
        colour: newMaster.colour.trim(),
        recvQty: Number(newMaster.recvQty) || 0
      }
    ];
    const updatedOverrides = {
      ...recvOverrides,
      [newMaster.erpNo.trim()]: Number(newMaster.recvQty) || 0
    };
    setCustomErpMasters(updatedCustoms);
    setRecvOverrides(updatedOverrides);
    await handleSaveConfig(updatedOverrides, updatedCustoms);
    setNewMaster({ erpNo: '', buyer: '', colour: '', recvQty: 0 });
  };

  // Export Multi-Sheet Excel: preserves 3 core sheets + adds Stage Summary & Defect Pareto sheets
  const handleExportWorkbook = () => {
    const wb = XLSX.utils.book_new();
    const titlePrefix = selectedBuyer === 'ALL' ? 'ALL BUYERS' : selectedBuyer.toUpperCase();
    const exportSizeCols = activeTableSizeColumns;

    // Sheet 1: Rejection_Size List
    const s1Aoa: (string | number)[][] = [
      [`${titlePrefix} WASH REJECTION REPORT`, '', '', '', 'Size List', ...exportSizeCols.map(() => '')],
      ['Size list (edit here):', 'Grand Total Qty', 'Check:', ...exportSizeCols, '', ''],
      [
        'Ratio (reference):',
        '',
        '',
        ...exportSizeCols.map(sz => sizeRatios[sz] ?? 0),
        ratioCheckSum,
        ''
      ],
      [],
      ['Buyer', 'ERP/File/Job', 'Colour', 'Country', 'R.Date', ...exportSizeCols, 'TTL', 'Rejection Type', 'Remarks']
    ];
    for (const r of filteredEntries) {
      s1Aoa.push([
        r.buyer,
        r.erpNo,
        r.colour,
        r.country,
        r.rDate,
        ...exportSizeCols.map(sz => getEntrySizeQty(r, sz)),
        r.ttl,
        r.rejectionType,
        normalizeDefectLabel(r.remarks)
      ]);
    }
    s1Aoa.push([
      'TOTAL',
      '',
      '',
      '',
      '',
      ...exportSizeCols.map(sz => sizeColumnTotals[sz] || 0),
      totals.ttl,
      '',
      ''
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet(s1Aoa);
    XLSX.utils.book_append_sheet(wb, ws1, 'Rejection_Size List');

    // Sheet 2: Rejection DB
    const s2Aoa: (string | number)[][] = [
      ['Buyer', 'ERP', 'Colour', 'Country', 'Date', ...exportSizeCols, 'TTL', 'Rejection Type', 'Percentage Upto', 'Recv Qty']
    ];
    for (const g of groupedRejectionDb) {
      for (const r of g.rows) {
        s2Aoa.push([
          r.buyer,
          r.erpNo,
          r.colour,
          r.country,
          r.rDate,
          ...exportSizeCols.map(sz => getEntrySizeQty(r, sz)),
          r.ttl,
          r.rejectionType,
          '',
          ''
        ]);
      }
      s2Aoa.push([
        g.buyer,
        g.erpNo,
        g.colour,
        'GROUP TOTAL',
        '',
        ...exportSizeCols.map(() => ''),
        g.groupTtl,
        g.rejectionType,
        g.recvQty > 0 ? g.pctUpto / 100 : 0,
        g.recvQty
      ]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(s2Aoa);
    const pctColIdx = 5 + exportSizeCols.length + 2;
    const pctColLetter = XLSX.utils.encode_col(pctColIdx);
    for (let rIdx = 2; rIdx <= s2Aoa.length; rIdx++) {
      const cell = ws2[`${pctColLetter}${rIdx}`] as { t?: string; z?: string; v?: unknown } | undefined;
      if (cell && typeof cell.v === 'number') cell.z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, ws2, 'Rejection DB');

    // Sheet 3: ERP Recv Qty
    const s3Aoa: (string | number)[][] = [
      ['ERP MASTER (All Buyers Live ERP + Recv Qty)'],
      [],
      ['Buyer', 'ERP / File / Job (auto)', 'Colour', 'Recv Qty (pcs)', 'Type (auto)', 'Before Wash Rej', 'After Wash Rej', 'Total Rej %']
    ];
    for (const m of erpMasterList) {
      if (selectedBuyer !== 'ALL' && m.buyer.toLowerCase() !== selectedBuyer.toLowerCase()) continue;
      const erpRejs = filteredEntries.filter(e => e.erpNo.toLowerCase() === m.erpNo.toLowerCase());
      const bef = erpRejs.filter(e => !/after/i.test(e.rejectionType)).reduce((s, r) => s + r.ttl, 0);
      const aft = erpRejs.filter(e => /after/i.test(e.rejectionType)).reduce((s, r) => s + r.ttl, 0);
      const totRatio = m.recvQty > 0 ? (bef + aft) / m.recvQty : 0;
      s3Aoa.push([m.buyer, m.erpNo, m.colour, m.recvQty, m.type, bef, aft, totRatio]);
    }
    const ws3 = XLSX.utils.aoa_to_sheet(s3Aoa);
    for (let rIdx = 4; rIdx <= s3Aoa.length; rIdx++) {
      const cell = ws3[`H${rIdx}`] as { z?: string; v?: unknown } | undefined;
      if (cell && typeof cell.v === 'number') cell.z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, ws3, 'ERP Recv Qty');

    // Sheet 4: ERP_Colour_Summary (Combined Before + After Stage Summary)
    const s4Data = erpColourStageSummary.map(s => ({
      Buyer: s.buyer,
      'ERP/File/Job': s.erpNo,
      Colour: s.colour || '—',
      'Recv Qty': s.recvQty,
      'Before Wash': s.before,
      'Before %': s.beforePct / 100,
      'After Wash': s.after,
      'After %': s.afterPct / 100,
      'Total Rejection': s.total,
      'Total %': s.totalPct / 100
    }));
    const ws4 = XLSX.utils.json_to_sheet(s4Data);
    for (const ref of Object.keys(ws4)) {
      const cell = ws4[ref] as { z?: string } | undefined;
      const match = ref.match(/^([FHJ])(\d+)$/);
      if (cell && match && Number(match[2]) > 1) cell.z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, ws4, 'ERP_Colour_Summary');

    // Sheet 5: Defects (Pareto)
    const ws5 = XLSX.utils.json_to_sheet(
      defectPareto.map(d => ({
        Defect: d.defect,
        Qty: d.qty,
        'Share %': d.sharePct / 100
      }))
    );
    for (const ref of Object.keys(ws5)) {
      const cell = ws5[ref] as { z?: string } | undefined;
      const match = ref.match(/^C(\d+)$/);
      if (cell && match && Number(match[1]) > 1) cell.z = '0.00%';
    }
    XLSX.utils.book_append_sheet(wb, ws5, 'Defects');

    const dateStr = getDhakaTodayIso();
    XLSX.writeFile(wb, `${titlePrefix.replace(/\s+/g, '_')}_Wash_Rejection_Report_${dateStr}.xlsx`);
    toast.success('Exported Multi-Sheet Rejection Workbook (.xlsx)');
  };

  // Import existing Excel Rejection sheet directly into multi-buyer DB (supports dynamic custom size columns & Excel date serials)
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canEdit) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let hdrIdx = rows.findIndex(
        r => Array.isArray(r) && r.some(c => /erp|file|job/i.test(String(c))) && r.some(c => /xs|ttl|rejection|total/i.test(String(c)))
      );
      if (hdrIdx === -1) hdrIdx = 0;

      const rawHeaders = (rows[hdrIdx] || []).map(h => String(h || '').trim());
      const hdr = rawHeaders.map(h => h.toLowerCase());
      const col = (patterns: string[]) => hdr.findIndex(h => patterns.some(p => h === p || h.includes(p)));

      const iBuyer = col(['buyer']);
      const iErp = col(['erp', 'file', 'job']);
      const iCol = col(['colour', 'color']);
      const iCtry = col(['country']);
      const iDate = col(['r.date', 'date']);
      const iType = col(['rejection type', 'stage', 'type']);
      const iRem = col(['remarks', 'remark', 'defect']);
      const iTtl = col(['ttl', 'total']);

      const nonSizeCols = new Set(
        [iBuyer, iErp, iCol, iCtry, iDate, iType, iRem, iTtl].filter(idx => idx !== -1)
      );
      // Detect every size column between metadata and TTL/Type/Remarks
      const sizeCols: { index: number; label: string }[] = [];
      for (let idx = 0; idx < rawHeaders.length; idx++) {
        if (nonSizeCols.has(idx)) continue;
        const label = rawHeaders[idx];
        const low = label.toLowerCase();
        if (!label || /percentage|recv/i.test(low)) continue;
        sizeCols.push({ index: idx, label });
      }

      const parsed: any[] = [];
      for (const r of rows.slice(hdrIdx + 1)) {
        const erpNo = iErp !== -1 ? String(r[iErp] || '').trim() : '';
        if (!erpNo || /^total$/i.test(erpNo) || /group total/i.test(erpNo)) continue;

        let xs = 0,
          s = 0,
          m = 0,
          l = 0,
          xl = 0,
          xxl = 0,
          noSize = 0;
        const customSizes: Record<string, number> = {};
        let sizeSum = 0;

        for (const sc of sizeCols) {
          const val = Math.max(0, Number(String(r[sc.index] || '').replace(/[^\d.-]/g, '')) || 0);
          if (val <= 0) continue;
          customSizes[sc.label] = val;
          sizeSum += val;
          const norm = sc.label.toLowerCase().replace(/\s+/g, '');
          if (norm === 'xs') xs = val;
          else if (norm === 's') s = val;
          else if (norm === 'm') m = val;
          else if (norm === 'l') l = val;
          else if (norm === 'xl') xl = val;
          else if (norm === 'xxl') xxl = val;
          else if (norm === 'nosize') noSize = val;
        }

        if (sizeSum === 0) continue;

        const masterMatch = erpMasterList.find(mItem => mItem.erpNo.toLowerCase() === erpNo.toLowerCase());
        const buyer =
          (iBuyer !== -1 && String(r[iBuyer] || '').trim()) || masterMatch?.buyer || importDefaultBuyer || 'H&M';

        parsed.push({
          buyer,
          erpNo,
          colour: iCol !== -1 ? String(r[iCol] || '').trim() : masterMatch?.colour || '',
          country: iCtry !== -1 ? String(r[iCtry] || '').trim() : '',
          rDate: iDate !== -1 ? normalizeExcelDateValue(r[iDate]) : getDhakaTodayIso(),
          xs,
          s,
          m,
          l,
          xl,
          xxl,
          noSize,
          customSizes,
          rejectionType:
            iType !== -1 && String(r[iType] || '').trim() ? String(r[iType]).trim() : 'Before Wash Rejections',
          remarks: normalizeDefectLabel(iRem !== -1 ? String(r[iRem] || '') : '')
        });
      }

      if (parsed.length === 0) {
        toast.error('No valid rejection rows detected in Excel file');
        return;
      }

      const res = await api.saveWashRejectionBatch(parsed);
      setEntries(prev => [...prev, ...(res.entries || [])]);
      toast.success(`Imported ${parsed.length} rejection rows cleanly!`);
    } catch (err: any) {
      toast.error(err?.message || 'Excel import failed');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {selectedBuyer === 'ALL' ? 'ALL BUYERS' : selectedBuyer.toUpperCase()} WASH REJECTION REPORT
              </h2>
              <p className="text-xs text-slate-500">
                Multi-Buyer Before Wash &amp; After Wash Quality Tracking • Custom Buyer Size Lists, Grouped Rejection DB (%), Defect Pareto &amp; ERP Recv Qty Master
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <label className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer">
              <Upload size={14} />
              <span>Import Excel</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
            </label>
          )}
          <button
            type="button"
            onClick={handleExportWorkbook}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download size={14} />
            <span>Export Multi-Sheet .xlsx</span>
          </button>
        </div>
      </div>

      {/* Buyer Filter Bar + Date Range + KPIs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
              <Filter size={12} /> Buyer:
            </span>
            <button
              type="button"
              onClick={() => setSelectedBuyer('ALL')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer',
                selectedBuyer === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              )}
            >
              All Buyers ({allBuyers.length})
            </button>
            {allBuyers.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setSelectedBuyer(b);
                  setImportDefaultBuyer(b);
                }}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer',
                  selectedBuyer === b
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                )}
              >
                {b}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ERP, Colour, Remarks..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs">
              <Calendar size={13} className="text-slate-400" />
              <input
                type="date"
                aria-label="From date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-transparent text-xs font-mono focus:outline-none"
                title="From Date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                aria-label="To date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="bg-transparent text-xs font-mono focus:outline-none"
                title="To Date"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Rejection Types</option>
              {REJECTION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {(dateFrom || dateTo || searchQuery || typeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                  setTypeFilter('ALL');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Clear active filters"
              >
                <RotateCcw size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Rejections</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{formatNumber(totals.ttl)} pcs</p>
          </div>
          <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-200">
            <p className="text-[10px] font-bold uppercase text-amber-700">Before Wash Rej</p>
            <p className="text-xl font-black text-amber-900 mt-0.5">
              {formatNumber(totals.before)} pcs{' '}
              <span className="text-xs font-bold">
                ({totalCoveredRecvQty > 0 ? ((totals.before / totalCoveredRecvQty) * 100).toFixed(2) : '0.00'}%)
              </span>
            </p>
          </div>
          <div className="bg-rose-50/70 rounded-xl p-3 border border-rose-200">
            <p className="text-[10px] font-bold uppercase text-rose-700">After Wash Rej</p>
            <p className="text-xl font-black text-rose-900 mt-0.5">
              {formatNumber(totals.after)} pcs{' '}
              <span className="text-xs font-bold">
                ({totalCoveredRecvQty > 0 ? ((totals.after / totalCoveredRecvQty) * 100).toFixed(2) : '0.00'}%)
              </span>
            </p>
          </div>
          <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-200">
            <p className="text-[10px] font-bold uppercase text-blue-700">ERP Recv Qty</p>
            <p className="text-xl font-black text-blue-900 mt-0.5">{formatNumber(totalCoveredRecvQty)} pcs</p>
          </div>
          <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Overall Rejection %</p>
            <p
              className={cn(
                'text-xl font-black mt-0.5',
                totalCoveredRecvQty > 0 && (totals.ttl / totalCoveredRecvQty) * 100 >= 1
                  ? 'text-rose-700'
                  : 'text-emerald-900'
              )}
            >
              {totalCoveredRecvQty > 0 ? ((totals.ttl / totalCoveredRecvQty) * 100).toFixed(2) : '0.00'}%
            </p>
          </div>
        </div>
      </div>

      {/* Excel-Style Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('size_list')}
          className={cn(
            'px-4 py-2 rounded-t-xl text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
            activeTab === 'size_list'
              ? 'bg-white text-slate-900 border-emerald-600 shadow-xs'
              : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
          )}
        >
          <FileSpreadsheet size={14} className="text-emerald-600" />
          <span>Rejection_Size List</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rejection_db')}
          className={cn(
            'px-4 py-2 rounded-t-xl text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
            activeTab === 'rejection_db'
              ? 'bg-yellow-300 text-slate-900 border-yellow-600 shadow-xs'
              : 'bg-yellow-100 text-slate-700 border-transparent hover:bg-yellow-200'
          )}
        >
          <Database size={14} className="text-amber-800" />
          <span>Rejection DB &amp; Pareto (%)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('erp_recv')}
          className={cn(
            'px-4 py-2 rounded-t-xl text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
            activeTab === 'erp_recv'
              ? 'bg-rose-700 text-white border-rose-900 shadow-xs'
              : 'bg-rose-100 text-rose-900 border-transparent hover:bg-rose-200'
          )}
        >
          <CheckCircle2 size={14} />
          <span>ERP Recv Qty (Master)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('buyer_sizes')}
          className={cn(
            'px-4 py-2 rounded-t-xl text-xs font-black border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer',
            activeTab === 'buyer_sizes'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200'
          )}
        >
          <Ruler size={14} />
          <span>Buyer Size Lists ({Object.keys(buyerSizeLists).length})</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm font-bold text-slate-400">
          Loading multi-buyer rejection sheets...
        </div>
      ) : activeTab === 'size_list' ? (
        <div className="space-y-4">
          {/* Yellow Size List Ratio Reference Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-yellow-300 px-4 py-2 border-b border-yellow-400 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Size List &amp; Reference Ratio (Check Sum: {ratioCheckSum})
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleSaveConfig()}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Save size={12} /> Save Ratio
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead className="bg-yellow-200 font-black text-slate-900 border-b border-slate-300">
                  <tr>
                    <th className="p-2 text-left border-r border-slate-300 w-44">Size List Header</th>
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'No Size'].map(sz => (
                      <th key={sz} className="p-2 border-r border-slate-300">{sz}</th>
                    ))}
                    <th className="p-2">Ratio Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white font-mono">
                    <td className="p-2 text-left font-bold text-slate-600 border-r border-slate-200">Ratio % (Reference)</td>
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'No Size'].map(sz => (
                      <td key={sz} className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={!canEdit}
                          value={sizeRatios[sz] ?? 0}
                          onChange={e => setSizeRatios(prev => ({ ...prev, [sz]: Number(e.target.value) || 0 }))}
                          className="w-14 text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold"
                        />
                      </td>
                    ))}
                    <td className={cn('p-2 font-black', ratioCheckSum === 100 ? 'text-emerald-700' : 'text-amber-700')}>
                      {ratioCheckSum}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Inline Add Entry Form */}
          {canEdit && (
            <form onSubmit={handleAddRejection} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Plus size={14} className="text-blue-600" /> Log New Rejection Row
                  <span className="text-[11px] font-semibold text-slate-400 normal-case">
                    (Buyer, ERP &amp; defect stay sticky for rapid entry • Using {draftMeta.buyer || 'Default'} size list)
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">ERP / File / Job *</label>
                  <input
                    list="erp-master-options"
                    required
                    value={draftMeta.erpNo}
                    onChange={e => handleSelectErpForDraft(e.target.value)}
                    placeholder="e.g. 111-8663"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                  />
                  <datalist id="erp-master-options">
                    {erpMasterList.map(m => (
                      <option key={m.erpNo} value={m.erpNo}>{`${m.buyer} • ${m.colour} (${m.recvQty} pcs)`}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Buyer *</label>
                  <input
                    list="buyer-options"
                    required
                    value={draftMeta.buyer}
                    onChange={e => setDraftMeta(p => ({ ...p, buyer: e.target.value }))}
                    placeholder="H&M, NEXT, Zara..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                  />
                  <datalist id="buyer-options">
                    {allBuyers.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Colour</label>
                  <input
                    type="text"
                    value={draftMeta.colour}
                    onChange={e => setDraftMeta(p => ({ ...p, colour: e.target.value }))}
                    placeholder="51-122 / Black"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Country</label>
                  <input
                    list="country-options"
                    type="text"
                    value={draftMeta.country}
                    onChange={e => setDraftMeta(p => ({ ...p, country: e.target.value }))}
                    placeholder="US / Normal / Asia"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                  <datalist id="country-options">
                    {COMMON_COUNTRIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">R.Date</label>
                  <input
                    type="date"
                    value={draftMeta.rDate}
                    onChange={e => setDraftMeta(p => ({ ...p, rDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Rejection Type</label>
                  <select
                    value={draftMeta.rejectionType}
                    onChange={e => setDraftMeta(p => ({ ...p, rejectionType: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-semibold"
                  >
                    {REJECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 text-xs">
                {draftSizeFields.map((szLabel, idx) => (
                  <div key={szLabel} className="w-16">
                    <label className="block text-[10px] font-bold uppercase text-amber-800 bg-yellow-200 px-1 py-0.5 rounded-t text-center truncate">
                      {szLabel}
                    </label>
                    <input
                      ref={idx === 0 ? firstSizeInputRef : undefined}
                      type="number"
                      min={0}
                      value={draftSizes[szLabel] || ''}
                      placeholder="0"
                      onChange={e => {
                        setConfirmOverRecv(false);
                        setDraftSizes(p => ({ ...p, [szLabel]: Math.max(0, Number(e.target.value) || 0) }));
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-b px-1.5 py-1.5 text-center font-mono font-bold"
                    />
                  </div>
                ))}

                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Remarks (Defect)</label>
                  <input
                    list="defect-remark-options"
                    value={draftMeta.remarks}
                    onChange={e => setDraftMeta(p => ({ ...p, remarks: e.target.value }))}
                    placeholder="Shade Reject / Body Hole..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-rose-700 font-semibold"
                  />
                  <datalist id="defect-remark-options">
                    {COMMON_DEFECT_REMARKS.map(rem => <option key={rem} value={rem} />)}
                  </datalist>
                </div>

                {/* Live Telemetry Pill Strip: TTL + Auto/Manual Recv Qty + This Entry % */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <div>
                    <div className="text-[9px] font-bold uppercase text-slate-400">Entry TTL</div>
                    <div className="text-sm font-black font-mono text-slate-900">{formatNumber(draftTtl)}</div>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <div className="text-[9px] font-bold uppercase text-slate-400">
                      Recv Qty {draftAutoRecv > 0 ? '(Auto)' : '(Manual)'}
                    </div>
                    {draftAutoRecv > 0 ? (
                      <div className="text-sm font-black font-mono text-blue-700">{formatNumber(draftAutoRecv)}</div>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        value={draftManualRecv}
                        onChange={e => {
                          setConfirmOverRecv(false);
                          setDraftManualRecv(e.target.value);
                        }}
                        placeholder="Set Recv"
                        className="w-20 bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-blue-700"
                      />
                    )}
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <div className="text-[9px] font-bold uppercase text-slate-400">This Entry %</div>
                    <div
                      className={cn(
                        'text-sm font-black font-mono',
                        draftEntryPct >= 1 ? 'text-rose-700' : 'text-emerald-700'
                      )}
                    >
                      {effectiveDraftRecv > 0 ? `${draftEntryPct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className={cn(
                    'font-bold py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white',
                    confirmOverRecv
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300'
                  )}
                >
                  <Plus size={14} />
                  <span>{confirmOverRecv ? 'Confirm & Save (>Recv)' : 'Add Row'}</span>
                </button>
              </div>

              {confirmOverRecv && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
                  <span>
                    Rejection qty ({formatNumber(draftTtl)} pcs) is higher than ERP Recv Qty ({formatNumber(effectiveDraftRecv)} pcs). Click &ldquo;Confirm &amp; Save&rdquo; if intentional.
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmOverRecv(false)}
                    className="text-rose-700 underline font-bold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Main Size List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-900 text-white font-bold">
                  <tr>
                    <th className="p-2.5 border-r border-slate-700">Buyer</th>
                    <th className="p-2.5 border-r border-slate-700">ERP/File/Job</th>
                    <th className="p-2.5 border-r border-slate-700">Colour</th>
                    <th className="p-2.5 border-r border-slate-700">Country</th>
                    <th className="p-2.5 border-r border-slate-700">R.Date</th>
                    {activeTableSizeColumns.map(sz => (
                      <th key={sz} className="p-2.5 bg-yellow-300 text-slate-900 text-center border-r border-yellow-400">
                        {sz}
                      </th>
                    ))}
                    <th className="p-2.5 bg-yellow-400 text-slate-900 text-center border-r border-yellow-500">TTL</th>
                    <th className="p-2.5 border-r border-slate-700">Rejection Type</th>
                    <th className="p-2.5 border-r border-slate-700">Remarks</th>
                    {canEdit && <th className="p-2.5 text-center">Del</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={activeTableSizeColumns.length + (canEdit ? 9 : 8)} className="p-8 text-center text-slate-400 font-semibold">
                        No rejection records match the active filters. Add rows above or import an Excel sheet.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map(r => {
                      const extraTags = selectedBuyer === 'ALL' ? getExtraCustomSizeTags(r) : [];
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-blue-700 whitespace-nowrap">{r.buyer}</td>
                          <td className="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">{r.erpNo}</td>
                          <td className="p-2 font-mono whitespace-nowrap">{r.colour || '—'}</td>
                          <td className="p-2 whitespace-nowrap">{r.country || '—'}</td>
                          <td className="p-2 font-mono whitespace-nowrap">{r.rDate}</td>
                          {activeTableSizeColumns.map(sz => {
                            const val = getEntrySizeQty(r, sz);
                            return (
                              <td key={sz} className="p-2 text-center font-mono">
                                {val > 0 ? val : '-'}
                              </td>
                            );
                          })}
                          <td className="p-2 text-center font-mono font-black bg-yellow-50 text-slate-900">
                            {r.ttl}
                            {extraTags.length > 0 && (
                              <div className="text-[10px] font-normal text-slate-500">{extraTags.join(' ')}</div>
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-bold',
                                /after/i.test(r.rejectionType)
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              )}
                            >
                              {r.rejectionType}
                            </span>
                          </td>
                          <td className="p-2 text-rose-700 font-semibold whitespace-nowrap">
                            {normalizeDefectLabel(r.remarks) || '—'}
                          </td>
                          {canEdit && (
                            <td className="p-2 text-center whitespace-nowrap">
                              {confirmDeleteId === r.id ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEntry(r.id)}
                                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(r.id)}
                                  className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Delete row"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400 font-mono">
                  <tr>
                    <td colSpan={5} className="p-2.5 text-left font-sans">TOTAL ({filteredEntries.length} rows)</td>
                    {activeTableSizeColumns.map(sz => (
                      <td key={sz} className="p-2.5 text-center">{sizeColumnTotals[sz] || 0}</td>
                    ))}
                    <td className="p-2.5 text-center bg-yellow-300 text-slate-900">{totals.ttl}</td>
                    <td colSpan={canEdit ? 3 : 2} className="p-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'rejection_db' ? (
        /* TAB 2: Rejection DB + Combined ERP/Colour Stage Summary + Defect Pareto */
        <div className="space-y-4">
          {/* Combined ERP / Colour Stage Summary + Defect Pareto */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider">
                  Combined ERP / Colour Summary (Before vs After Wash)
                </span>
                <span className="text-[11px] font-bold text-rose-300">Alert Highlight: ≥ 1.00%</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Buyer</th>
                      <th className="p-2.5">ERP / Colour</th>
                      <th className="p-2.5 text-right">Recv</th>
                      <th className="p-2.5 text-right">Before Wash</th>
                      <th className="p-2.5 text-right">After Wash</th>
                      <th className="p-2.5 text-right">TTL</th>
                      <th className="p-2.5 text-right">TTL %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {erpColourStageSummary.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                          No ERP / Colour summary data for current filters.
                        </td>
                      </tr>
                    ) : (
                      erpColourStageSummary.map(s => (
                        <tr key={s.key} className={cn('hover:bg-slate-50', s.totalPct >= 1 ? 'bg-rose-50/40' : '')}>
                          <td className="p-2 font-bold text-blue-700">{s.buyer}</td>
                          <td className="p-2 font-mono font-bold text-slate-900">
                            {s.erpNo} <span className="font-normal text-slate-500">· {s.colour || '—'}</span>
                          </td>
                          <td className="p-2 text-right font-mono">{s.recvQty ? formatNumber(s.recvQty) : '—'}</td>
                          <td className="p-2 text-right font-mono">
                            {formatNumber(s.before)}
                            {s.recvQty > 0 && <span className="text-slate-400"> · {s.beforePct.toFixed(2)}%</span>}
                          </td>
                          <td className="p-2 text-right font-mono">
                            {formatNumber(s.after)}
                            {s.recvQty > 0 && <span className="text-slate-400"> · {s.afterPct.toFixed(2)}%</span>}
                          </td>
                          <td className="p-2 text-right font-mono font-black">{formatNumber(s.total)}</td>
                          <td
                            className={cn(
                              'p-2 text-right font-mono font-black',
                              s.totalPct >= 1 ? 'text-rose-700' : 'text-emerald-700'
                            )}
                          >
                            {s.recvQty > 0 ? `${s.totalPct.toFixed(2)}%` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {erpColourStageSummary.length > 0 && (
                    <tfoot className="bg-slate-100 font-black border-t-2 border-slate-300 font-mono">
                      <tr>
                        <td colSpan={2} className="p-2 font-sans">Grand Total</td>
                        <td className="p-2 text-right">{formatNumber(totalCoveredRecvQty)}</td>
                        <td className="p-2 text-right">{formatNumber(totals.before)}</td>
                        <td className="p-2 text-right">{formatNumber(totals.after)}</td>
                        <td className="p-2 text-right">{formatNumber(totals.ttl)}</td>
                        <td
                          className={cn(
                            'p-2 text-right',
                            totalCoveredRecvQty > 0 && (totals.ttl / totalCoveredRecvQty) * 100 >= 1
                              ? 'text-rose-700'
                              : 'text-emerald-700'
                          )}
                        >
                          {totalCoveredRecvQty > 0 ? `${((totals.ttl / totalCoveredRecvQty) * 100).toFixed(2)}%` : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-rose-600" /> Defect-Wise Pareto Breakdown
                </h3>
                <span className="text-[11px] font-bold text-slate-400">Auto-normalized labels</span>
              </div>
              {defectPareto.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">No defects recorded.</p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {defectPareto.map(d => (
                    <div key={d.defect} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 truncate pr-2">{d.defect}</span>
                        <span className="font-mono font-bold text-slate-700 shrink-0">
                          {formatNumber(d.qty)} pcs · {d.sharePct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-rose-600 rounded-full"
                          style={{ width: `${Math.min(100, d.sharePct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grouped Rejection DB Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-yellow-300 text-slate-900 font-black border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 border-r border-slate-300">Buyer</th>
                    <th className="p-2.5 border-r border-slate-300">ERP</th>
                    <th className="p-2.5 border-r border-slate-300">Colour</th>
                    <th className="p-2.5 border-r border-slate-300">Country</th>
                    <th className="p-2.5 border-r border-slate-300">Date</th>
                    {activeTableSizeColumns.map(sz => (
                      <th key={sz} className="p-2.5 text-center border-r border-slate-300">{sz}</th>
                    ))}
                    <th className="p-2.5 text-center border-r border-slate-300">TTL</th>
                    <th className="p-2.5 border-r border-slate-300">Rejection Type</th>
                    <th className="p-2.5 border-r border-slate-300 bg-amber-100">Percentage Upto</th>
                    <th className="p-2.5 text-right bg-blue-100">Recv Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groupedRejectionDb.length === 0 ? (
                    <tr>
                      <td colSpan={activeTableSizeColumns.length + 9} className="p-8 text-center text-slate-400 font-semibold">
                        No rejection groups to summarize yet.
                      </td>
                    </tr>
                  ) : (
                    groupedRejectionDb.map((g, gIdx) => {
                      const bgBands = ['bg-amber-50/40', 'bg-blue-50/40', 'bg-emerald-50/40', 'bg-rose-50/40'];
                      const bandClass = bgBands[gIdx % bgBands.length];
                      return (
                        <React.Fragment key={g.key}>
                          {g.rows.map(r => (
                            <tr key={r.id} className={cn(bandClass, 'hover:bg-slate-100/70')}>
                              <td className="p-2 font-bold text-blue-700 whitespace-nowrap">{r.buyer}</td>
                              <td className="p-2 font-mono font-bold whitespace-nowrap">{r.erpNo}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{r.colour || '—'}</td>
                              <td className="p-2 whitespace-nowrap">{r.country || '—'}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{r.rDate}</td>
                              {activeTableSizeColumns.map(sz => {
                                const val = getEntrySizeQty(r, sz);
                                return (
                                  <td key={sz} className="p-2 text-center font-mono">
                                    {val > 0 ? val : '-'}
                                  </td>
                                );
                              })}
                              <td className="p-2 text-center font-mono font-bold">{r.ttl}</td>
                              <td className="p-2 whitespace-nowrap">{r.rejectionType}</td>
                              <td className="p-2" />
                              <td className="p-2" />
                            </tr>
                          ))}
                          <tr className="bg-slate-100/90 font-black border-t border-b-2 border-slate-400">
                            <td
                              colSpan={5 + activeTableSizeColumns.length}
                              className="p-2 text-right text-slate-600 uppercase text-[10px] tracking-wider"
                            >
                              {g.buyer} • {g.erpNo} ({g.colour}) — {g.rejectionType} Subtotal:
                            </td>
                            <td className="p-2 text-center font-mono text-slate-900 bg-yellow-200">{g.groupTtl}</td>
                            <td className="p-2 text-slate-700">{g.rows.length} entries</td>
                            <td
                              className={cn(
                                'p-2 font-mono',
                                g.pctUpto >= 1 ? 'text-rose-700' : g.pctUpto >= 0.5 ? 'text-amber-700' : 'text-emerald-700'
                              )}
                            >
                              {g.recvQty > 0 ? `${g.pctUpto}%` : 'Set Recv Qty'}
                            </td>
                            <td className="p-2 text-right font-mono text-slate-900">{formatNumber(g.recvQty)}</td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'erp_recv' ? (
        /* TAB 3: ERP Recv Qty (ERP MASTER — All Buyers Auto-Synced + Recv Qty Overrides) */
        <div className="space-y-4">
          {canEdit && (
            <form onSubmit={handleAddCustomMaster} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-end gap-3 text-xs">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Buyer *</label>
                <input
                  list="buyer-options-master"
                  required
                  value={newMaster.buyer}
                  onChange={e => setNewMaster(p => ({ ...p, buyer: e.target.value }))}
                  placeholder="H&M, NEXT, Zara..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                />
                <datalist id="buyer-options-master">
                  {allBuyers.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">ERP / File / Job *</label>
                <input
                  required
                  value={newMaster.erpNo}
                  onChange={e => setNewMaster(p => ({ ...p, erpNo: e.target.value }))}
                  placeholder="e.g. 111-8663"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Colour</label>
                <input
                  value={newMaster.colour}
                  onChange={e => setNewMaster(p => ({ ...p, colour: e.target.value }))}
                  placeholder="51-122"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                />
              </div>
              <div className="w-36">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Recv Qty (pcs)</label>
                <input
                  type="number"
                  min={0}
                  value={newMaster.recvQty}
                  onChange={e => setNewMaster(p => ({ ...p, recvQty: Number(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Add / Update ERP Master
              </button>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-2">
              <span className="text-xs font-black tracking-wide">
                ERP MASTER (All Buyers Live ERP + Recv Qty Sync)
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleSaveConfig()}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Save size={12} /> Save All Recv Qty Changes
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-blue-950 text-white font-bold">
                  <tr>
                    <th className="p-2.5">Buyer</th>
                    <th className="p-2.5">ERP / File / Job (auto)</th>
                    <th className="p-2.5">Colour</th>
                    <th className="p-2.5 text-right">ERP Auto Recv (pcs)</th>
                    <th className="p-2.5 text-right bg-amber-900/40">Recv Qty (pcs)</th>
                    <th className="p-2.5">Type (auto)</th>
                    <th className="p-2.5 text-right">Before Wash Rej</th>
                    <th className="p-2.5 text-right">After Wash Rej</th>
                    <th className="p-2.5 text-right">Total Rej %</th>
                    <th className="p-2.5 text-center">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {erpMasterList
                    .filter(m => selectedBuyer === 'ALL' || m.buyer.toLowerCase() === selectedBuyer.toLowerCase())
                    .map(m => {
                      const erpRejs = entries.filter(e => e.erpNo.toLowerCase() === m.erpNo.toLowerCase());
                      const bef = erpRejs.filter(e => !/after/i.test(e.rejectionType)).reduce((s, r) => s + r.ttl, 0);
                      const aft = erpRejs.filter(e => /after/i.test(e.rejectionType)).reduce((s, r) => s + r.ttl, 0);
                      const tot = bef + aft;
                      const pct = m.recvQty > 0 ? (tot / m.recvQty) * 100 : 0;

                      return (
                        <tr key={m.erpNo} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-blue-700">{m.buyer}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-900">{m.erpNo}</td>
                          <td className="p-2.5 font-mono bg-amber-50/40">{m.colour || '—'}</td>
                          <td className="p-2.5 text-right font-mono text-slate-500">{formatNumber(m.autoRecvQty)}</td>
                          <td className="p-2 text-right bg-amber-50/70">
                            {canEdit ? (
                              <input
                                type="number"
                                min={0}
                                value={recvOverrides[m.erpNo] ?? m.recvQty}
                                onChange={e =>
                                  setRecvOverrides(prev => ({ ...prev, [m.erpNo]: Number(e.target.value) || 0 }))
                                }
                                className="w-28 text-right bg-white border border-amber-300 rounded px-2 py-1 font-mono font-bold text-blue-700"
                              />
                            ) : (
                              <span className="font-mono font-bold text-blue-700">{formatNumber(m.recvQty)}</span>
                            )}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700">{m.type}</td>
                          <td className="p-2.5 text-right font-mono">{bef}</td>
                          <td className="p-2.5 text-right font-mono">{aft}</td>
                          <td className={cn('p-2.5 text-right font-mono font-black', pct >= 1 ? 'text-rose-700' : 'text-emerald-700')}>
                            {m.recvQty > 0 ? `${pct.toFixed(2)}%` : '—'}
                          </td>
                          <td className="p-2.5 text-center">
                            {m.recvQty === 0 && tot > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">Need Recv Qty</span>
                            ) : pct >= 1 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">High (≥1.0%)</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 4: Buyer Custom Size Lists */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <form onSubmit={handleSaveBuyerSizeList} className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">Configure Buyer Size Range</h3>
              <p className="text-xs text-slate-500 mt-1">
                Each buyer can define its own ordered size columns (e.g. NEXT: <span className="font-mono">6, 8, 10, 12, 14</span> or Denim: <span className="font-mono">28, 30, 32, 34, 36</span>). Buyers without a custom list default to <span className="font-mono">XS, S, M, L, XL, XXL</span>. &ldquo;No Size&rdquo; is always appended automatically.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Buyer Name *</label>
              <input
                list="buyer-options-sizes"
                required
                value={sizeCfgBuyer}
                onChange={e => setSizeCfgBuyer(e.target.value)}
                placeholder="e.g. NEXT, Zara, H&M..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold"
              />
              <datalist id="buyer-options-sizes">
                {allBuyers.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Ordered Sizes (comma separated) *
              </label>
              <input
                required
                value={sizeCfgText}
                onChange={e => setSizeCfgText(e.target.value)}
                placeholder="6, 8, 10, 12, 14"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Preview: {[...parseSizeListText(sizeCfgText), NO_SIZE_LABEL].join(' · ')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!canEdit || saving}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} /> Save Buyer Size List
              </button>
              {sizeCfgBuyer.trim() && (
                <button
                  type="button"
                  disabled={!canEdit || saving}
                  onClick={() => handleResetBuyerSizeList(sizeCfgBuyer.trim())}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
          </form>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-3">Saved Buyer Size Lists</h3>
            {Object.keys(buyerSizeLists).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No custom buyer size lists saved yet — all buyers currently use <span className="font-mono font-bold">XS, S, M, L, XL, XXL + No Size</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {(Object.entries(buyerSizeLists) as [string, string[]][]).map(([buyerName, list]) => {
                  const safeList = Array.isArray(list) ? list : [];
                  return (
                  <div
                    key={buyerName}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => setSizeCfgBuyer(buyerName)}
                      className="text-left flex-1 cursor-pointer"
                    >
                      <span className="text-xs font-black text-blue-700">{buyerName}</span>
                      <span className="ml-3 text-xs font-mono text-slate-600">
                        {[...safeList, NO_SIZE_LABEL].join(' · ')}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleResetBuyerSizeList(buyerName)}
                        className="text-xs font-bold text-slate-400 hover:text-rose-600 px-2 py-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
