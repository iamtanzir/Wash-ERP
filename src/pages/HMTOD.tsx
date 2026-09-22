import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Ship, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Download, 
  ArrowRight, 
  Activity, 
  Upload, 
  Table2, 
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X
} from 'lucide-react';
import { cn, formatNumber } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { 
  INITIAL_HM_SHIP_TOD_DATA, 
  HmShipTodRow, 
  calcRowMetrics, 
  formatParentheses 
} from '../data/hmShipTodData';

const LOCAL_STORAGE_KEY = 'inctl_hm_ship_tod_data_v1';
const LOCAL_STORAGE_DATE_KEY = 'inctl_hm_ship_tod_date_v1';

// Mock data fallback for Risk Analysis
const mockDataGroups = [
  {
    name: "1st.F",
    items: [
      { erpId: "111-7992", washType: "Garment Dye Snow Wash", erpQty: 21754, wRecv: 9484, wDeli: 7846 },
      { erpId: "111-8013", washType: "GarmentDyesnowWash", erpQty: 28451, wRecv: 16500, wDeli: 11346 },
      { erpId: "111-8043", washType: "Enzyme Wash", erpQty: 10549, wRecv: 8695, wDeli: 7295 },
      { erpId: "111-8094", washType: "Pig Dye Enzm Wash", erpQty: 19576, wRecv: 4700, wDeli: 0 },
    ]
  }
];

type SortDirection = 'asc' | 'desc' | null;

interface ColumnFilterState {
  [colKey: string]: string[];
}

