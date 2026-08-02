import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DailyLog } from '../lib/api';
import { Download, Filter, Search, History, X, Calendar, FileText, CheckCircle2, PlusCircle, Wrench, Clock, ShieldAlert, WashingMachine, Cpu, AlertTriangle, Database, FileSpreadsheet } from 'lucide-react';
import { formatNumber, formatDate } from '../lib/utils';
import { BUYERS } from '../lib/constants';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function DataBank() {
  const [activeTab, setActiveTab] = useState<'archive' | 'maintenance'>('archive');
  const [filters, setFilters] = useState({
    buyer: '',
    from_date: '',
    to_date: '',
    file_no: '',
    wash_type: ''
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { data: archiveData, isLoading } = useQuery({
    queryKey: ['archiveData', filters],
    queryFn: () => api.getArchiveData(filters)
  });

  const { data: orderLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ['orderLogs', selectedOrderId],
    queryFn: () => api.getOrderLogs(selectedOrderId!),
    enabled: !!selectedOrderId
  });

  // Queries for washing machine load operational data and machines masters
  const { data: mcLoads = [] } = useQuery({
    queryKey: ['washMcLoads'],
    queryFn: async () => {
      const res = await fetch('/api/db/wash_mc_loads');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: dbMachines = [] } = useQuery({
    queryKey: ['washMachinesMaster'],
    queryFn: async () => {
      const res = await fetch('/api/db/wash_machines');
      if (!res.ok) return [];
      return res.json();
    }
  });

  const maintenancePredictions = useMemo(() => {
    const defaultMachines = [
      { name: 'Belly Washer #1 (MC-01)', code: 'MC-01', capacity_kg: 500, type: 'Belly Washer', status: 'Operational' },
      { name: 'Belly Washer #2 (MC-02)', code: 'MC-02', capacity_kg: 350, type: 'Belly Washer', status: 'Operational' },
      { name: 'Front Load #1 (MC-03)', code: 'MC-03', capacity_kg: 250, type: 'Front Load', status: 'Operational' },
      { name: 'Front Load #2 (MC-04)', code: 'MC-04', capacity_kg: 200, type: 'Front Load', status: 'Operational' },
      { name: 'Sample Washer (MC-05)', code: 'MC-05', capacity_kg: 50, type: 'Sample Washer', status: 'Operational' },
    ];
    
    const machines = dbMachines.length > 0 ? dbMachines : defaultMachines;

    const mcHours: Record<string, number> = {};
    const mcBatchCount: Record<string, number> = {};
    const mcCompletedCount: Record<string, number> = {};

    mcLoads.forEach((load: any) => {
      const mcCodeMatch = String(load.mc_number || '').match(/MC-\d+/);
      const mcCode = mcCodeMatch ? mcCodeMatch[0] : String(load.mc_number || '').split(' ')[0] || 'MC-01';
      
      const durationMins = Number(load.process_time_mins) || 0;
      const durationHours = durationMins / 60;

      mcHours[mcCode] = (mcHours[mcCode] || 0) + durationHours;
      mcBatchCount[mcCode] = (mcBatchCount[mcCode] || 0) + 1;
      if (load.status === 'Completed') {
        mcCompletedCount[mcCode] = (mcCompletedCount[mcCode] || 0) + 1;
      }
    });

    return machines.map((m: any) => {
      const totalHours = Math.round((mcHours[m.code] || 0) * 10) / 10;
      const batches = mcBatchCount[m.code] || 0;
      const completedBatches = mcCompletedCount[m.code] || 0;

      let thresholdHours = 100;
      if (m.type === 'Front Load') thresholdHours = 120;
      else if (m.type === 'Sample Washer') thresholdHours = 80;
      else if (m.type === 'Hydro Extractor') thresholdHours = 150;
      else if (m.type === 'Tumble Dryer') thresholdHours = 90;

      const initialHoursOffset = (m.code === 'MC-01' ? 74.5 : m.code === 'MC-02' ? 92.0 : m.code === 'MC-03' ? 24.0 : 45.0);
      const cumulativeHours = initialHoursOffset + totalHours;
      
      const cyclesCompleted = Math.floor(cumulativeHours / thresholdHours);
      const currentCycleHours = cumulativeHours % thresholdHours;
      const remainingHours = Math.round((thresholdHours - currentCycleHours) * 10) / 10;
      const progressPct = Math.min(100, Math.round((currentCycleHours / thresholdHours) * 100));

      let urgentAlert = false;
      let statusText = 'Normal - Active';
      let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
      
      if (remainingHours < 15) {
        urgentAlert = true;
        statusText = 'Urgent Maintenance Required';
        statusColor = 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse';
      } else if (remainingHours < 35) {
        statusText = 'Attention Needed Soon';
        statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
      }

      let recommendedTasks: string[] = [];
      if (m.type === 'Belly Washer') {
        recommendedTasks = [
          'Lubricate main drum bearings & gear shaft couplings',
          'Inspect door gasket seals for chemical erosion',
          'Check drive V-belt tension & motor pulleys',
          'Calibrate temperature sensor & steam injection solenoid valves'
        ];
      } else if (m.type === 'Front Load') {
        recommendedTasks = [
          'Inspect front-door latch safety interlocks',
          'Check drum shock absorbers & suspension springs',
          'Clean chemical flush manifold & dosing line inlets',
          'Check drainage valve seals for thread & fiber clogging'
        ];
      } else if (m.type === 'Sample Washer') {
        recommendedTasks = [
          'Clean glass inspection door & pressure seals',
          'Inspect small drum drive belt & grease bearings',
          'Clean steam exhaust bypass line & check pressure sensor'
        ];
      } else {
        recommendedTasks = [
          'Vacuum primary exhaust ducts & lint screens',
          'Inspect drive shaft bearing lubrication',
          'Test brake pads & hydraulic cylinder pressure'
        ];
      }

      return {
        ...m,
        cumulativeHours: Math.round(cumulativeHours * 10) / 10,
        totalHoursPlanned: totalHours,
        batches,
        completedBatches,
        thresholdHours,
        remainingHours,
        progressPct,
        urgentAlert,
        statusText,
        statusColor,
        recommendedTasks
      };
    });
  }, [mcLoads, dbMachines]);

  const handleExportExcel = () => {
    if (!archiveData || archiveData.length === 0) {
      toast.warning("No data to export");
      return;
    }

    try {
      const exportedData = archiveData.map(item => ({
        'Buyer': item.buyer,
        'File No': item.file_no,
        'Style No': item.style_no,
        'Order Qty': item.order_qty,
        'Total Received': item.total_received,
        'Total Delivered': item.total_delivered,
        'Close Date': item.close_date ? item.close_date.split('T')[0] : '',
        'Final Del Qty': item.final_delivered_qty,
        'Wash Type': item.wash_type,
        'Sew Floor': item.sew_floor,
        'Closed By': item.closed_by,
        'Locked At': item.locked_at ? item.locked_at.split('T')[0] : ''
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportedData);

      // Auto-fit column widths
      const colWidths = [
        { wch: 16 }, // Buyer
        { wch: 14 }, // File No
        { wch: 16 }, // Style No
        { wch: 12 }, // Order Qty
        { wch: 15 }, // Total Received
        { wch: 15 }, // Total Delivered
        { wch: 13 }, // Close Date
        { wch: 15 }, // Final Del Qty
        { wch: 16 }, // Wash Type
        { wch: 12 }, // Sew Floor
        { wch: 14 }, // Closed By
        { wch: 13 }, // Locked At
      ];
      ws['!cols'] = colWidths;

      // Add to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Archive Records");

      // Write file
      XLSX.writeFile(wb, `inctl_wash_erp_archive_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel Report exported successfully");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Failed to export Excel spreadsheet");
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      {/* Tab Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 font-bold text-sm rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'archive'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Database size={16} />
            Archive Records
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 font-bold text-sm rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'maintenance'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Wrench size={16} />
            Machine Maintenance Predictor
          </button>
        </div>

        {activeTab === 'archive' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportExcel}
              disabled={isLoading || archiveData?.length === 0}
              className="flex items-center justify-center gap-2 bg-[#107c41] hover:bg-[#0b592e] disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors text-sm shrink-0"
              title="Export current filtered archive records to Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export to Excel
            </button>
          </div>
        )}
      </div>

      {activeTab === 'archive' && (
        <>
          {/* Filters */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Buyer</label>
                <select 
                  value={filters.buyer}
                  onChange={e => handleFilterChange('buyer', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                  <option value="">All Buyers</option>
                  {BUYERS.map((buyer) => (
                    <option key={buyer} value={buyer}>{buyer}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">From Date</label>
                <input 
                  type="date"
                  value={filters.from_date}
                  onChange={e => handleFilterChange('from_date', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                </input>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
                <input 
                  type="date"
                  value={filters.to_date}
                  onChange={e => handleFilterChange('to_date', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                </input>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">File No</label>
                <div className="relative">
                  <input 
                    type="text"
                    value={filters.file_no}
                    onChange={e => handleFilterChange('file_no', e.target.value)}
                    className="w-full pl-8 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                    placeholder="Search..."
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Wash Type</label>
                <select 
                  value={filters.wash_type}
                  onChange={e => handleFilterChange('wash_type', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                  <option value="">All Wash</option>
                  <option value="Acid Wash">Acid Wash</option>
                  <option value="Enzyme Wash">Enzyme Wash</option>
                  <option value="Spray Wash">Spray Wash</option>
                  <option value="Normal Wash">Normal Wash</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buyer</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">File No</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Style / Color</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Order Qty</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total Rcv</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total Del</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Final Del</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Close Date</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Wash Type</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center min-w-[80px]">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm bg-white">
                  {isLoading ? (
                    <tr><td colSpan={10} className="px-6 py-12 text-center text-slate-500 italic">Loading archive records...</td></tr>
                  ) : archiveData?.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <p className="italic">No archived records found matching criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    archiveData?.map((item) => (
                      <tr key={item.id} className="hover:bg-blue-50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-800">{item.buyer}</td>
                        <td className="px-6 py-4 text-blue-600 font-medium font-mono">{item.file_no}</td>
                        <td className="px-6 py-4 flex flex-col">
                          <span className="text-slate-700">{item.style_no || '-'}</span>
                          {item.color && <span className="text-[10px] text-slate-400 mt-0.5">{item.color}</span>}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">{formatNumber(item.order_qty)}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-emerald-600 font-medium">{formatNumber(item.total_received)}</td>
                        <td className="px-6 py-4 text-right tabular-nums text-orange-600 font-medium">{formatNumber(item.total_delivered)}</td>
                        <td className="px-6 py-4 text-right tabular-nums font-bold text-slate-800 bg-slate-50/50">{formatNumber(item.final_delivered_qty)}</td>
                        <td className="px-6 py-4 text-center text-slate-600 tabular-nums">{formatDate(item.close_date)}</td>
                        <td className="px-6 py-4 text-center font-mono">
                           <span className="px-2 py-1 bg-slate-100 rounded text-[9px] uppercase font-bold text-slate-600">{item.wash_type}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => setSelectedOrderId(item.erp_order)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                            title="View Detailed Transaction Logs"
                          >
                            <History size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'maintenance' && (
        <div className="space-y-6 flex-1 overflow-auto pr-1">
          {/* KPI Cards for Maintenance */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Machines</p>
              <p className="text-3xl font-light text-slate-800 mt-1">{maintenancePredictions.length}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Operational Hours</p>
              <p className="text-3xl font-light text-blue-600 mt-1">
                {formatNumber(maintenancePredictions.reduce((acc, m) => acc + m.cumulativeHours, 0))} <span className="text-sm font-normal text-slate-400">hrs</span>
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Processed Batches</p>
              <p className="text-3xl font-light text-emerald-600 mt-1">
                {formatNumber(maintenancePredictions.reduce((acc, m) => acc + m.batches, 0))} <span className="text-sm font-normal text-slate-400">batches</span>
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Urgent Action Warnings</p>
              <p className="text-3xl font-light text-rose-600 mt-1">
                {maintenancePredictions.filter(m => m.urgentAlert).length} <span className="text-sm font-normal text-slate-400">alerts</span>
              </p>
            </div>
          </div>

          {/* Section Description */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Cpu className="text-blue-600" size={16} />
              Washing Floor Smart Prediction Engine
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This intelligence planner aggregates cumulative machine runtimes calculated inside existing load plans and correlates usage with standard physical limits. Machine health cycles degrade proportionally with total wet process runtimes (Process Time in mins), predicting the remaining margin before manual mechanical inspections, belt tunings, and lubrication cycles are enforced.
            </p>
          </div>

          {/* Grid of machines */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {maintenancePredictions.map((m) => (
              <div key={m.code} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.type}</span>
                    <h4 className="font-black text-slate-800 text-sm mt-0.5">{m.name}</h4>
                  </div>
                  <span className={`px-2 py-1 rounded text-[9px] uppercase font-extrabold border ${m.statusColor}`}>
                    {m.statusText}
                  </span>
                </div>

                {/* Hours Metric grid */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Operational</p>
                    <p className="text-sm font-bold text-slate-700 font-mono">{m.cumulativeHours}h</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Plan Loads</p>
                    <p className="text-sm font-bold text-blue-600 font-mono">{m.batches}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Limit (hrs)</p>
                    <p className="text-sm font-bold text-slate-500 font-mono">{m.thresholdHours}h</p>
                  </div>
                </div>

                {/* Progress bar to maintenance */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Health Degradation</span>
                    <span className={`font-bold font-mono ${m.urgentAlert ? 'text-rose-600' : 'text-slate-600'}`}>{m.progressPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        m.urgentAlert 
                          ? 'bg-rose-500' 
                          : m.progressPct > 70 
                            ? 'bg-amber-500' 
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${m.progressPct}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 font-bold">
                    <span className="text-slate-400">CYCLE COMPLETED: {Math.floor(m.cumulativeHours / m.thresholdHours)}</span>
                    <span className={m.urgentAlert ? 'text-rose-600 animate-pulse' : 'text-slate-500'}>
                      {m.remainingHours} hrs remaining
                    </span>
                  </div>
                </div>

                {/* Recommended Tasks Checklist */}
                <div className="pt-3 border-t border-slate-100 space-y-2 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Wrench size={10} />
                    Recommended Maintenance Checklist:
                  </p>
                  <ul className="space-y-1.5">
                    {m.recommendedTasks.map((task: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-600">
                        <CheckCircle2 size={12} className="text-slate-300 mt-0.5 shrink-0" />
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Urgent Callout banner */}
                {m.urgentAlert && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-800 p-2.5 rounded-lg flex items-start gap-2 animate-pulse mt-3">
                    <AlertTriangle size={14} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-normal font-medium">
                      <strong>Critical Runtime Alert:</strong> Machine has breached safe running margins. Lock load sequencing & delegate physical bearing maintenance immediately.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in transition-all">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col scale-in-95 duration-200 my-8">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Order Logs History</h3>
                  <p className="text-xs text-slate-500">Comprehensive transaction record for ERP ID: {selectedOrderId.substring(0, 8)}...</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {loadingLogs ? (
                <div className="flex items-center justify-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : orderLogs?.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic">No transaction records found for this order</div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                     <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">First Receive</p>
                        <p className="text-lg font-bold text-emerald-900">{formatDate(orderLogs![orderLogs!.length - 1].log_date)}</p>
                     </div>
                     <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1">Last Delivery</p>
                        <p className="text-lg font-bold text-orange-900">{formatDate(orderLogs![0].log_date)}</p>
                     </div>
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total Logs</p>
                        <p className="text-lg font-bold text-blue-900">{orderLogs?.length || 0} Entries</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                    {orderLogs?.map((log, idx) => (
                      <div key={log.id} className="relative pl-8 border-l border-slate-100 pb-4">
                        <div className="absolute left-[-5px] top-0 w-[9px] h-[9px] rounded-full bg-blue-500 border-2 border-white"></div>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-2 text-slate-500 text-xs">
                               <Calendar size={12} />
                               <span className="font-medium">{formatDate(log.log_date)}</span>
                             </div>
                             <span className="text-[9px] px-2 py-0.5 bg-slate-100 rounded-full font-bold uppercase text-slate-500">{log.unit}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-8">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                 <PlusCircle size={14} className="rotate-0" />
                               </div>
                               <div>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase">Received</p>
                                 <p className="font-bold text-emerald-600">{formatNumber(log.received_qty)}</p>
                               </div>
                             </div>
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                 <History size={14} className="rotate-180" />
                               </div>
                               <div>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase">Delivered</p>
                                 <p className="font-bold text-orange-600">{formatNumber(log.delivered_qty)}</p>
                               </div>
                             </div>
                          </div>
                          {log.remarks && (
                            <div className="mt-3 pt-3 border-t border-slate-50 flex items-start gap-2 italic text-slate-400 text-[11px]">
                               <FileText size={12} className="mt-0.5 shrink-0" />
                               <span>{log.remarks}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedOrderId(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-900 transition-all active:scale-95"
              >
                Close History
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
