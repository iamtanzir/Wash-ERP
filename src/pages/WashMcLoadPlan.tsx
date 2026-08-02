import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  WashingMachine, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Printer, 
  ChevronRight, 
  Layers, 
  Flame, 
  Droplets, 
  Wind, 
  User, 
  Cpu, 
  RefreshCw,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import { api, Order } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export interface WashMcLoad {
  id?: string;
  load_no: string;
  mc_number: string;
  mc_capacity_kg: number;
  shift: 'Morning' | 'Evening' | 'Night';
  plan_date: string;
  buyer: string;
  file_no: string;
  style_no: string;
  color: string;
  order_id?: string;
  wet_process_type: 'Enzyme Wash' | 'Stone Wash' | 'Bleach Wash' | 'Tinting/Dyeing' | 'Softener Wash' | 'Bio Wash/Desize' | 'Acid Wash' | 'Normal Wash';
  chemical_recipe_code?: string;
  liquor_ratio?: string;
  water_temp_c?: number;
  process_time_mins: number;
  pcs_qty: number;
  avg_weight_per_pc_kg: number;
  total_weight_kg: number;
  capacity_utilization_pct: number;
  operator_name?: string;
  status: 'Planned' | 'In Washing' | 'Hydroing' | 'Drying' | 'Completed' | 'Cancelled';
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MachineMaster {
  id?: string;
  name: string;
  code: string;
  capacity_kg: number;
  type: 'Belly Washer' | 'Front Load' | 'Sample Washer' | 'Hydro Extractor' | 'Tumble Dryer';
  status: 'Operational' | 'Maintenance' | 'Idle';
}

const DEFAULT_MACHINES: MachineMaster[] = [
  { name: 'Belly Washer #1 (MC-01)', code: 'MC-01', capacity_kg: 500, type: 'Belly Washer', status: 'Operational' },
  { name: 'Belly Washer #2 (MC-02)', code: 'MC-02', capacity_kg: 350, type: 'Belly Washer', status: 'Operational' },
  { name: 'Front Load #1 (MC-03)', code: 'MC-03', capacity_kg: 250, type: 'Front Load', status: 'Operational' },
  { name: 'Front Load #2 (MC-04)', code: 'MC-04', capacity_kg: 200, type: 'Front Load', status: 'Operational' },
  { name: 'Sample Washer (MC-05)', code: 'MC-05', capacity_kg: 50, type: 'Sample Washer', status: 'Operational' },
  { name: 'Hydro Extractor (HE-01)', code: 'HE-01', capacity_kg: 200, type: 'Hydro Extractor', status: 'Operational' },
  { name: 'Tumble Dryer (TD-01)', code: 'TD-01', capacity_kg: 100, type: 'Tumble Dryer', status: 'Operational' },
];

export default function WashMcLoadPlan() {
  const queryClient = useQueryClient();
  const { isViewer, user } = useAuth();

  // Tab State
  const [viewMode, setViewMode] = useState<'schedule' | 'machines' | 'floor_board'>('schedule');

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState<string>('All');
  const [selectedMachine, setSelectedMachine] = useState<string>('All');
  const [selectedProcess, setSelectedProcess] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form Modal / Creation State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Load Form Fields
  const [mcNumber, setMcNumber] = useState<string>('MC-01 (Belly Washer 500Kg)');
  const [mcCapacityKg, setMcCapacityKg] = useState<number>(500);
  const [shift, setShift] = useState<'Morning' | 'Evening' | 'Night'>('Morning');
  const [planDate, setPlanDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [buyer, setBuyer] = useState<string>('');
  const [fileNo, setFileNo] = useState<string>('');
  const [styleNo, setStyleNo] = useState<string>('');
  const [color, setColor] = useState<string>('');
  const [wetProcessType, setWetProcessType] = useState<WashMcLoad['wet_process_type']>('Enzyme Wash');
  const [chemicalRecipeCode, setChemicalRecipeCode] = useState<string>('REC-ENZ-01');
  const [liquorRatio, setLiquorRatio] = useState<string>('1:8');
  const [waterTempC, setWaterTempC] = useState<number>(60);
  const [processTimeMins, setProcessTimeMins] = useState<number>(60);
  const [pcsQty, setPcsQty] = useState<number>(600);
  const [avgWeightPerPcKg, setAvgWeightPerPcKg] = useState<number>(0.50);
  const [operatorName, setOperatorName] = useState<string>(user?.username || 'Master Washer');
  const [remarks, setRemarks] = useState<string>('');

  // Printable Slip State
  const [printLoadItem, setPrintLoadItem] = useState<WashMcLoad | null>(null);

  // Machine Master Management State
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [newMcName, setNewMcName] = useState('');
  const [newMcCode, setNewMcCode] = useState('');
  const [newMcCap, setNewMcCap] = useState(300);
  const [newMcType, setNewMcType] = useState<MachineMaster['type']>('Front Load');

  // Query ERP Active Orders
  const { data: activeOrders = [] } = useQuery<Order[]>({
    queryKey: ['activeOrdersForMcPlan'],
    queryFn: () => api.getActiveOrders()
  });

  // Query Wash M/C Loads
  const { data: mcLoads = [], isLoading: loadingLoads, refetch: refetchLoads } = useQuery<WashMcLoad[]>({
    queryKey: ['washMcLoads'],
    queryFn: async () => {
      const res = await fetch('/api/db/wash_mc_loads');
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Query Machine Masters
  const { data: dbMachines = [] } = useQuery<MachineMaster[]>({
    queryKey: ['washMachinesMaster'],
    queryFn: async () => {
      const res = await fetch('/api/db/wash_machines');
      if (!res.ok) return [];
      const data = await res.json();
      return data.length > 0 ? data : DEFAULT_MACHINES;
    }
  });

  const availableMachines = useMemo(() => {
    return dbMachines.length > 0 ? dbMachines : DEFAULT_MACHINES;
  }, [dbMachines]);

  // Derived load math in form
  const computedTotalWeightKg = useMemo(() => {
    return Math.round((Number(pcsQty) || 0) * (Number(avgWeightPerPcKg) || 0) * 100) / 100;
  }, [pcsQty, avgWeightPerPcKg]);

  const computedCapacityPct = useMemo(() => {
    if (!mcCapacityKg || mcCapacityKg <= 0) return 0;
    return Math.round((computedTotalWeightKg / mcCapacityKg) * 100);
  }, [computedTotalWeightKg, mcCapacityKg]);

  // Handle order quick selection
  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    if (!orderId) return;
    const target = activeOrders.find(o => o.id === orderId);
    if (target) {
      setBuyer(target.buyer || '');
      setFileNo(target.file_no || '');
      setStyleNo(target.style_no || '');
      setColor(target.color || '');
      if (target.wash_type) {
        const wt = target.wash_type.toLowerCase();
        if (wt.includes('stone')) setWetProcessType('Stone Wash');
        else if (wt.includes('bleach')) setWetProcessType('Bleach Wash');
        else if (wt.includes('tint') || wt.includes('dye')) setWetProcessType('Tinting/Dyeing');
        else if (wt.includes('softener')) setWetProcessType('Softener Wash');
        else if (wt.includes('bio') || wt.includes('desize')) setWetProcessType('Bio Wash/Desize');
        else if (wt.includes('acid')) setWetProcessType('Acid Wash');
        else setWetProcessType('Enzyme Wash');
      }
    }
  };

  // Handle machine dropdown selection in form
  const handleMachineSelect = (mcCode: string) => {
    const mc = availableMachines.find(m => m.code === mcCode || m.name === mcCode);
    if (mc) {
      setMcNumber(`${mc.code} (${mc.type} ${mc.capacity_kg}Kg)`);
      setMcCapacityKg(mc.capacity_kg);
    }
  };

  // Mutations
  const createLoadMutation = useMutation({
    mutationFn: async (payload: WashMcLoad) => {
      const res = await fetch('/api/db/wash_mc_loads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to create load plan');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washMcLoads'] });
      toast.success('Wash M/C Load Plan scheduled successfully!');
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error scheduling load plan');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WashMcLoad['status'] }) => {
      const res = await fetch(`/api/db/wash_mc_loads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('Status update failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washMcLoads'] });
      toast.success('M/C Load Status updated');
    }
  });

  const deleteLoadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/db/wash_mc_loads/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete load plan');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washMcLoads'] });
      toast.success('Wash Load Plan deleted');
    }
  });

  const addMachineMutation = useMutation({
    mutationFn: async (mc: MachineMaster) => {
      const res = await fetch('/api/db/wash_machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mc)
      });
      if (!res.ok) throw new Error('Failed to save machine');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['washMachinesMaster'] });
      toast.success('New Washing Machine added to Master!');
      setIsMachineModalOpen(false);
      setNewMcName('');
      setNewMcCode('');
    }
  });

  const resetForm = () => {
    setSelectedOrderId('');
    setBuyer('');
    setFileNo('');
    setStyleNo('');
    setColor('');
    setRemarks('');
    setPcsQty(600);
    setAvgWeightPerPcKg(0.50);
  };

  const handleSubmitLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyer || !styleNo) {
      return toast.error('Buyer and Style No are required.');
    }
    if (pcsQty <= 0) {
      return toast.error('Quantity must be greater than 0.');
    }

    const generatedLoadNo = `LOAD-${planDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

    const newLoad: WashMcLoad = {
      load_no: generatedLoadNo,
      mc_number: mcNumber,
      mc_capacity_kg: mcCapacityKg,
      shift,
      plan_date: planDate,
      buyer,
      file_no: fileNo,
      style_no: styleNo,
      color,
      order_id: selectedOrderId || undefined,
      wet_process_type: wetProcessType,
      chemical_recipe_code: chemicalRecipeCode,
      liquor_ratio: liquorRatio,
      water_temp_c: waterTempC,
      process_time_mins: Number(processTimeMins) || 60,
      pcs_qty: Number(pcsQty) || 0,
      avg_weight_per_pc_kg: Number(avgWeightPerPcKg) || 0,
      total_weight_kg: computedTotalWeightKg,
      capacity_utilization_pct: computedCapacityPct,
      operator_name: operatorName,
      status: 'Planned',
      remarks,
      created_at: new Date().toISOString()
    };

    createLoadMutation.mutate(newLoad);
  };

  // Filtered Loads Calculation
  const filteredLoads = useMemo(() => {
    return mcLoads.filter(item => {
      if (selectedDate && item.plan_date !== selectedDate) return false;
      if (selectedShift !== 'All' && item.shift !== selectedShift) return false;
      if (selectedMachine !== 'All' && !item.mc_number.includes(selectedMachine)) return false;
      if (selectedProcess !== 'All' && item.wet_process_type !== selectedProcess) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.load_no.toLowerCase().includes(q) ||
          item.buyer.toLowerCase().includes(q) ||
          item.style_no.toLowerCase().includes(q) ||
          item.file_no.toLowerCase().includes(q) ||
          item.color.toLowerCase().includes(q) ||
          item.mc_number.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mcLoads, selectedDate, selectedShift, selectedMachine, selectedProcess, searchQuery]);

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalPlannedKg = 0;
    let totalPcs = 0;
    let activeWashingCount = 0;
    let overCapacityCount = 0;

    filteredLoads.forEach(l => {
      totalPlannedKg += l.total_weight_kg || 0;
      totalPcs += l.pcs_qty || 0;
      if (l.status === 'In Washing' || l.status === 'Hydroing' || l.status === 'Drying') {
        activeWashingCount++;
      }
      if ((l.capacity_utilization_pct || 0) > 100) {
        overCapacityCount++;
      }
    });

    const avgUtilization = filteredLoads.length > 0
      ? Math.round(filteredLoads.reduce((acc, curr) => acc + (curr.capacity_utilization_pct || 0), 0) / filteredLoads.length)
      : 0;

    return { totalPlannedKg, totalPcs, activeWashingCount, overCapacityCount, avgUtilization };
  }, [filteredLoads]);

  // Wash Calculation Summary
  const washTimeSummary = useMemo(() => {
    let fullCalculationTime = 0;
    const mcWiseTime: Record<string, number> = {};

    filteredLoads.forEach(l => {
      const time = l.process_time_mins || 0;
      fullCalculationTime += time;
      
      // Simplify machine name for grouping (e.g. MC-01)
      const mcCodeMatch = l.mc_number.match(/MC-\d+|HE-\d+|TD-\d+/);
      const mcCode = mcCodeMatch ? mcCodeMatch[0] : l.mc_number.split(' (')[0];
      
      if (!mcWiseTime[mcCode]) {
        mcWiseTime[mcCode] = 0;
      }
      mcWiseTime[mcCode] += time;
    });

    // Sort machine-wise data
    const mcTimeList = Object.entries(mcWiseTime).map(([mc, time]) => ({ mc, time })).sort((a, b) => b.time - a.time);

    return { fullCalculationTime, mcTimeList };
  }, [filteredLoads]);

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 rounded-2xl shadow-xl border border-slate-800 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider flex items-center gap-1">
                <WashingMachine size={12} /> Wet Process Floor
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                Garments Washing MC Plan
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
              Wash M/C Load Plan
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Batch scheduling, liquor ratio, chemical recipe codes, load ratio calculation (% machine capacity) & wet process floor operations tracking.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!isViewer && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                <span>New Wash M/C Load</span>
              </button>
            )}
            <button
              onClick={() => setIsMachineModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <Cpu size={15} />
              <span>Machines Master</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Scheduled Kg</p>
            <p className="text-lg font-mono font-bold text-blue-400 mt-0.5">{formatNumber(stats.totalPlannedKg)} <span className="text-xs font-normal text-slate-400">Kg</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">Across {filteredLoads.length} Batches</p>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Scheduled Garments</p>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">{formatNumber(stats.totalPcs)} <span className="text-xs font-normal text-slate-400">Pcs</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">Garments Washing Plan</p>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg M/C Load Ratio</p>
            <p className={`text-lg font-mono font-bold mt-0.5 ${stats.avgUtilization > 100 ? 'text-red-400' : 'text-indigo-300'}`}>
              {stats.avgUtilization}% <span className="text-xs font-normal text-slate-400">Cap</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Target: 70% – 95%</p>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Active Wet Batches</p>
            <p className="text-lg font-mono font-bold text-amber-400 mt-0.5">{stats.activeWashingCount} <span className="text-xs font-normal text-slate-400">In Process</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">Washing / Hydro / Drying</p>
          </div>
        </div>
      </div>

      {/* Over Capacity Warning Alert if any batch exceeds 100% capacity */}
      {stats.overCapacityCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-xl flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Machine Over-Capacity Warning</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                {stats.overCapacityCount} batch(es) exceed 100% machine loading capacity. Please adjust quantity or split into multiple loads to prevent machine overload / poor wash result.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Control Toolbar: Date, Shift, Machine, Search & View Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* View Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'schedule'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Floor Schedule
            </button>
            <button
              onClick={() => setViewMode('floor_board')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === 'floor_board'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bay Machine Board
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search load #, buyer, style, color..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Multi Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Plan Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Shifts</option>
              <option value="Morning">Morning (06:00 - 14:00)</option>
              <option value="Evening">Evening (14:00 - 22:00)</option>
              <option value="Night">Night (22:00 - 06:00)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Washing Machine</label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Machines</option>
              {availableMachines.map(m => (
                <option key={m.code} value={m.code}>{m.code} - {m.name} ({m.capacity_kg}Kg)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wet Process Type</label>
            <select
              value={selectedProcess}
              onChange={(e) => setSelectedProcess(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Wet Processes</option>
              <option value="Enzyme Wash">Enzyme Wash</option>
              <option value="Stone Wash">Stone Wash</option>
              <option value="Bleach Wash">Bleach Wash</option>
              <option value="Tinting/Dyeing">Tinting / Dyeing</option>
              <option value="Softener Wash">Softener Wash</option>
              <option value="Bio Wash/Desize">Bio Wash / Desize</option>
              <option value="Acid Wash">Acid Wash</option>
              <option value="Normal Wash">Normal Wash</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calculation Summary UI */}
      {filteredLoads.length > 0 && (
        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Wash M/C Time Calculation Summary</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="bg-white p-3 rounded-lg border border-indigo-200 min-w-[200px] shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Full Calculation Time</p>
              <p className="text-2xl font-black text-indigo-700 mt-1">
                {Math.floor(washTimeSummary.fullCalculationTime / 60)}<span className="text-sm font-semibold text-slate-500 mx-1">h</span>
                {washTimeSummary.fullCalculationTime % 60}<span className="text-sm font-semibold text-slate-500 ml-1">m</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">{washTimeSummary.fullCalculationTime} Total Minutes</p>
            </div>
            
            <div className="flex-1 bg-white p-3 rounded-lg border border-indigo-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Machine-Wise Time Split</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {washTimeSummary.mcTimeList.map(item => (
                  <div key={item.mc} className="bg-slate-50 border border-slate-200 p-2 rounded-md">
                    <p className="text-[10px] font-bold text-slate-700 truncate">{item.mc}</p>
                    <p className="text-sm font-mono font-bold text-blue-700 mt-0.5">
                      {Math.floor(item.time / 60)}h {item.time % 60}m
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT VIEWS */}
      {viewMode === 'schedule' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Garments Washing M/C Loading Schedule</h3>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">
              Showing {filteredLoads.length} Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                  <th className="px-4 py-3">Load # / Date</th>
                  <th className="px-3 py-3">M/C & Shift</th>
                  <th className="px-3 py-3">Buyer & Style</th>
                  <th className="px-3 py-3">Color / File</th>
                  <th className="px-3 py-3">Wet Process & Recipe</th>
                  <th className="px-3 py-3 text-right">Qty (Pcs)</th>
                  <th className="px-3 py-3 text-right">Avg Wt / Total Kg</th>
                  <th className="px-3 py-3 text-center">Load Ratio (% Cap)</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                {loadingLoads ? (
                  <tr><td colSpan={10} className="text-center p-8 text-slate-400">Loading Wash M/C Load Plans...</td></tr>
                ) : filteredLoads.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center p-12 text-slate-400">
                      <WashingMachine size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No Washing Machine Load Plans found for selected criteria.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Click "New Wash M/C Load" above to schedule wet process loads.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLoads.map((item) => {
                    const capPct = item.capacity_utilization_pct || 0;
                    const isOverCap = capPct > 100;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div className="font-mono text-blue-700 font-bold">{item.load_no}</div>
                          <div className="text-[10px] text-slate-400">{formatDate(item.plan_date)}</div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-800 text-[11px]">{item.mc_number}</div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase mt-0.5">
                            {item.shift} Shift
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-800">{item.buyer}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{item.style_no}</div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="text-slate-700 font-medium">{item.color}</div>
                          <div className="text-[10px] text-slate-400 font-mono">File: {item.file_no || '-'}</div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {item.wet_process_type}
                          </span>
                          <div className="text-[10px] text-slate-500 font-mono mt-1">
                            {item.chemical_recipe_code ? `Recipe: ${item.chemical_recipe_code}` : ''} 
                            {item.liquor_ratio ? ` (${item.liquor_ratio})` : ''}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-slate-800 tabular-nums">
                          {formatNumber(item.pcs_qty)} <span className="text-[10px] text-slate-400 font-normal">pcs</span>
                        </td>

                        <td className="px-3 py-3 text-right tabular-nums">
                          <div className="font-bold text-slate-900">{formatNumber(item.total_weight_kg)} Kg</div>
                          <div className="text-[10px] text-slate-400">@{item.avg_weight_per_pc_kg} kg/pc</div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <div className="w-24 mx-auto space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className={isOverCap ? 'text-red-600' : 'text-slate-700'}>{capPct}%</span>
                              <span className="text-slate-400">{item.mc_capacity_kg}Kg</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${isOverCap ? 'bg-red-500' : capPct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, capPct)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <select
                            value={item.status}
                            disabled={isViewer}
                            onChange={(e) => updateStatusMutation.mutate({ id: item.id!, status: e.target.value as WashMcLoad['status'] })}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                              item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                              item.status === 'In Washing' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                              item.status === 'Hydroing' ? 'bg-indigo-50 text-indigo-700 border-indigo-300' :
                              item.status === 'Drying' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                              item.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-300' :
                              'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <option value="Planned">Planned</option>
                            <option value="In Washing">In Washing</option>
                            <option value="Hydroing">Hydroing</option>
                            <option value="Drying">Drying</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setPrintLoadItem(item)}
                              title="Print Machine Floor Slip"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Printer size={15} />
                            </button>
                            {!isViewer && (
                              <button
                                onClick={() => {
                                  if (confirm(`Delete Wash Load ${item.load_no}?`)) {
                                    deleteLoadMutation.mutate(item.id!);
                                  }
                                }}
                                title="Delete Load Plan"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* MACHINE BAY BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableMachines.map((mc) => {
            const mcLoads = filteredLoads.filter(l => l.mc_number.includes(mc.code));
            const mcTotalKg = mcLoads.reduce((acc, curr) => acc + (curr.total_weight_kg || 0), 0);
            const activeLoad = mcLoads.find(l => l.status === 'In Washing' || l.status === 'Hydroing' || l.status === 'Drying');

            return (
              <div key={mc.code} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center">
                      <WashingMachine size={18} className="text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs tracking-wide">{mc.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">Code: {mc.code} | Capacity: {mc.capacity_kg} Kg</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    activeLoad ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {activeLoad ? activeLoad.status : 'Idle / Ready'}
                  </span>
                </div>

                <div className="p-4 flex-1 space-y-4">
                  {/* Load Summary for this machine */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Scheduled Batches</span>
                      <span className="font-bold text-slate-800">{mcLoads.length} Batches</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Weight</span>
                      <span className="font-bold text-blue-700">{formatNumber(mcTotalKg)} Kg</span>
                    </div>
                  </div>

                  {/* List of loads for this machine */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {mcLoads.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400 italic">No wash loads scheduled for this machine today.</div>
                    ) : (
                      mcLoads.map((ld) => (
                        <div key={ld.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-900">{ld.buyer} - {ld.style_no}</span>
                            <span className="text-[10px] text-blue-700 font-mono">{ld.load_no}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex justify-between">
                            <span>{ld.color} ({ld.wet_process_type})</span>
                            <span className="font-bold">{ld.pcs_qty} pcs</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                            <span className="font-mono text-slate-500">{ld.total_weight_kg} Kg ({ld.capacity_utilization_pct}% Load)</span>
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              ld.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                              ld.status === 'In Washing' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                            }`}>{ld.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW LOAD PLAN MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 my-8">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <WashingMachine size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule Wash M/C Load</h3>
                  <p className="text-xs text-slate-500">Garments Washing Wet Process Machine Loading Plan</p>
                </div>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLoad} className="space-y-4">
              {/* Quick Select from Active ERP Order */}
              <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200/80">
                <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1 flex items-center gap-1">
                  <Sparkles size={12} className="text-blue-600" /> Auto-Fill from Active ERP Order (Optional)
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => handleOrderSelect(e.target.value)}
                  className="w-full text-xs border border-blue-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Choose Active ERP Order --</option>
                  {activeOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.buyer} | Style: {o.style_no} | File: {o.file_no} | Color: {o.color} ({o.order_qty} pcs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine & Shift Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Washing Machine</label>
                  <select
                    value={mcNumber.split(' ')[0]}
                    onChange={(e) => handleMachineSelect(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    {availableMachines.map(m => (
                      <option key={m.code} value={m.code}>{m.name} ({m.capacity_kg}Kg)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Planning Shift</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Evening">Evening Shift</option>
                    <option value="Night">Night Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Planned Date</label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Buyer & Style Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buyer *</label>
                  <input
                    type="text"
                    value={buyer}
                    onChange={(e) => setBuyer(e.target.value)}
                    placeholder="e.g. H&M"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Style No *</label>
                  <input
                    type="text"
                    value={styleNo}
                    onChange={(e) => setStyleNo(e.target.value)}
                    placeholder="e.g. ST-SLIM-FIT"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">File / Order Ref</label>
                  <input
                    type="text"
                    value={fileNo}
                    onChange={(e) => setFileNo(e.target.value)}
                    placeholder="e.g. HM-9921"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Color / Shade</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Vintage Dark Blue"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Wet Process Parameters */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Droplets size={14} className="text-blue-600" /> Wet Process Parameters & Chemical Dosing
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Wet Process Type</label>
                    <select
                      value={wetProcessType}
                      onChange={(e) => setWetProcessType(e.target.value as any)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                    >
                      <option value="Enzyme Wash">Enzyme Wash</option>
                      <option value="Stone Wash">Stone Wash</option>
                      <option value="Bleach Wash">Bleach Wash</option>
                      <option value="Tinting/Dyeing">Tinting / Dyeing</option>
                      <option value="Softener Wash">Softener Wash</option>
                      <option value="Bio Wash/Desize">Bio Wash / Desize</option>
                      <option value="Acid Wash">Acid Wash</option>
                      <option value="Normal Wash">Normal Wash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recipe / Dosing Code</label>
                    <input
                      type="text"
                      value={chemicalRecipeCode}
                      onChange={(e) => setChemicalRecipeCode(e.target.value)}
                      placeholder="e.g. REC-ENZ-01"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Liquor Ratio</label>
                    <input
                      type="text"
                      value={liquorRatio}
                      onChange={(e) => setLiquorRatio(e.target.value)}
                      placeholder="e.g. 1:8"
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Process Time (Mins)</label>
                    <input
                      type="number"
                      value={processTimeMins}
                      onChange={(e) => setProcessTimeMins(Number(e.target.value))}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quantities & Load Math */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Load Capacity Calculation</span>
                  <span className="text-[10px] text-slate-400">Target M/C Cap: {mcCapacityKg} Kg</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Garment Qty (Pcs) *</label>
                    <input
                      type="number"
                      value={pcsQty}
                      onChange={(e) => setPcsQty(Number(e.target.value))}
                      className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Avg Wt / Pc (Kg) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={avgWeightPerPcKg}
                      onChange={(e) => setAvgWeightPerPcKg(Number(e.target.value))}
                      className="w-full text-xs bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Batch Weight</label>
                    <div className="text-lg font-mono font-bold text-emerald-400 py-1">
                      {computedTotalWeightKg} <span className="text-xs font-normal text-slate-400">Kg</span>
                    </div>
                  </div>
                </div>

                {/* Capacity Progress Gauge */}
                <div className="pt-2">
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span>M/C Capacity Utilization:</span>
                    <span className={computedCapacityPct > 100 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                      {computedCapacityPct}% {computedCapacityPct > 100 && '(OVERLOAD!)'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${computedCapacityPct > 100 ? 'bg-red-500' : computedCapacityPct > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min(100, computedCapacityPct)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Operator & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Master Washer / Operator</label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="e.g. Master Washer Kabir"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Special Wash Instructions / Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Add 2% pumice stone for high contrast abrasion"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoadMutation.isPending}
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>{createLoadMutation.isPending ? 'Scheduling...' : 'Save Wash M/C Load Plan'}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE SLIP MODAL */}
      {printLoadItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl my-8">
              <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-800">Washing Floor Recipe & Load Ticket</h3>
              <button onClick={() => setPrintLoadItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {/* Ticket Printable Body */}
            <div className="p-4 border-2 border-slate-800 rounded-xl space-y-3 font-mono text-xs bg-slate-50">
              <div className="text-center border-b border-slate-400 pb-2">
                <h2 className="font-black text-base text-slate-900">INCTL WASH ERP</h2>
                <p className="text-[10px] font-sans text-slate-600">Garments Washing Machine Load & Recipe Ticket</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>LOAD NO: <strong>{printLoadItem.load_no}</strong></div>
                <div>DATE: <strong>{formatDate(printLoadItem.plan_date)}</strong></div>
                <div>MACHINE: <strong>{printLoadItem.mc_number}</strong></div>
                <div>SHIFT: <strong>{printLoadItem.shift}</strong></div>
              </div>

              <div className="border-t border-slate-300 pt-2 space-y-1">
                <div>BUYER: <strong>{printLoadItem.buyer}</strong></div>
                <div>STYLE: <strong>{printLoadItem.style_no}</strong></div>
                <div>FILE NO: <strong>{printLoadItem.file_no || '-'}</strong></div>
                <div>COLOR: <strong>{printLoadItem.color}</strong></div>
              </div>

              <div className="border-t border-slate-300 pt-2 space-y-1 bg-amber-50 p-2 rounded border border-amber-200">
                <div className="text-amber-900 font-bold uppercase">WET PROCESS: {printLoadItem.wet_process_type}</div>
                <div>RECIPE CODE: <strong>{printLoadItem.chemical_recipe_code || 'STANDARD'}</strong></div>
                <div>LIQUOR RATIO: <strong>{printLoadItem.liquor_ratio || '1:8'}</strong></div>
                <div>WATER TEMP: <strong>{printLoadItem.water_temp_c || 60}°C</strong> | TIME: <strong>{printLoadItem.process_time_mins} Mins</strong></div>
              </div>

              <div className="border-t border-slate-300 pt-2 grid grid-cols-2 gap-2 font-bold text-slate-900">
                <div>GARMENT QTY: {printLoadItem.pcs_qty} Pcs</div>
                <div>LOAD WEIGHT: {printLoadItem.total_weight_kg} Kg ({printLoadItem.capacity_utilization_pct}%)</div>
              </div>

              <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-600">
                <div>MASTER WASHER: {printLoadItem.operator_name || 'N/A'}</div>
                {printLoadItem.remarks && <div>REMARKS: {printLoadItem.remarks}</div>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPrintLoadItem(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-200 text-slate-700 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg flex items-center gap-1.5"
              >
                <Printer size={14} /> Print Ticket
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* MACHINES MASTER MODAL */}
      {isMachineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Cpu size={16} className="text-blue-600" /> Washing Machines Master Setup
              </h3>
              <button onClick={() => setIsMachineModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {availableMachines.map(m => (
                <div key={m.code} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{m.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">Code: {m.code} | {m.type}</p>
                  </div>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    {m.capacity_kg} Kg Cap
                  </span>
                </div>
              ))}
            </div>

            {!isViewer && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newMcName || !newMcCode) return toast.error('Name and Code required');
                  addMachineMutation.mutate({
                    name: newMcName,
                    code: newMcCode,
                    capacity_kg: Number(newMcCap) || 300,
                    type: newMcType,
                    status: 'Operational'
                  });
                }}
                className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3"
              >
                <h4 className="text-[11px] font-bold text-slate-700 uppercase">Add New Washing Machine</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newMcName}
                    onChange={(e) => setNewMcName(e.target.value)}
                    placeholder="Machine Name (e.g. Front Load #3)"
                    className="text-xs border rounded p-1.5"
                  />
                  <input
                    type="text"
                    value={newMcCode}
                    onChange={(e) => setNewMcCode(e.target.value)}
                    placeholder="Code (e.g. MC-06)"
                    className="text-xs border rounded p-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={newMcCap}
                    onChange={(e) => setNewMcCap(Number(e.target.value))}
                    placeholder="Capacity (Kg)"
                    className="text-xs border rounded p-1.5"
                  />
                  <select
                    value={newMcType}
                    onChange={(e) => setNewMcType(e.target.value as any)}
                    className="text-xs border rounded p-1.5"
                  >
                    <option value="Belly Washer">Belly Washer</option>
                    <option value="Front Load">Front Load</option>
                    <option value="Sample Washer">Sample Washer</option>
                    <option value="Hydro Extractor">Hydro Extractor</option>
                    <option value="Tumble Dryer">Tumble Dryer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={addMachineMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg"
                >
                  Add Machine
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