export default function HMTOD() {
  const [activeTab, setActiveTab] = useState<'plan' | 'input' | 'pivot' | 'risk'>('plan');
  const [planDate, setPlanDate] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_DATE_KEY) || '22-Sep-26';
  });

  // Master H&M Ship TOD Data State
  const [todRows, setTodRows] = useState<HmShipTodRow[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to load saved TOD data:", e);
      }
    }
    return INITIAL_HM_SHIP_TOD_DATA;
  });

  // Global Quick Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'SHORTAGE' | 'WIP' | 'REMARKS'>('ALL');

  // Excel-like Column Filters & Sorting
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({});
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');

  // Editing Row States
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRow, setNewRow] = useState<Omit<HmShipTodRow, 'id'>>({
    floor: '1st.F',
    wPlan: 'INCTL',
    job: '',
    color: '',
    ordQty: 0,
    wRecv: 0,
    wDeli: 0,
    wReady: 0,
    ship23: 0,
    ship26: 0,
    remarks: '',
    isYellowJob: false,
    isRedJob: false
  });

  // Cutoff Input State for Tab 2
  const [cutoffData, setCutoffData] = useState<any[]>([]);
  const [pasteData, setPasteData] = useState('');

  // ERP queries
  const { data: erpOrders } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.getActiveOrders()
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['allLogs'],
    queryFn: () => api.getRecentLogs(1000)
  });

  // Save to localStorage
  const saveRows = (rows: HmShipTodRow[]) => {
    setTodRows(rows);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(rows));
  };

  const handleResetToDefault = () => {
    if (window.confirm("Reset H&M Ship TOD sheet back to standard 22-Sep initial data (54 rows)?")) {
      saveRows(INITIAL_HM_SHIP_TOD_DATA);
      setPlanDate('22-Sep-26');
      localStorage.setItem(LOCAL_STORAGE_DATE_KEY, '22-Sep-26');
      setColumnFilters({});
      setSortColumn(null);
      setSortDirection(null);
      setSearchQuery('');
      setRiskFilter('ALL');
      toast.success("Reset to 22-Sep standard plan with 54 orders");
    }
  };

  // Helper to extract raw value for each column key
  const getRowValue = (row: HmShipTodRow, colKey: string): string | number => {
    const m = calcRowMetrics(row);
    switch (colKey) {
      case 'floor': return row.floor;
      case 'wPlan': return row.wPlan || '-';
      case 'job': return row.job;
      case 'color': return row.color;
      case 'ordQty': return row.ordQty;
      case 'wRecv': return row.wRecv;
      case 'wDeli': return row.wDeli;
      case 'wip': return m.wip;
      case 'wReady': return row.wReady;
      case 'target': return m.target;
      case 'ship23': return row.ship23;
      case 'target23': return m.target23;
      case 'rfd23': return m.rfd23;
      case 'ship26': return row.ship26;
      case 'target26': return m.target26;
      case 'rfd26': return m.rfd26;
      case 'remarks': return row.remarks || '-';
      default: return '';
    }
  };

  // Get distinct values for a given column key
  const getDistinctValues = (colKey: string): string[] => {
    const set = new Set<string>();
    todRows.forEach(row => {
      const val = getRowValue(row, colKey);
      set.add(String(val));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  // Toggle filter on a distinct value
  const handleToggleColumnFilter = (colKey: string, val: string) => {
    setColumnFilters(prev => {
      const current = prev[colKey];
      if (!current) {
        // If nothing was filtered yet, selecting one means all others EXCEPT this one?
        // Excel standard: when you uncheck an item, it removes it from allowed list
        const all = getDistinctValues(colKey);
        const next = all.filter(v => v !== val);
        return { ...prev, [colKey]: next };
      }
      if (current.includes(val)) {
        const next = current.filter(v => v !== val);
        return { ...prev, [colKey]: next };
      } else {
        const next = [...current, val];
        return { ...prev, [colKey]: next };
      }
    });
  };

  // Select all / Clear column filter
  const handleSelectAllColumn = (colKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  const handleClearColumnFilter = (colKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
    setOpenFilterCol(null);
  };

  // Sorting handler
  const handleSortColumn = (colKey: string, dir: SortDirection) => {
    if (sortColumn === colKey && sortDirection === dir) {
      setSortColumn(null);
      setSortDirection(null);
    } else {
      setSortColumn(colKey);
      setSortDirection(dir);
    }
    setOpenFilterCol(null);
  };

  // Filtered and Sorted rows
  const filteredRows = useMemo(() => {
    let result = todRows.filter(row => {
      const metrics = calcRowMetrics(row);

      // Global Risk Filter
      if (riskFilter === 'SHORTAGE') {
        const hasShortage = metrics.target23 > 0 || metrics.rfd23 > 0 || metrics.target26 > 0 || metrics.rfd26 > 0;
        if (!hasShortage) return false;
      } else if (riskFilter === 'WIP') {
        if (metrics.wip <= 0) return false;
      } else if (riskFilter === 'REMARKS') {
        if (!row.remarks || !row.remarks.trim()) return false;
      }

      // Global Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          row.job.toLowerCase().includes(q) ||
          row.color.toLowerCase().includes(q) ||
          row.floor.toLowerCase().includes(q) ||
          row.wPlan.toLowerCase().includes(q) ||
          row.remarks.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Column specific Excel filters
      for (const [colKey, allowedValues] of Object.entries(columnFilters) as [string, string[]][]) {
        if (allowedValues && allowedValues.length > 0) {
          const val = String(getRowValue(row, colKey));
          if (!allowedValues.includes(val)) {
            return false;
          }
        }
      }

      return true;
    });

    // Apply sorting if active
    if (sortColumn && sortDirection) {
      result = [...result].sort((a, b) => {
        const valA = getRowValue(a, sortColumn);
        const valB = getRowValue(b, sortColumn);

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (sortDirection === 'asc') {
          return strA.localeCompare(strB, undefined, { numeric: true });
        } else {
          return strB.localeCompare(strA, undefined, { numeric: true });
        }
      });
    }

    return result;
  }, [todRows, searchQuery, riskFilter, columnFilters, sortColumn, sortDirection]);

  // Dynamic Subtotals (Calculated on FILTERED rows, exactly like Excel SUBTOTAL(9, ...))
  const filteredSubtotals = useMemo(() => {
    let ordQty = 0;
    let wRecv = 0;
    let wDeli = 0;
    let wip = 0;
    let wReady = 0;
    let target = 0;
    let ship23 = 0;
    let netTarget23 = 0;
    let posTarget23 = 0;
    let netRfd23 = 0;
    let posRfd23 = 0;
    let ship26 = 0;
    let netTarget26 = 0;
    let posTarget26 = 0;
    let netRfd26 = 0;
    let posRfd26 = 0;

    filteredRows.forEach(row => {
      const m = calcRowMetrics(row);
      ordQty += row.ordQty;
      wRecv += row.wRecv;
      wDeli += row.wDeli;
      wip += m.wip;
      wReady += row.wReady;
      target += m.target;

      ship23 += row.ship23;
      netTarget23 += m.target23;
      if (m.target23 > 0) posTarget23 += m.target23;
      netRfd23 += m.rfd23;
      if (m.rfd23 > 0) posRfd23 += m.rfd23;

      ship26 += row.ship26;
      netTarget26 += m.target26;
      if (m.target26 > 0) posTarget26 += m.target26;
      netRfd26 += m.rfd26;
      if (m.rfd26 > 0) posRfd26 += m.rfd26;
    });

    const totalPositiveShortage = posTarget23 + posTarget26;

    return {
      ordQty,
      wRecv,
      wDeli,
      wip,
      wReady,
      target,
      ship23,
      netTarget23,
      posTarget23,
      netRfd23,
      posRfd23,
      ship26,
      netTarget26,
      posTarget26,
      netRfd26,
      posRfd26,
      totalPositiveShortage
    };
  }, [filteredRows]);

  // Inline update helper
  const handleCellChange = (id: string, field: keyof HmShipTodRow, value: any) => {
    const updated = todRows.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    saveRows(updated);
  };

  // Add new row submit
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRow.job.trim()) {
      toast.error("Please enter ERP/File Job No.");
      return;
    }
    const created: HmShipTodRow = {
      ...newRow,
      id: Date.now().toString()
    };
    saveRows([...todRows, created]);
    setIsAddModalOpen(false);
    setNewRow({
      floor: '1st.F',
      wPlan: 'INCTL',
      job: '',
      color: '',
      ordQty: 0,
      wRecv: 0,
      wDeli: 0,
      wReady: 0,
      ship23: 0,
      ship26: 0,
      remarks: '',
      isYellowJob: false,
      isRedJob: false
    });
    toast.success("Order added to H&M Ship TOD Plan");
  };

  // Delete Row
  const handleDeleteRow = (id: string) => {
    if (window.confirm("Remove this order row from the TOD Plan?")) {
      saveRows(todRows.filter(r => r.id !== id));
      toast.success("Row removed");
    }
  };

  // Export to Excel (.xlsx) with authentic columns
  const handleExportExcel = () => {
    const headers = [
      'Sew. Floor',
      'W. Plan',
      'ERP/File/ Job',
      'Color',
      'Ord Qty',
      'TTL. W. Received',
      'TTL. W. Delivery',
      'Wash WIP Qty',
      'Wash Ready Qty',
      'Wash Target Qty',
      'Ship Qty (23-Sep)',
      'Wash. Target Qty (23-Sep)',
      'Sew. RFD 23-Sep',
      'Ship Qty (26-Sep)',
      'Wash. Target Qty (26-Sep)',
      'Sew. RFD 26-Sep',
      'REMARKS'
    ];

    // Top Subtotal row
    const subtotalRow = [
      `Date: ${planDate}`,
      'Subtotal',
      '',
      '',
      filteredSubtotals.ordQty,
      filteredSubtotals.wRecv,
      filteredSubtotals.wDeli,
      filteredSubtotals.wip,
      filteredSubtotals.wReady,
      filteredSubtotals.target,
      filteredSubtotals.ship23,
      filteredSubtotals.netTarget23 < 0 ? `(${Math.abs(filteredSubtotals.netTarget23)})` : filteredSubtotals.netTarget23,
      filteredSubtotals.netRfd23 < 0 ? `(${Math.abs(filteredSubtotals.netRfd23)})` : filteredSubtotals.netRfd23,
      filteredSubtotals.ship26,
      filteredSubtotals.netTarget26 < 0 ? `(${Math.abs(filteredSubtotals.netTarget26)})` : filteredSubtotals.netTarget26,
      filteredSubtotals.netRfd26 < 0 ? `(${Math.abs(filteredSubtotals.netRfd26)})` : filteredSubtotals.netRfd26,
      filteredSubtotals.totalPositiveShortage
    ];

    const dataRows = todRows.map(r => {
      const m = calcRowMetrics(r);
      return [
        r.floor,
        r.wPlan,
        r.job,
        r.color,
        r.ordQty,
        r.wRecv,
        r.wDeli,
        m.wip,
        r.wReady,
        m.target,
        r.ship23,
        m.target23 < 0 ? `(${Math.abs(m.target23)})` : m.target23,
        m.rfd23 < 0 ? `(${Math.abs(m.rfd23)})` : m.rfd23,
        r.ship26,
        m.target26 < 0 ? `(${Math.abs(m.target26)})` : m.target26,
        m.rfd26 < 0 ? `(${Math.abs(m.rfd26)})` : m.rfd26,
        r.remarks
      ];
    });

    // Bottom G.Total row
    const gTotalRow = [
      'G.Total',
      '',
      '',
      '',
      filteredSubtotals.ordQty,
      filteredSubtotals.wRecv,
      filteredSubtotals.wDeli,
      filteredSubtotals.wip,
      filteredSubtotals.wReady,
      filteredSubtotals.target,
      filteredSubtotals.ship23,
      filteredSubtotals.posTarget23,
      filteredSubtotals.posRfd23,
      filteredSubtotals.ship26,
      filteredSubtotals.posTarget26,
      filteredSubtotals.posRfd26,
      ''
    ];

    const ws = XLSX.utils.aoa_to_sheet([subtotalRow, headers, ...dataRows, gTotalRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HM_Ship_TOD_Plan");
    XLSX.writeFile(wb, `HM_Ship_TOD_Plan_${planDate.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    toast.success("Downloaded Excel Sheet");
  };

  // Tab 2: Country-wise paste handler
  const handlePasteData = () => {
    if (!pasteData.trim()) {
      toast.error("Please paste data first");
      return;
    }
    const parsed = Papa.parse(pasteData, { delimiter: '\t', header: true, skipEmptyLines: true });
    if (parsed.data && parsed.data.length > 0) {
      setCutoffData(parsed.data);
      toast.success(`Loaded ${parsed.data.length} rows`);
      setPasteData('');
    } else {
      toast.error("Failed to parse data");
    }
  };

  // Tab 3: Pivot Data
  const pivotData = useMemo(() => {
    if (!cutoffData.length) return { dates: [], rows: [] };
    
    const datesSet = new Set<string>();
    const grouped: Record<string, Record<string, any>> = {};
    
    cutoffData.forEach(row => {
      const file = row['Job ref'] || row['ERP / File / Job'] || row['File'] || row['ERP'] || 'Unknown';
      const color = row['Colour'] || row['Color'] || 'Unknown';
      const date = row['Shipment date'] || row['Ship Date'] || 'Unknown';
      const qty = parseInt(row['Order Qty.'] || row['Order Qty'] || row['Qty'] || '0') || 0;
      
      if (date && date !== 'Unknown') datesSet.add(date);
      
      if (!grouped[file]) grouped[file] = {};
      if (!grouped[file][color]) grouped[file][color] = { total: 0 };
      
      grouped[file][color][date] = (grouped[file][color][date] || 0) + qty;
      grouped[file][color].total += qty;
    });

    const dates = Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    const rows: any[] = [];
    Object.keys(grouped).sort().forEach(file => {
      let fileTotal = 0;
      const colors = Object.keys(grouped[file]).sort();
      colors.forEach(color => {
        fileTotal += grouped[file][color].total;
      });
      rows.push({ isGroup: true, file, total: fileTotal });
      
      colors.forEach(color => {
        rows.push({ isGroup: false, file, color, data: grouped[file][color] });
      });
    });

    return { dates, rows, rawGrouped: grouped };
  }, [cutoffData]);

  // Tab 4: Risk Analysis Data
  const riskAnalysisData = useMemo(() => {
    if (!pivotData.dates.length) return mockDataGroups;

    const floors: Record<string, any[]> = {};
    const fileTargets: Record<string, Record<string, number>> = {};
    
    pivotData.rows.forEach(row => {
      if (!row.isGroup) {
        if (!fileTargets[row.file]) fileTargets[row.file] = {};
        pivotData.dates.forEach(d => {
           fileTargets[row.file][d] = (fileTargets[row.file][d] || 0) + (row.data[d] || 0);
        });
        fileTargets[row.file].total = (fileTargets[row.file].total || 0) + (row.data.total || 0);
      }
    });

    Object.keys(fileTargets).forEach(file => {
      const order = erpOrders?.find((o: any) => o.file_no === file || o.id === file);
      const floor = order?.floor || '1st.F';
      
      const logs = recentLogs?.items?.filter((l: any) => l.expand?.erp_order?.file_no === file) || [];
      const wRecv = logs.reduce((sum: number, l: any) => sum + (l.received_qty || 0), 0);
      const wDeli = logs.reduce((sum: number, l: any) => sum + (l.delivered_qty || 0), 0);
      const erpQty = order?.order_qty || fileTargets[file].total || 0;

      if (!floors[floor]) floors[floor] = [];
      floors[floor].push({
        erpId: file,
        washType: order?.wash_type || 'Unknown Wash',
        erpQty: erpQty,
        wRecv: wRecv,
        wDeli: wDeli,
        shipTargets: fileTargets[file]
      });
    });

    return Object.keys(floors).map(name => ({
      name,
      items: floors[name]
    }));
  }, [pivotData, erpOrders, recentLogs]);

  // Close filter dropdown on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenFilterCol(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Column header definition
  const columns = [
    { key: 'floor', label: 'Sew. Floor', bg: '#ffff00', textColor: '#000000', align: 'center', width: 'w-24' },
    { key: 'wPlan', label: 'W. Plan', bg: '#ffff00', textColor: '#000000', align: 'center', width: 'w-24' },
    { key: 'job', label: 'ERP/File/ Job', bg: '#ffff00', textColor: '#000000', align: 'center', width: 'w-32' },
    { key: 'color', label: 'Color', bg: '#ffff00', textColor: '#000000', align: 'center', width: 'w-20' },
    { key: 'ordQty', label: 'Ord Qty', bg: '#ffff00', textColor: '#000000', align: 'right', width: 'w-24' },
    { key: 'wRecv', label: 'TTL. W. Received', bg: '#70ad47', textColor: '#ffffff', align: 'right', width: 'w-28' },
    { key: 'wDeli', label: 'TTL. W. Delivery', bg: '#70ad47', textColor: '#ffffff', align: 'right', width: 'w-28' },
    { key: 'wip', label: 'Wash WIP Qty', bg: '#ffff00', textColor: '#000000', align: 'right', width: 'w-24' },
    { key: 'wReady', label: 'Wash Ready Qty', bg: '#ffff00', textColor: '#000000', align: 'right', width: 'w-24' },
    { key: 'target', label: 'Wash Target Qty', bg: '#ffc9bb', textColor: '#c00000', align: 'right', width: 'w-24' },
    { key: 'ship23', label: 'Ship Qty (23-Sep)', bg: '#d9e1f2', textColor: '#000000', align: 'right', width: 'w-28' },
    { key: 'target23', label: 'Wash. Target Qty (23-Sep)', bg: '#ffc9bb', textColor: '#c00000', align: 'right', width: 'w-28' },
    { key: 'rfd23', label: 'Sew. RFD 23-Sep', bg: '#fff2cc', textColor: '#000000', align: 'right', width: 'w-28' },
    { key: 'ship26', label: 'Ship Qty (26-Sep)', bg: '#d9e1f2', textColor: '#000000', align: 'right', width: 'w-28' },
    { key: 'target26', label: 'Wash. Target Qty (26-Sep)', bg: '#ffc9bb', textColor: '#c00000', align: 'right', width: 'w-28' },
    { key: 'rfd26', label: 'Sew. RFD 26-Sep', bg: '#fff2cc', textColor: '#000000', align: 'right', width: 'w-28' },
    { key: 'remarks', label: 'REMARKS', bg: '#ffff00', textColor: '#000000', align: 'center', width: 'min-w-[180px]' }
  ];

  return (
    <div className="space-y-4 font-sans text-slate-900">
      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider">H&M Exclusive</span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">H&M SHIP TOD REPORT & RISK PLAN</h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Exact Excel-Style Layout: Wash WIP, Shortage Tracking, 23-Sep & 26-Sep Delivery Plans
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          <div className="flex items-center bg-[#fce4d6] border border-[#f8cbad] rounded-lg px-3 py-1.5 text-xs font-bold text-[#c00000] shadow-xs">
            <Calendar size={14} className="mr-1.5 text-[#c00000]" />
            <span className="text-slate-600 mr-1 font-semibold">Date:</span>
            <input 
              type="text" 
              value={planDate}
              onChange={(e) => {
                setPlanDate(e.target.value);
                localStorage.setItem(LOCAL_STORAGE_DATE_KEY, e.target.value);
              }}
              className="bg-transparent font-black text-[#c00000] outline-none w-24 text-center cursor-pointer hover:bg-white rounded px-1 transition-colors"
              title="Click to edit sheet date"
            />
          </div>

          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#217346] hover:bg-[#1a5c37] text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            title="Download formatted Excel (.xlsx) file"
          >
            <Download size={14} />
            Excel Export
          </button>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus size={14} />
            Add Row
          </button>

          <button 
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            title="Reset to 22-Sep standard data (54 rows)"
          >
            <RefreshCw size={13} />
            Reset
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setActiveTab('plan')}
          className={`flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'plan' 
              ? 'bg-yellow-50/60 text-blue-700 border-blue-600' 
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileSpreadsheet size={16} className="text-yellow-600" />
          1. H&M Ship TOD Plan (Master Sheet)
          <span className="ml-1 bg-yellow-200 text-yellow-900 text-[10px] px-2 py-0.5 rounded-full font-black">
            {todRows.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'input' 
              ? 'bg-blue-50/60 text-blue-700 border-blue-600' 
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Table2 size={16} />
          2. Country-wise Cutoff Input
        </button>

        <button 
          onClick={() => setActiveTab('pivot')}
          className={`flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'pivot' 
              ? 'bg-emerald-50/60 text-emerald-700 border-emerald-600' 
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers size={16} />
          3. Auto Pivot Matrix
        </button>

        <button 
          onClick={() => setActiveTab('risk')}
          className={`flex items-center gap-2 px-5 py-3.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'risk' 
              ? 'bg-orange-50/60 text-orange-700 border-orange-600' 
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Activity size={16} />
          4. Floor-wise Risk Analysis
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm p-3 sm:p-5">
        {/* ================= TAB 1: MASTER H&M SHIP TOD PLAN ================= */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            {/* Quick KPI Strip / Summary Header */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-yellow-800">Total Ord Qty</span>
                <p className="text-base font-black text-slate-900 mt-0.5">{formatNumber(filteredSubtotals.ordQty)}</p>
                <span className="text-[10px] text-slate-500">{filteredRows.length} Orders shown</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-emerald-800">TTL. W. Received</span>
                <p className="text-base font-black text-emerald-700 mt-0.5">{formatNumber(filteredSubtotals.wRecv)}</p>
                <span className="text-[10px] text-emerald-600 font-semibold">{filteredSubtotals.ordQty > 0 ? ((filteredSubtotals.wRecv / filteredSubtotals.ordQty) * 100).toFixed(1) : 0}% Recv</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-emerald-800">TTL. W. Delivery</span>
                <p className="text-base font-black text-emerald-700 mt-0.5">{formatNumber(filteredSubtotals.wDeli)}</p>
                <span className="text-[10px] text-emerald-600 font-semibold">{filteredSubtotals.ordQty > 0 ? ((filteredSubtotals.wDeli / filteredSubtotals.ordQty) * 100).toFixed(1) : 0}% Shipped</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-amber-800">Wash WIP Qty</span>
                <p className="text-base font-black text-amber-700 mt-0.5">{formatNumber(filteredSubtotals.wip)}</p>
                <span className="text-[10px] text-amber-600 font-semibold">Active Wash Load</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-amber-800">Wash Ready Qty</span>
                <p className="text-base font-black text-slate-800 mt-0.5">{formatNumber(filteredSubtotals.wReady)}</p>
                <span className="text-[10px] text-slate-500">Ready to Pack</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <span className="text-[10px] uppercase font-bold text-rose-800">Wash Target Qty</span>
                <p className="text-base font-black text-[#c00000] mt-0.5">{formatNumber(filteredSubtotals.target)}</p>
                <span className="text-[10px] text-[#c00000] font-semibold">Remaining WIP</span>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-[#ff0000] text-white rounded-lg p-2.5 flex flex-col justify-between shadow-xs">
                <span className="text-[10px] uppercase font-bold text-red-100">Total Wash Shortage</span>
                <div className="flex justify-between items-baseline mt-0.5">
                  <span className="text-xs text-red-100">23-S & 26-S</span>
                  <span className="text-lg font-black text-white tracking-tight">
                    {formatNumber(filteredSubtotals.totalPositiveShortage)}
                  </span>
                </div>
                <span className="text-[9px] text-red-100 opacity-90">Positive Shortage Total</span>
              </div>
            </div>

            {/* Quick Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative w-48 sm:w-60">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search Job, Color, Floor, Remarks..."
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 font-bold">×</button>
                  )}
                </div>

                {/* Risk Filter */}
                <div className="flex items-center gap-1 bg-white border border-slate-300 p-0.5 rounded-lg">
                  <button 
                    onClick={() => setRiskFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${riskFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    All ({todRows.length})
                  </button>
                  <button 
                    onClick={() => setRiskFilter('SHORTAGE')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${riskFilter === 'SHORTAGE' ? 'bg-[#ff0000] text-white' : 'text-red-700 hover:bg-red-50'}`}
                  >
                    Shortage (Red)
                  </button>
                  <button 
                    onClick={() => setRiskFilter('WIP')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${riskFilter === 'WIP' ? 'bg-amber-500 text-white' : 'text-amber-800 hover:bg-amber-50'}`}
                  >
                    WIP &gt; 0
                  </button>
                  <button 
                    onClick={() => setRiskFilter('REMARKS')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${riskFilter === 'REMARKS' ? 'bg-blue-600 text-white' : 'text-blue-700 hover:bg-blue-50'}`}
                  >
                    With Remarks
                  </button>
                </div>

                {/* Reset Column Filters button if active */}
                {Object.keys(columnFilters).length > 0 && (
                  <button
                    onClick={() => setColumnFilters({})}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold transition-colors"
                  >
                    <X size={12} />
                    Clear Column Filters ({Object.keys(columnFilters).length})
                  </button>
                )}
              </div>

              {/* Status Indicator */}
              <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2">
                <span>Showing <strong className="text-slate-800">{filteredRows.length}</strong> of {todRows.length} records</span>
                <span className="text-slate-300">|</span>
                <span className="flex items-center gap-1 font-bold text-[#00b050]">
                  <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#00b050]"></span> Covered (Safe)
                </span>
                <span className="flex items-center gap-1 font-bold text-[#ff0000]">
                  <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#ff0000]"></span> Shortage (Short)
                </span>
              </div>
            </div>

            {/* Master Spreadsheet Table */}
            <div className="border border-slate-300 rounded-lg overflow-x-auto shadow-xs max-h-[780px] relative">
              <table className="w-full text-xs text-left border-collapse min-w-[1550px] font-sans">
                {/* Fixed Sticky Header */}
                <thead className="sticky top-0 z-30 shadow-xs">
                  {/* Top Subtotal Row (Row above Header - Exactly like the uploaded image) */}
                  <tr className="bg-white text-[11px] font-bold border-b border-slate-300 text-slate-900">
                    {/* Col 0: Excel Row Number space */}
                    <td className="w-10 px-1 py-1.5 border-r border-slate-300 bg-slate-200/90 text-center font-bold text-slate-500 sticky left-0 z-40">
                      
                    </td>

                    {/* Col 1-4: Date + Subtotal */}
                    <td className="px-2 py-1.5 border-r border-slate-300 bg-[#fce4d6] text-[#c00000] font-black text-center sticky left-10 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Date:
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 bg-[#fce4d6] text-[#c00000] font-black text-center">
                      {planDate}
                    </td>
                    <td className="px-2 py-1.5 border-r border-slate-300 bg-[#fce4d6] text-[#c00000] font-black text-center" colSpan={2}>
                      Subtotal
                    </td>

                    {/* Col 5: Ord Qty */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.ordQty)}
                    </td>

                    {/* Col 6: TTL W. Received */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.wRecv)}
                    </td>

                    {/* Col 7: TTL W. Delivery */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.wDeli)}
                    </td>

                    {/* Col 8: Wash WIP Qty */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.wip)}
                    </td>

                    {/* Col 9: Wash Ready Qty */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.wReady)}
                    </td>

                    {/* Col 10: Wash Target Qty */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.target)}
                    </td>

                    {/* Col 11: Ship Qty (23-Sep) */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.ship23)}
                    </td>

                    {/* Col 12: Wash. Target Qty (23-Sep) Subtotal */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-[#fce4d6] text-[#c00000] font-bold">
                      {formatParentheses(filteredSubtotals.netTarget23)}
                    </td>

                    {/* Col 13: Sew. RFD 23-Sep Subtotal */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white text-slate-900 font-bold">
                      {formatParentheses(filteredSubtotals.netRfd23)}
                    </td>

                    {/* Col 14: Ship Qty (26-Sep) */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white font-bold text-slate-900">
                      {formatNumber(filteredSubtotals.ship26)}
                    </td>

                    {/* Col 15: Wash. Target Qty (26-Sep) Subtotal */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-[#fce4d6] text-[#c00000] font-bold">
                      {formatParentheses(filteredSubtotals.netTarget26)}
                    </td>

                    {/* Col 16: Sew. RFD 26-Sep Subtotal */}
                    <td className="px-2 py-1.5 border-r border-slate-300 text-right bg-white text-slate-900 font-bold">
                      {formatParentheses(filteredSubtotals.netRfd26)}
                    </td>

                    {/* Col 17: REMARKS Subtotal -> Grand Shortage Red Box! (76,766 in image) */}
                    <td className="px-2 py-1.5 bg-[#ff0000] text-white font-black text-center text-sm tracking-wide">
                      {formatNumber(filteredSubtotals.totalPositiveShortage)}
                    </td>
                  </tr>

                  {/* Header Row: Exact Colors and Columns from image */}
                  <tr className="text-[11px] font-black tracking-tight border-b-2 border-slate-400">
                    {/* Index header */}
                    <th className="w-10 px-1 py-2 border-r border-slate-300 bg-slate-200 text-slate-600 text-center sticky left-0 z-40">
                      #
                    </th>

                    {columns.map((col, idx) => {
                      const isSticky = idx === 0;
                      const isFiltered = !!columnFilters[col.key];
                      const isSorted = sortColumn === col.key;

                      return (
                        <th 
                          key={col.key}
                          style={{ backgroundColor: col.bg, color: col.textColor }}
                          className={cn(
                            "px-2 py-2 border-r border-slate-300 select-none relative group/th",
                            col.width,
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                            isSticky ? "sticky left-10 z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" : ""
                          )}
                        >
                          <div className={cn(
                            "flex items-center gap-1",
                            col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-between'
                          )}>
                            <span className="leading-tight">{col.label}</span>

                            {/* Excel Filter Dropdown Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenFilterCol(openFilterCol === col.key ? null : col.key);
                                setFilterSearchQuery('');
                              }}
                              className={cn(
                                "w-4 h-4 rounded flex items-center justify-center border transition-all ml-1 flex-shrink-0",
                                isFiltered 
                                  ? "bg-blue-600 text-white border-blue-700 shadow-xs" 
                                  : "bg-white/70 text-slate-700 border-slate-400 hover:bg-white"
                              )}
                              title={`Filter & Sort ${col.label}`}
                            >
                              {isSorted ? (
                                sortDirection === 'asc' ? <ArrowUp size={10} className="stroke-[3]" /> : <ArrowDown size={10} className="stroke-[3]" />
                              ) : (
                                <ChevronDown size={10} className="stroke-[2.5]" />
                              )}
                            </button>
                          </div>

                          {/* Excel Filter Popup Popover */}
                          {openFilterCol === col.key && (
                            <div 
                              ref={dropdownRef}
                              className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-300 z-50 p-2.5 text-xs text-slate-800 text-left font-normal"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between border-b pb-1.5 mb-2 font-bold text-slate-700">
                                <span>Filter: {col.label}</span>
                                <button 
                                  onClick={() => setOpenFilterCol(null)}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Sort Buttons */}
                              <div className="space-y-1 mb-2 pb-2 border-b">
                                <button
                                  onClick={() => handleSortColumn(col.key, 'asc')}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100",
                                    isSorted && sortDirection === 'asc' && "bg-blue-50 text-blue-700 font-bold"
                                  )}
                                >
                                  <ArrowUp size={12} className="text-blue-600" />
                                  Sort Ascending (A-Z / Min-Max)
                                </button>
                                <button
                                  onClick={() => handleSortColumn(col.key, 'desc')}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-100",
                                    isSorted && sortDirection === 'desc' && "bg-blue-50 text-blue-700 font-bold"
                                  )}
                                >
                                  <ArrowDown size={12} className="text-blue-600" />
                                  Sort Descending (Z-A / Max-Min)
                                </button>
                              </div>

                              {/* Search inside filter items */}
                              <div className="relative mb-2">
                                <Search size={12} className="absolute left-2 top-2 text-slate-400" />
                                <input 
                                  type="text"
                                  value={filterSearchQuery}
                                  onChange={(e) => setFilterSearchQuery(e.target.value)}
                                  placeholder="Search values..."
                                  className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1 text-[11px] outline-none focus:border-blue-500"
                                />
                              </div>

                              {/* Values Checkboxes */}
                              <div className="max-h-40 overflow-y-auto space-y-1 py-1 pr-1 border rounded bg-slate-50/50 p-1">
                                <label className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer font-bold text-[11px] text-slate-800">
                                  <input 
                                    type="checkbox"
                                    checked={!columnFilters[col.key]}
                                    onChange={() => handleSelectAllColumn(col.key)}
                                    className="rounded text-blue-600"
                                  />
                                  <span>(Select All)</span>
                                </label>

                                {getDistinctValues(col.key)
                                  .filter(val => val.toLowerCase().includes(filterSearchQuery.toLowerCase()))
                                  .map(val => {
                                    const currentAllowed = columnFilters[col.key];
                                    const isChecked = !currentAllowed || currentAllowed.includes(val);

                                    return (
                                      <label key={val} className="flex items-center gap-2 px-1 py-0.5 hover:bg-slate-100 rounded cursor-pointer text-[11px] text-slate-700">
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleColumnFilter(col.key, val)}
                                          className="rounded text-blue-600"
                                        />
                                        <span className="truncate">{val || '(Blank)'}</span>
                                      </label>
                                    );
                                  })}
                              </div>

                              {/* Clear Filter Button */}
                              {isFiltered && (
                                <button
                                  onClick={() => handleClearColumnFilter(col.key)}
                                  className="mt-2 w-full text-center py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded"
                                >
                                  Clear Filter for this Column
                                </button>
                              )}
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Table Data Rows */}
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-[11px]">
                  {filteredRows.map((row, index) => {
                    const m = calcRowMetrics(row);
                    const isEditing = editingRowId === row.id;

                    // Color highlight rules
                    const isYellowColor = row.isYellowJob || row.color === '09-103' || row.color === '15-103';

                    // 23-Sep cell styling
                    const target23Bg = m.target23 > 0 
                      ? 'bg-[#ff0000] text-white font-bold' 
                      : m.target23 < 0 
                        ? 'bg-[#00b050] text-slate-900 font-bold' 
                        : (row.ship23 > 0 || row.wDeli > 0) ? 'bg-[#00b050] text-slate-900 font-bold' : 'bg-white text-slate-900';

                    const rfd23Bg = m.rfd23 > 0 
                      ? 'bg-[#ff0000] text-white font-bold' 
                      : m.rfd23 < 0 
                        ? 'bg-[#00b050] text-slate-900 font-bold' 
                        : (row.ship23 > 0 || row.wRecv > 0) ? 'bg-[#00b050] text-slate-900 font-bold' : 'bg-white text-slate-900';

                    // 26-Sep cell styling
                    const target26Bg = m.target26 > 0 
                      ? 'bg-[#ff0000] text-white font-bold' 
                      : m.target26 < 0 
                        ? 'bg-[#00b050] text-slate-900 font-bold' 
                        : (row.ship26 > 0 || row.wDeli > 0) ? 'bg-[#00b050] text-slate-900 font-bold' : 'bg-white text-slate-900';

                    const rfd26Bg = m.rfd26 > 0 
                      ? 'bg-[#ff0000] text-white font-bold' 
                      : m.rfd26 < 0 
                        ? 'bg-[#00b050] text-slate-900 font-bold' 
                        : (row.ship26 > 0 || row.wRecv > 0) ? 'bg-[#00b050] text-slate-900 font-bold' : 'bg-white text-slate-900';

                    return (
                      <tr 
                        key={row.id} 
                        className="hover:bg-blue-50/40 transition-colors group"
                        onDoubleClick={() => setEditingRowId(row.id)}
                      >
                        {/* Row Index */}
                        <td className="w-10 px-1 py-1.5 border-r border-slate-200 text-center font-bold text-slate-400 bg-slate-100/70 sticky left-0 z-30">
                          {index + 1}
                        </td>

                        {/* Sew Floor */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-slate-900 font-bold text-center sticky left-10 bg-white group-hover:bg-blue-50/50 z-20 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          {isEditing ? (
                            <select 
                              value={row.floor} 
                              onChange={e => handleCellChange(row.id, 'floor', e.target.value)}
                              className="w-full text-xs font-bold border rounded px-1 py-0.5 bg-yellow-50"
                            >
                              <option value="1st.F">1st.F</option>
                              <option value="2nd.F">2nd.F</option>
                              <option value="Gnd.F">Gnd.F</option>
                              <option value="KF">KF</option>
                              <option value="B2B">B2B</option>
                              <option value="Unit 2 (Out-Side)">Unit 2 (Out-Side)</option>
                            </select>
                          ) : (
                            row.floor
                          )}
                        </td>

                        {/* W. Plan */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center text-slate-800 font-medium">
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={row.wPlan} 
                              onChange={e => handleCellChange(row.id, 'wPlan', e.target.value)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-center"
                            />
                          ) : (
                            <span className={cn(row.wPlan === 'Taj Wash' ? 'text-amber-900 font-bold' : 'text-slate-800')}>
                              {row.wPlan || '-'}
                            </span>
                          )}
                        </td>

                        {/* ERP/File/ Job */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 font-bold font-mono tracking-tight text-center",
                          row.isRedJob ? "text-[#c00000] font-black" : "text-slate-900"
                        )}>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={row.job} 
                              onChange={e => handleCellChange(row.id, 'job', e.target.value)}
                              className="w-full text-xs border rounded px-1 py-0.5 font-bold font-mono text-center"
                            />
                          ) : (
                            row.job
                          )}
                        </td>

                        {/* Color */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 font-mono text-center font-bold text-slate-900",
                          isYellowColor ? "bg-[#ffff00]" : ""
                        )}>
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={row.color} 
                              onChange={e => handleCellChange(row.id, 'color', e.target.value)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-center font-mono font-bold"
                            />
                          ) : (
                            row.color
                          )}
                        </td>

                        {/* Ord Qty */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.ordQty} 
                              onChange={e => handleCellChange(row.id, 'ordQty', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            formatNumber(row.ordQty)
                          )}
                        </td>

                        {/* TTL. W. Received */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.wRecv} 
                              onChange={e => handleCellChange(row.id, 'wRecv', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            formatNumber(row.wRecv)
                          )}
                        </td>

                        {/* TTL. W. Delivery */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.wDeli} 
                              onChange={e => handleCellChange(row.id, 'wDeli', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            formatNumber(row.wDeli)
                          )}
                        </td>

                        {/* Wash WIP Qty */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right font-bold",
                          m.wip > 0 ? "bg-[#fce4d6] text-[#c00000] font-black" : "text-slate-800"
                        )}>
                          {formatNumber(m.wip)}
                        </td>

                        {/* Wash Ready Qty */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right text-slate-900 font-bold">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.wReady} 
                              onChange={e => handleCellChange(row.id, 'wReady', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            formatNumber(row.wReady)
                          )}
                        </td>

                        {/* Wash Target Qty */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right font-bold",
                          m.target > 0 ? "bg-[#fce4d6] text-[#c00000] font-black" : "text-slate-800"
                        )}>
                          {formatNumber(m.target)}
                        </td>

                        {/* Ship Qty (23-Sep) */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.ship23} 
                              onChange={e => handleCellChange(row.id, 'ship23', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            row.ship23 > 0 ? formatNumber(row.ship23) : '0'
                          )}
                        </td>

                        {/* Wash. Target Qty (23-Sep) */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right transition-all",
                          target23Bg
                        )}>
                          {formatParentheses(m.target23)}
                        </td>

                        {/* Sew. RFD 23-Sep */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right transition-all",
                          rfd23Bg
                        )}>
                          {formatParentheses(m.rfd23)}
                        </td>

                        {/* Ship Qty (26-Sep) */}
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={row.ship26} 
                              onChange={e => handleCellChange(row.id, 'ship26', parseInt(e.target.value) || 0)}
                              className="w-full text-xs border rounded px-1 py-0.5 text-right font-bold"
                            />
                          ) : (
                            row.ship26 > 0 ? formatNumber(row.ship26) : '0'
                          )}
                        </td>

                        {/* Wash. Target Qty (26-Sep) */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right transition-all",
                          target26Bg
                        )}>
                          {formatParentheses(m.target26)}
                        </td>

                        {/* Sew. RFD 26-Sep */}
                        <td className={cn(
                          "px-2 py-1.5 border-r border-slate-200 text-right transition-all",
                          rfd26Bg
                        )}>
                          {formatParentheses(m.rfd26)}
                        </td>

                        {/* Remarks */}
                        <td className="px-2 py-1.5 text-slate-900 font-semibold relative">
                          <div className="flex items-center justify-between gap-1">
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={row.remarks} 
                                onChange={e => handleCellChange(row.id, 'remarks', e.target.value)}
                                placeholder="Enter remarks..."
                                className="w-full text-xs border rounded px-1.5 py-0.5"
                              />
                            ) : (
                              <span className={cn(
                                "truncate max-w-[200px]",
                                row.remarks.includes('today at 8pm') && "text-amber-800 font-bold bg-amber-100 px-1 py-0.5 rounded",
                                row.remarks.includes('tom at 6pm') && "text-blue-800 font-bold bg-blue-100 px-1 py-0.5 rounded",
                                row.remarks.includes('tom at 8pm') && "text-indigo-800 font-bold bg-indigo-100 px-1 py-0.5 rounded",
                                !row.remarks && "text-slate-400 font-normal italic"
                              )}>
                                {row.remarks || '-'}
                              </span>
                            )}

                            {/* Row Action Controls on hover */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <button 
                                onClick={() => setEditingRowId(isEditing ? null : row.id)}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600"
                                title={isEditing ? "Save / Done" : "Quick Edit"}
                              >
                                {isEditing ? <Save size={12} className="text-blue-600" /> : <Edit2 size={12} />}
                              </button>
                              <button 
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                                title="Delete order"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Bottom Grand Total Row (G.Total - Exactly matching the image) */}
                <tfoot className="sticky bottom-0 z-30 bg-white font-black text-slate-900 border-t-2 border-slate-400 shadow-[0_-2px_4px_rgba(0,0,0,0.05)] text-[11px]">
                  <tr className="bg-white border-b border-slate-300">
                    {/* Index blank */}
                    <td className="w-10 px-1 py-2 border-r border-slate-300 bg-slate-200 text-center sticky left-0 z-40"></td>

                    {/* G.Total Label */}
                    <td className="px-2 py-2 border-r border-slate-300 text-left sticky left-10 bg-white z-30 font-black text-xs text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]" colSpan={4}>
                      G.Total
                    </td>

                    {/* Ord Qty */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white font-black text-slate-900">
                      {formatNumber(filteredSubtotals.ordQty)}
                    </td>

                    {/* TTL. W. Received */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white font-black text-slate-900">
                      {formatNumber(filteredSubtotals.wRecv)}
                    </td>

                    {/* TTL. W. Delivery */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white font-black text-slate-900">
                      {formatNumber(filteredSubtotals.wDeli)}
                    </td>

                    {/* Wash WIP Qty (Yellow cell in image) */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-[#ffff00] text-slate-900 font-black">
                      {formatNumber(filteredSubtotals.wip)}
                    </td>

                    {/* Wash Ready Qty (Yellow cell in image) */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-[#ffff00] text-slate-900 font-black">
                      {formatNumber(filteredSubtotals.wReady)}
                    </td>

                    {/* Wash Target Qty (Peach cell in image with red text) */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-[#ffc9bb] text-[#c00000] font-black">
                      {formatNumber(filteredSubtotals.target)}
                    </td>

                    {/* Ship Qty (23-Sep) (Peach cell in image with red text) */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-[#ffc9bb] text-[#c00000] font-black">
                      {formatNumber(filteredSubtotals.ship23)}
                    </td>

                    {/* Wash. Target Qty (23-Sep) SUMIF (>0) in image: 4,336 */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white text-slate-900 font-black" title='SUMIF(L3:L56, ">0")'>
                      {formatNumber(filteredSubtotals.posTarget23)}
                    </td>

                    {/* Sew. RFD 23-Sep SUMIF (>0) in image: 3,783 */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white text-slate-900 font-black" title='SUMIF(M3:M56, ">0")'>
                      {formatNumber(filteredSubtotals.posRfd23)}
                    </td>

                    {/* Ship Qty (26-Sep) (Peach cell in image with red text) */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-[#ffc9bb] text-[#c00000] font-black">
                      {formatNumber(filteredSubtotals.ship26)}
                    </td>

                    {/* Wash. Target Qty (26-Sep) SUMIF (>0) in image: 72,430 */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white text-slate-900 font-black" title='SUMIF(O3:O56, ">0")'>
                      {formatNumber(filteredSubtotals.posTarget26)}
                    </td>

                    {/* Sew. RFD 26-Sep SUMIF (>0) in image: 32,985 */}
                    <td className="px-2 py-2 border-r border-slate-300 text-right bg-white text-slate-900 font-black" title='SUMIF(P3:P56, ">0")'>
                      {formatNumber(filteredSubtotals.posRfd26)}
                    </td>

                    {/* Remarks column blank */}
                    <td className="px-2 py-2 bg-white border-slate-300"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Hint & Formula bar */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-blue-600 flex-shrink-0" />
                <span>Tip: <strong>Double-click</strong> any row to edit values inline. Click any header filter arrow <strong>▼</strong> to sort and filter like Excel.</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
                <span><strong className="text-slate-700">WIP</strong> = Recv - Deli</span>
                <span>•</span>
                <span><strong className="text-slate-700">Target</strong> = WIP - Ready</span>
                <span>•</span>
                <span><strong className="text-slate-700">Wash Target</strong> = Ship - Deli</span>
                <span>•</span>
                <span><strong className="text-slate-700">Sew RFD</strong> = Ship - Recv</span>
                <span>•</span>
                <span><strong className="text-slate-700">Shortage Box</strong> = 4,336 + 72,430 = <strong>76,766</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: COUNTRY-WISE CUTOFF INPUT ================= */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Paste Excel Data (H&M Cutoff)</h2>
                <p className="text-xs text-slate-500">Paste tab-separated TSV from Excel or CSV with shipment dates and colors</p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">Required: Job ref, Colour, Order Qty., Shipment date</span>
            </div>
            
            <textarea 
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              className="w-full h-44 p-3 border-2 border-slate-200 rounded-xl font-mono text-xs focus:border-blue-500 outline-none"
              placeholder="Week&#9;ERP Ship Date&#9;Job ref&#9;Style No&#9;Colour&#9;Country&#9;Order Qty.&#9;Shipment date&#9;FLOOR..."
            />
            
            <div className="flex items-center justify-between">
              <button 
                onClick={handlePasteData}
                className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2 shadow-xs"
              >
                <Upload size={15} />
                Process Cutoff Data
              </button>
              
              {cutoffData.length > 0 && (
                <button 
                  onClick={() => setCutoffData([])}
                  className="text-xs text-red-600 font-semibold hover:underline"
                >
                  Clear Imported Cutoff Data
                </button>
              )}
            </div>

            {cutoffData.length > 0 && (
              <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2 border-b font-bold text-xs text-slate-700 flex justify-between items-center">
                  <span>Imported Cutoff Preview ({cutoffData.length} records)</span>
                  <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Ready for Pivot &amp; Risk</span>
                </div>
                <div className="overflow-x-auto max-h-[360px]">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 border-b">
                      <tr>
                        {Object.keys(cutoffData[0]).map(k => (
                          <th key={k} className="px-3 py-2 font-bold text-slate-700 text-[11px] uppercase border-r">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {cutoffData.slice(0, 60).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-3 py-1.5 border-r">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: AUTO PIVOT MATRIX ================= */}
        {activeTab === 'pivot' && (
          <div>
            {!pivotData.dates.length ? (
              <div className="text-center py-16 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-25 text-slate-400" />
                <p className="font-bold text-slate-700">No Cutoff Data Available For Pivot</p>
                <p className="text-xs text-slate-400 mt-1">Please paste or upload buyer cutoff data in Tab 2 first.</p>
                <button 
                  onClick={() => setActiveTab('input')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                >
                  Go to Cutoff Input
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-[11px] text-left border-collapse min-w-max">
                  <thead className="bg-[#dce6f1] text-[10px] uppercase font-bold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 border border-slate-300">Sum of Order Qty.</th>
                      <th className="px-3 py-2 border border-slate-300 text-center" colSpan={pivotData.dates.length + 1}>Ship Date Breakdown</th>
                    </tr>
                    <tr>
                      <th className="px-3 py-2 border border-slate-300 bg-[#dce6f1]">ERP / File / Job</th>
                      {pivotData.dates.map(d => (
                        <th key={d} className="px-3 py-2 border border-slate-300 text-center">{d}</th>
                      ))}
                      <th className="px-3 py-2 border border-slate-300 text-center bg-blue-100">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pivotData.rows.map((row, idx) => {
                      if (row.isGroup) {
                        return (
                          <tr key={`group-${idx}`} className="bg-slate-50 font-bold border-t-2 border-slate-300">
                            <td className="px-3 py-2 border border-slate-300 font-mono">[-] {row.file}</td>
                            {pivotData.dates.map(d => {
                              let dtTotal = 0;
                              Object.values(pivotData.rawGrouped[row.file]).forEach((colorData: any) => {
                                dtTotal += (colorData[d] || 0);
                              });
                              return (
                                <td key={d} className="px-3 py-2 border border-slate-300 text-center font-bold text-slate-800">
                                  {dtTotal > 0 ? formatNumber(dtTotal) : ''}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 border border-slate-300 text-center bg-blue-50/50 font-black">{formatNumber(row.total)}</td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={`row-${idx}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2 border border-slate-300 pl-8 text-slate-600">{row.color}</td>
                            {pivotData.dates.map(d => (
                              <td key={d} className="px-3 py-2 border border-slate-300 text-center font-medium">
                                {row.data[d] > 0 ? formatNumber(row.data[d]) : ''}
                              </td>
                            ))}
                            <td className="px-3 py-2 border border-slate-300 text-center font-bold bg-slate-50/50">{formatNumber(row.data.total)}</td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                  <tfoot className="bg-[#dce6f1] font-bold">
                    <tr>
                      <td className="px-3 py-2 border border-slate-300 text-right">Grand Total</td>
                      {pivotData.dates.map(d => {
                        let gdTotal = 0;
                        pivotData.rows.forEach(r => {
                          if (!r.isGroup) gdTotal += (r.data[d] || 0);
                        });
                        return (
                          <td key={d} className="px-3 py-2 border border-slate-300 text-center">{formatNumber(gdTotal)}</td>
                        );
                      })}
                      <td className="px-3 py-2 border border-slate-300 text-center bg-blue-200">
                        {formatNumber(pivotData.rows.reduce((sum, r) => r.isGroup ? sum + r.total : sum, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: RISK ANALYSIS ================= */}
        {activeTab === 'risk' && (
          <div>
            {!pivotData.dates.length && (
              <div className="mb-4 p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
                <span>Showing baseline floor analysis. For live buyer cutoff reconciliation, paste data in Tab 2.</span>
              </div>
            )}
            
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[650px]">
              <table className="w-full text-[10px] text-left border-collapse min-w-max">
                <thead className="bg-[#f8fafc] uppercase font-bold text-slate-700 border-b border-slate-300 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-2 border-r bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[140px]" rowSpan={2}>ERP Plan / File</th>
                    <th className="px-2 py-2 border-r bg-yellow-100 text-yellow-900 text-center" colSpan={pivotData.dates.length || 4}>Ship Qty Pcs of TOD</th>
                    <th className="px-2 py-2 border-r bg-pink-100 text-pink-900 text-center" rowSpan={2}>Total Ship Qty</th>
                    <th className="px-2 py-2 border-r bg-purple-100 text-purple-900 text-center" rowSpan={2}>ERP Qty</th>
                    <th className="px-2 py-2 border-r bg-emerald-100 text-emerald-900 text-center" colSpan={3}>Wash Progress</th>
                    <th className="px-2 py-2 border-r bg-orange-100 text-orange-900 text-center" colSpan={2}>Shortage / Needs</th>
                    <th className="px-2 py-2 border-r bg-blue-100 text-blue-900 text-center" colSpan={5}>Planning</th>
                  </tr>
                  <tr>
                    {(pivotData.dates.length ? pivotData.dates : ['20-May', '30-May', '3-Jun', '6-Jun']).map(d => (
                      <th key={d} className="px-2 py-1 border-r border-t bg-yellow-50 text-yellow-800 text-center whitespace-nowrap">{d}</th>
                    ))}
                    
                    <th className="px-2 py-1 border-r border-t bg-emerald-50 text-emerald-800 text-center">W.Recv (RFD)</th>
                    <th className="px-2 py-1 border-r border-t bg-emerald-50 text-emerald-800 text-center">W.Deli (Wash)</th>
                    <th className="px-2 py-1 border-r border-t bg-emerald-50 text-emerald-800 text-center">W.Bln (WIP)</th>

                    <th className="px-2 py-1 border-r border-t bg-orange-50 text-orange-800 text-center leading-tight">Need RFD<br />from Sew</th>
                    <th className="px-2 py-1 border-r border-t bg-orange-50 text-orange-800 text-center leading-tight">Need Wash<br />Close</th>

                    <th className="px-2 py-1 border-r border-t bg-blue-50 text-blue-800 text-center">Wash Ready</th>
                    <th className="px-2 py-1 border-r border-t bg-blue-50 text-blue-800 text-center">Wash Daily Target</th>
                    <th className="px-2 py-1 border-r border-t bg-blue-50 text-blue-800 text-center">Wash TTL</th>
                    <th className="px-2 py-1 border-r border-t bg-red-50 text-red-800 text-center">Sew Plan Miss</th>
                    <th className="px-2 py-1 border-r border-t bg-blue-50 text-blue-800 text-center">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {riskAnalysisData.map((group: any, groupIdx) => (
                    <React.Fragment key={groupIdx}>
                      <tr className="bg-slate-100 font-bold border-y-2 border-slate-300">
                        <td className="px-2 py-1.5 border-r text-rose-700 bg-slate-100 sticky left-0 z-10 w-[140px]" colSpan={1}>{group.name}</td>
                        {(pivotData.dates.length ? pivotData.dates : [1,2,3,4]).map((d, i) => (
                          <td key={i} className="px-2 py-1.5 border-r text-center"></td>
                        ))}
                        <td className="px-2 py-1.5 border-r text-center bg-pink-50/50"></td>
                        <td className="px-2 py-1.5 border-r text-center bg-purple-50/30"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                        <td className="px-2 py-1.5 border-r text-center"></td>
                      </tr>

                      {group.items.map((row: any, idx: number) => {
                        const totalShip = row.shipTargets?.total || 0;
                        const wBln = Math.max(0, row.wRecv - row.wDeli);
                        const needRfd = Math.max(0, totalShip - row.wRecv);
                        const needWash = Math.max(0, totalShip - row.wDeli);
                        
                        return (
                          <tr key={`${groupIdx}-${idx}`} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-2 py-1.5 border-r sticky left-0 z-10 w-[140px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              <div className="font-bold text-slate-800 font-mono">{row.erpId}</div>
                              <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{row.washType}</div>
                            </td>
                            {(pivotData.dates.length ? pivotData.dates : [1,2,3,4]).map(d => (
                              <td key={d} className="px-2 py-1.5 border-r text-center font-bold text-slate-700">
                                {row.shipTargets && row.shipTargets[d] ? formatNumber(row.shipTargets[d]) : ''}
                              </td>
                            ))}
                            
                            <td className="px-2 py-1.5 border-r text-center font-bold text-pink-700 bg-pink-50/50">{formatNumber(totalShip)}</td>
                            <td className="px-2 py-1.5 border-r text-center font-bold text-purple-700">{formatNumber(row.erpQty)}</td>
                            
                            <td className="px-2 py-1.5 border-r text-center text-emerald-700 font-medium">{formatNumber(row.wRecv)}</td>
                            <td className="px-2 py-1.5 border-r text-center text-emerald-700 font-medium">{formatNumber(row.wDeli)}</td>
                            <td className="px-2 py-1.5 border-r text-center font-bold text-amber-700 bg-amber-50/40">{formatNumber(wBln)}</td>
                            
                            <td className="px-2 py-1.5 border-r text-center font-bold text-orange-700 bg-orange-50/50">{formatNumber(needRfd)}</td>
                            <td className="px-2 py-1.5 border-r text-center font-bold text-orange-700 bg-orange-50/50">{formatNumber(needWash)}</td>
                            <td className="px-2 py-1.5 border-r text-center text-slate-700">{formatNumber(Math.max(0, wBln))}</td>
                            <td className="px-2 py-1.5 border-r text-center text-slate-800 bg-yellow-100 font-bold">{formatNumber(Math.ceil(needWash / 4))}</td>
                            <td className="px-2 py-1.5 border-r text-center text-slate-700 font-bold bg-green-50">0</td>
                            <td className="px-2 py-1.5 border-r text-center text-red-600 font-bold bg-red-50">{formatNumber(Math.max(0, needRfd - 500))}</td>
                            <td className="px-2 py-1.5 border-r text-center text-slate-500 font-medium">INCTL</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Row Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Order To H&M Ship TOD Plan</h3>
                <p className="text-xs text-slate-500">Enter order and shipment cutoff target details</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRow} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sew. Floor</label>
                  <select 
                    value={newRow.floor} 
                    onChange={e => setNewRow({ ...newRow, floor: e.target.value })}
                    className="w-full border rounded-lg p-2 font-bold bg-slate-50 text-slate-800"
                  >
                    <option value="1st.F">1st.F</option>
                    <option value="2nd.F">2nd.F</option>
                    <option value="Gnd.F">Gnd.F</option>
                    <option value="KF">KF</option>
                    <option value="B2B">B2B</option>
                    <option value="Unit 2 (Out-Side)">Unit 2 (Out-Side)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">W. Plan</label>
                  <select 
                    value={newRow.wPlan} 
                    onChange={e => setNewRow({ ...newRow, wPlan: e.target.value })}
                    className="w-full border rounded-lg p-2 font-bold bg-slate-50 text-slate-800"
                  >
                    <option value="INCTL">INCTL</option>
                    <option value="Taj Wash">Taj Wash</option>
                    <option value="B2B">B2B</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ERP/File/Job *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 111-8580"
                    value={newRow.job} 
                    onChange={e => setNewRow({ ...newRow, job: e.target.value })}
                    className="w-full border rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Color Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 09-103"
                    value={newRow.color} 
                    onChange={e => setNewRow({ ...newRow, color: e.target.value })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ord Qty</label>
                  <input 
                    type="number" 
                    value={newRow.ordQty || ''} 
                    onChange={e => setNewRow({ ...newRow, ordQty: parseInt(e.target.value) || 0 })}
                    className="w-full border bg-white rounded-lg p-2 font-bold text-slate-800"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">TTL. W. Received</label>
                  <input 
                    type="number" 
                    value={newRow.wRecv || ''} 
                    onChange={e => setNewRow({ ...newRow, wRecv: parseInt(e.target.value) || 0 })}
                    className="w-full border bg-white rounded-lg p-2 font-bold text-emerald-700"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">TTL. W. Delivery</label>
                  <input 
                    type="number" 
                    value={newRow.wDeli || ''} 
                    onChange={e => setNewRow({ ...newRow, wDeli: parseInt(e.target.value) || 0 })}
                    className="w-full border bg-white rounded-lg p-2 font-bold text-emerald-700"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Wash Ready Qty</label>
                  <input 
                    type="number" 
                    value={newRow.wReady || ''} 
                    onChange={e => setNewRow({ ...newRow, wReady: parseInt(e.target.value) || 0 })}
                    className="w-full border bg-white rounded-lg p-2 font-bold text-slate-800"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Shipment Cutoff Buckets */}
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                <span className="text-[11px] font-bold text-blue-900 block mb-2 uppercase tracking-wide">Shipment Cutoff Dates</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ship Qty (23-Sep)</label>
                    <input 
                      type="number" 
                      value={newRow.ship23 || ''} 
                      onChange={e => setNewRow({ ...newRow, ship23: parseInt(e.target.value) || 0 })}
                      className="w-full border bg-white rounded-lg p-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ship Qty (26-Sep)</label>
                    <input 
                      type="number" 
                      value={newRow.ship26 || ''} 
                      onChange={e => setNewRow({ ...newRow, ship26: parseInt(e.target.value) || 0 })}
                      className="w-full border bg-white rounded-lg p-2"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Remarks</label>
                <input 
                  type="text" 
                  placeholder="e.g. 500 pcs tom at 8pm"
                  value={newRow.remarks} 
                  onChange={e => setNewRow({ ...newRow, remarks: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newRow.isYellowJob} 
                    onChange={e => setNewRow({ ...newRow, isYellowJob: e.target.checked })} 
                  />
                  <span className="font-semibold text-slate-700">Highlight Color Yellow</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newRow.isRedJob} 
                    onChange={e => setNewRow({ ...newRow, isRedJob: e.target.checked })} 
                  />
                  <span className="font-semibold text-red-600">Red Alert Text (Critical Shortage)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Save Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
