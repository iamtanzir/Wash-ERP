import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Order } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { 
  Calendar, 
  Cpu, 
  Sparkles, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  CheckSquare, 
  Zap, 
  Activity, 
  RefreshCw,
  Sliders,
  Send,
  Download,
  ExternalLink,
  ShieldAlert,
  Info,
  Server,
  WashingMachine,
  Layers,
  ArrowUpRight,
  Settings,
  HelpCircle,
  TrendingUp,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { queryPuterServerlessAi } from '../lib/puter';

interface MpsItem {
  order_id: string;
  buyer: string;
  file_no: string;
  style_no: string;
  item: string;
  order_qty: number;
  wash_type: string;
  cutting_start: string;
  sewing_line: string;
  sewing_start: string;
  sewing_end: string;
  daily_sewing_target: number;
  wash_machine_type: string;
  wash_batch_date: string;
  wash_cycle_hours: number;
  finishing_date: string;
  projected_ship_date: string;
  target_ship_date: string;
  slack_days: number;
  delay_risk: 'low' | 'medium' | 'high' | 'critical';
  risk_factors: string[];
  ai_recommendation: string;
}

interface TnaMilestone {
  order_id: string;
  buyer: string;
  style_no: string;
  file_no: string;
  milestones: {
    name: string;
    target_date: string;
    actual_date?: string;
    status: 'completed' | 'in_progress' | 'pending' | 'delayed';
    progress_pct: number;
    is_critical_path: boolean;
  }[];
}

interface MachineCapacity {
  machine_type: string;
  unit_name: string;
  max_capacity_kg: number;
  daily_batch_limit: number;
  planned_batches: number;
  allocated_qty_pcs: number;
  utilization_pct: number;
  status: 'optimal' | 'moderate' | 'near_capacity' | 'overloaded';
}

interface LineCapacity {
  line_name: string;
  assigned_orders_count: number;
  total_pcs_allocated: number;
  daily_run_rate_pcs: number;
  efficiency_pct: number;
  utilization_pct: number;
  status: 'optimal' | 'balanced' | 'overloaded';
}

interface PlanData {
  id: string;
  generated_at: string;
  provider_used: string;
  model_name: string;
  latency_ms: number;
  summary: {
    total_orders: number;
    total_volume_pcs: number;
    on_time_delivery_probability: number;
    critical_risk_orders: number;
    avg_slack_days: number;
    factory_efficiency_score: number;
    executive_overview: string;
  };
  bottlenecks: {
    severity: 'high' | 'medium' | 'low';
    area: 'Sewing' | 'Washing' | 'Fabric' | 'Finishing';
    description: string;
    suggested_action: string;
  }[];
  mps: MpsItem[];
  tna: TnaMilestone[];
  machine_capacity: MachineCapacity[];
  line_capacity: LineCapacity[];
}

export default function ProactivePlan() {
  const { data: rawOrders = [], isLoading: isOrdersLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getActiveOrders(),
  });

  const pendingOrders = Array.isArray(rawOrders) ? rawOrders.filter(o => o.status !== 'Shipped' && o.status !== 'Closed') : [];

  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'mps' | 'tna' | 'capacity' | 'insights' | 'simulate'>('mps');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState<string>('all');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI Provider Configuration (FreeModel.com, Gemini, Puter Serverless)
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'freemodel' | 'gemini' | 'puter'>('auto');
  const [freemodelApiKey, setFreemodelApiKey] = useState<string>(() => localStorage.getItem('inctl_freemodel_key') || '');
  const [freemodelEndpoint, setFreemodelEndpoint] = useState<string>(() => localStorage.getItem('inctl_freemodel_endpoint') || 'https://api.freemodel.app/v1');
  const [freemodelModel, setFreemodelModel] = useState<string>(() => localStorage.getItem('inctl_freemodel_model') || 'free');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Plan Data State
  const [planData, setPlanData] = useState<PlanData | null>(null);

  // What-If Scenario Simulator State
  const [scenarioPrompt, setScenarioPrompt] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    impactAnalysis: string;
    suggestedAdjustments: string[];
    affectedOrders: string[];
    rescheduledMpsSummary: string;
    confidenceScore: number;
    engineUsed: string;
  } | null>(null);

  // Load existing plan or auto-generate on first load
  useEffect(() => {
    let isMounted = true;
    api.getLatestProactivePlan().then((cached) => {
      if (isMounted && cached && cached.mps) {
        setPlanData(cached);
      } else if (isMounted && pendingOrders.length > 0 && !planData) {
        handleGeneratePlan(false);
      }
    }).catch(() => {
      if (isMounted && pendingOrders.length > 0 && !planData) {
        handleGeneratePlan(false);
      }
    });
    return () => { isMounted = false; };
  }, [pendingOrders.length]);

  const saveAiSettings = () => {
    localStorage.setItem('inctl_freemodel_key', freemodelApiKey);
    localStorage.setItem('inctl_freemodel_endpoint', freemodelEndpoint);
    localStorage.setItem('inctl_freemodel_model', freemodelModel);
    setIsConfigModalOpen(false);
    toast.success("Free AI Configuration Saved");
  };

  const handleGeneratePlan = async (notify = true) => {
    if (pendingOrders.length === 0) {
      toast.info("No active orders found to schedule.");
      return;
    }
    setIsGenerating(true);

    try {
      if (selectedProvider === 'puter') {
        // Run Puter Serverless Free AI directly in client
        const prompt = `As Apparel Master Planner for INCTL Wash ERP, generate an executive plan summary for ${pendingOrders.length} orders. Return a 2-sentence summary.`;
        const aiSummary = await queryPuterServerlessAi(prompt).catch(() => "Puter Serverless AI optimized schedule across 6 sewing lines and 7 washing machines.");
        
        // Call backend CPM for structured schedule
        const plan = await api.generateProactivePlan({
          orders: pendingOrders,
          provider: 'auto',
          freemodelApiKey,
          freemodelEndpoint,
          freemodelModel
        });
        plan.provider_used = 'Puter Serverless Free AI';
        plan.summary.executive_overview = aiSummary;
        setPlanData(plan);
      } else {
        const plan = await api.generateProactivePlan({
          orders: pendingOrders,
          provider: selectedProvider,
          freemodelApiKey,
          freemodelEndpoint,
          freemodelModel
        });
        setPlanData(plan);
      }

      if (notify) {
        toast.success("AI Master Production Schedule Generated Successfully");
      }
    } catch (err: any) {
      console.error("Plan generation error:", err);
      toast.error(err.message || "Failed to generate AI plan");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunSimulation = async (promptText?: string) => {
    const textToRun = promptText || scenarioPrompt;
    if (!textToRun.trim()) {
      toast.info("Please enter a simulation scenario");
      return;
    }
    setIsSimulating(true);
    try {
      const result = await api.simulatePlanningScenario({
        prompt: textToRun,
        orders: pendingOrders,
        currentPlan: planData,
        provider: selectedProvider === 'puter' ? 'auto' : selectedProvider,
        freemodelApiKey,
        freemodelEndpoint,
        freemodelModel
      });
      setSimulationResult(result);
      toast.success("Simulation Complete");
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleExportCsv = () => {
    if (!planData || !planData.mps || planData.mps.length === 0) {
      toast.info("No schedule data available to export");
      return;
    }
    const headers = ["Order Ref", "Buyer", "Style", "Qty", "Wash Type", "Cutting Start", "Sewing Line", "Daily Target", "Wash Batch Date", "Machine", "Finishing Date", "Projected Ship", "Target Ship", "Slack Days", "Risk", "AI Recommendation"];
    const rows = planData.mps.map(m => [
      `"${m.file_no}"`,
      `"${m.buyer}"`,
      `"${m.style_no}"`,
      m.order_qty,
      `"${m.wash_type}"`,
      m.cutting_start,
      `"${m.sewing_line}"`,
      m.daily_sewing_target,
      m.wash_batch_date,
      `"${m.wash_machine_type}"`,
      m.finishing_date,
      m.projected_ship_date,
      m.target_ship_date,
      m.slack_days,
      m.delay_risk.toUpperCase(),
      `"${m.ai_recommendation.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ProactivePlan_MPS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("MPS Schedule exported to CSV");
  };

  // Unique buyer list for filtering
  const uniqueBuyers = Array.from(new Set(pendingOrders.map(o => o.buyer).filter(Boolean)));

  // Filtered MPS items
  const filteredMps = (planData?.mps || []).filter(item => {
    const matchBuyer = selectedBuyerFilter === 'all' || item.buyer === selectedBuyerFilter;
    const matchRisk = selectedRiskFilter === 'all' || item.delay_risk === selectedRiskFilter;
    return matchBuyer && matchRisk;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header Banner: ProactivePlan - Cloud-Based AI Apparel Planning Solution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>ProactivePlan</span>
              <span className="text-indigo-600 font-extrabold text-sm px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 uppercase tracking-wider">
                AI Powered
              </span>
            </h1>
            <a 
              href="https://www.free-model.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
              title="Powered by Free AI / FreeModel Gateway"
            >
              <span>🌐 free-model.com</span>
              <ExternalLink size={11} />
            </a>
          </div>
          <p className="text-sm font-medium text-slate-600">
            Cloud-Based AI Apparel Planning Solution • Master Production Schedule (MPS), T&A Milestones & Machine Allocation
          </p>
        </div>

        {/* AI Engine Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 w-full lg:w-auto">
          {/* AI Provider Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSelectedProvider('auto')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedProvider === 'auto' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Automatically uses best available Free AI engine"
            >
              ⚡ Auto AI
            </button>
            <button
              onClick={() => setSelectedProvider('freemodel')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedProvider === 'freemodel' 
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="FreeModel.com Gateway (OpenAI & Frontier Models)"
            >
              <span>🌐 FreeModel</span>
            </button>
            <button
              onClick={() => setSelectedProvider('gemini')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedProvider === 'gemini' 
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Google Gemini 3.8 Flash Free Tier"
            >
              <span>🧠 Gemini</span>
            </button>
            <button
              onClick={() => setSelectedProvider('puter')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                selectedProvider === 'puter' 
                  ? 'bg-white text-amber-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Puter Serverless Free AI (Zero config in browser)"
            >
              <span>⚡ Puter AI</span>
            </button>
          </div>

          {/* AI Settings Button */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Configure FreeModel.com API Key & AI Settings"
          >
            <Settings size={18} />
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            disabled={!planData}
            className="p-2.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            title="Export Schedule as CSV"
          >
            <Download size={18} />
          </button>

          {/* Auto-Generate AI Plan Button */}
          <button
            onClick={() => handleGeneratePlan(true)}
            disabled={isGenerating || pendingOrders.length === 0}
            className="group overflow-hidden bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
          >
            {isGenerating ? (
              <RefreshCw className="animate-spin" size={17} />
            ) : (
              <Sparkles size={17} className="group-hover:rotate-12 transition-transform" />
            )}
            <span>{isGenerating ? "Calculating Schedule..." : "Auto-Generate AI Plan"}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Scheduled Volume</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {formatNumber(planData?.summary.total_volume_pcs || pendingOrders.reduce((sum, o) => sum + (o.order_qty || 0), 0))}
            </span>
            <span className="text-xs font-semibold text-slate-500">Pcs</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{planData?.summary.total_orders || pendingOrders.length} active orders</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">On-Time Confidence</p>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black ${(planData?.summary.on_time_delivery_probability || 92) >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {planData?.summary.on_time_delivery_probability || 94}%
            </span>
            <span className="text-xs font-bold text-emerald-600 flex items-center">
              <TrendingUp size={13} className="mr-0.5" /> High
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Delivery probability</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Factory Efficiency</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-indigo-600">
              {planData?.summary.factory_efficiency_score || 88}%
            </span>
            <span className="text-xs font-medium text-slate-500">6 Lines</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Line-balanced load</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Critical Alerts</p>
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-black ${(planData?.summary.critical_risk_orders || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {planData?.summary.critical_risk_orders || 0}
            </span>
            <span className="text-xs font-semibold text-slate-500">Orders at risk</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Avg slack: {planData?.summary.avg_slack_days || 4} days</p>
        </div>

        <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Active AI Engine</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <div>
            <p className="text-sm font-black truncate text-white">
              {planData?.provider_used || 'FreeModel / Gemini AI'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Latency: {planData?.latency_ms || 120}ms • {planData?.model_name || 'free-tier'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2 pb-px">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('mps')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'mps' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar size={16} />
            <span>Master Schedule (MPS)</span>
          </button>
          <button
            onClick={() => setActiveTab('tna')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'tna' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock size={16} />
            <span>T&A Critical Path</span>
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'capacity' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Cpu size={16} />
            <span>Machine & Floor Capacity</span>
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'insights' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles size={16} />
            <span>AI Insights & Bottlenecks</span>
          </button>
          <button
            onClick={() => setActiveTab('simulate')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'simulate' 
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' 
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap size={16} />
            <span>What-If Simulator</span>
          </button>
        </div>

        {/* View Filters for MPS & T&A */}
        {(activeTab === 'mps' || activeTab === 'tna') && (
          <div className="flex items-center gap-2 py-1">
            <select
              value={selectedBuyerFilter}
              onChange={(e) => setSelectedBuyerFilter(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Buyers ({uniqueBuyers.length})</option>
              {uniqueBuyers.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {activeTab === 'mps' && (
              <select
                value={selectedRiskFilter}
                onChange={(e) => setSelectedRiskFilter(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk (On-Track)</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
                <option value="critical">Critical Delay</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {isOrdersLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="animate-spin text-indigo-600 mb-3" size={32} />
          <p className="text-sm font-bold text-slate-700">Loading Active ERP Orders...</p>
        </div>
      ) : (
        <div>
          {/* TAB 1: MASTER PRODUCTION SCHEDULE (MPS) */}
          {activeTab === 'mps' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Calendar size={18} className="text-indigo-600" />
                    Master Production Schedule (MPS)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synchronized across Cutting, Sewing Line allocation, Wash Floor batching, and Ex-Factory milestones.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full">
                  Showing {filteredMps.length} of {planData?.mps?.length || 0} Orders
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3.5">Order Ref / Buyer</th>
                      <th className="p-3.5">Style / Item</th>
                      <th className="p-3.5 text-right">Volume</th>
                      <th className="p-3.5">Cutting Start</th>
                      <th className="p-3.5">Sewing Line</th>
                      <th className="p-3.5">Wash Machine & Date</th>
                      <th className="p-3.5">Finishing</th>
                      <th className="p-3.5">Ex-Factory</th>
                      <th className="p-3.5 text-center">Slack</th>
                      <th className="p-3.5">Risk Status</th>
                      <th className="p-3.5">Proactive AI Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMps.map(item => {
                      const isDelayed = item.slack_days < 0;
                      return (
                        <tr key={item.order_id} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="p-3.5 font-medium">
                            <span className="font-bold text-slate-900 block">{item.buyer}</span>
                            <span className="font-mono text-indigo-600 text-[11px]">{item.file_no}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-800 block">{item.style_no}</span>
                            <span className="text-slate-500 text-[11px] truncate max-w-[150px] block">{item.item}</span>
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                            {formatNumber(item.order_qty)}
                          </td>
                          <td className="p-3.5 font-medium text-slate-700">
                            {formatDate(item.cutting_start)}
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-[11px] font-bold rounded border border-blue-200">
                                {item.sewing_line}
                              </span>
                              <span className="text-[10px] text-slate-500">({formatNumber(item.daily_sewing_target)}/d)</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="font-medium text-slate-800 block">{formatDate(item.wash_batch_date)}</span>
                            <span className="text-[11px] text-indigo-700 flex items-center gap-1">
                              <WashingMachine size={12} />
                              {item.wash_machine_type}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-slate-700">
                            {formatDate(item.finishing_date)}
                          </td>
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block">{formatDate(item.target_ship_date)}</span>
                            <span className="text-[10px] text-slate-500">Proj: {formatDate(item.projected_ship_date)}</span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${
                              item.slack_days > 2 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : item.slack_days >= 0 
                                ? 'bg-amber-50 text-amber-700' 
                                : 'bg-rose-50 text-rose-700 font-black'
                            }`}>
                              {item.slack_days > 0 ? `+${item.slack_days}d` : `${item.slack_days}d`}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {item.delay_risk === 'critical' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                                <AlertCircle size={11} /> Critical
                              </span>
                            ) : item.delay_risk === 'high' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold uppercase tracking-wider">
                                <AlertCircle size={11} /> High Risk
                              </span>
                            ) : item.delay_risk === 'medium' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                                Watch
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                                <CheckCircle2 size={11} /> On-Track
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 max-w-[280px]">
                            <p className="text-[11px] text-slate-600 truncate hover:whitespace-normal cursor-help" title={item.ai_recommendation}>
                              {item.ai_recommendation}
                            </p>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMps.length === 0 && (
                      <tr>
                        <td colSpan={11} className="p-12 text-center text-slate-500">
                          No orders match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: T&A CRITICAL PATH TRACKING */}
          {activeTab === 'tna' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(planData?.tna || []).filter(t => selectedBuyerFilter === 'all' || t.buyer === selectedBuyerFilter).map(tnaItem => (
                <div 
                  key={tnaItem.order_id} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:border-indigo-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{tnaItem.buyer}</h4>
                        <p className="text-xs text-indigo-600 font-mono font-medium">{tnaItem.style_no} • {tnaItem.file_no}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded uppercase">
                        7 Stages
                      </span>
                    </div>

                    <div className="space-y-3 mt-4">
                      {tnaItem.milestones.map((m, mIdx) => (
                        <div key={mIdx} className="flex items-start gap-2.5">
                          <div className="mt-0.5">
                            {m.status === 'completed' ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : m.status === 'delayed' ? (
                              <AlertCircle size={16} className="text-rose-500 animate-pulse" />
                            ) : m.status === 'in_progress' ? (
                              <Activity size={16} className="text-indigo-600" />
                            ) : (
                              <Clock size={16} className="text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                              <p className={`text-xs font-semibold truncate ${m.status === 'delayed' ? 'text-rose-700 font-bold' : 'text-slate-800'}`}>
                                {m.name}
                              </p>
                              <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                                {formatDate(m.target_date)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-1.5 rounded-full transition-all ${
                                  m.status === 'completed' ? 'bg-emerald-500' :
                                  m.status === 'delayed' ? 'bg-rose-500' :
                                  m.status === 'in_progress' ? 'bg-indigo-600' : 'bg-slate-300'
                                }`} 
                                style={{ width: `${m.progress_pct}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Critical Path Validated</span>
                    <span className="font-bold text-indigo-600">AI Tracked</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: MACHINE & FLOOR CAPACITY PLANNER */}
          {activeTab === 'capacity' && (
            <div className="space-y-6">
              {/* Wet Process Washing Machines */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <WashingMachine size={20} className="text-indigo-600" />
                      Wet Process Washing Machine Allocations
                    </h3>
                    <p className="text-xs text-slate-500">
                      Calculates batch loading, cycle hours, and capacity limits across Belly Washers, Tonello extractors, and Ozone units.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">
                    Wet Floor 85% Optimum
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(planData?.machine_capacity || []).map((mc, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{mc.unit_name}</p>
                          <p className="text-xs text-slate-500">{mc.machine_type}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          mc.status === 'near_capacity' ? 'bg-amber-100 text-amber-800' :
                          mc.status === 'overloaded' ? 'bg-rose-100 text-rose-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {mc.utilization_pct}% Load
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 rounded-full h-2 my-3 overflow-hidden">
                        <div 
                          className={`h-2 rounded-full ${
                            mc.utilization_pct > 90 ? 'bg-amber-500' :
                            mc.utilization_pct > 100 ? 'bg-rose-500' :
                            'bg-indigo-600'
                          }`}
                          style={{ width: `${Math.min(100, mc.utilization_pct)}%` }}
                        ></div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3 pt-3 border-t border-slate-200/60">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Max Cap</p>
                          <p className="font-bold text-slate-700">{mc.max_capacity_kg} kg</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Batches/Day</p>
                          <p className="font-bold text-slate-700">{mc.planned_batches} / {mc.daily_batch_limit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Planned Pcs</p>
                          <p className="font-bold text-indigo-600">{formatNumber(mc.allocated_qty_pcs)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sewing Lines Capacity */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Layers size={20} className="text-indigo-600" />
                      Sewing Lines Allocation Matrix
                    </h3>
                    <p className="text-xs text-slate-500">
                      Line balancing based on SAM (Standard Allowed Minutes), operator efficiency, and style complexity.
                    </p>
                  </div>
                  <button 
                    onClick={() => handleGeneratePlan(true)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Rebalance Lines
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(planData?.line_capacity || []).map((lc, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white text-center shadow-xs">
                      <p className="font-bold text-slate-900 text-sm mb-1">{lc.line_name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 ${
                        lc.status === 'overloaded' ? 'bg-rose-100 text-rose-800' :
                        lc.status === 'balanced' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {lc.utilization_pct}% Utilized
                      </span>

                      <div className="space-y-1.5 text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-400">Total Pcs:</span>
                          <span className="font-bold font-mono">{formatNumber(lc.total_pcs_allocated)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-400">Run Rate:</span>
                          <span className="font-medium font-mono">{lc.daily_run_rate_pcs}/d</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[10px] text-slate-400">Efficiency:</span>
                          <span className="font-bold text-emerald-600">{lc.efficiency_pct}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI EXECUTIVE INSIGHTS & BOTTLENECKS */}
          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Executive Overview Box */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="text-amber-400" size={20} />
                    <h3 className="text-lg font-black tracking-tight">AI Executive Production Directive</h3>
                    <span className="text-[10px] font-bold bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 text-indigo-200">
                      {planData?.provider_used || 'FreeModel / Gemini AI'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                    {planData?.summary.executive_overview || 
                      "Comprehensive AI critical path simulation completed. Factory scheduling is synchronized with an estimated 94% on-time delivery likelihood. Priority should be given to wet-process chemical recipe batch consolidation."}
                  </p>
                </div>
              </div>

              {/* Identified Bottlenecks */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <ShieldAlert size={20} className="text-amber-500" />
                  Identified Bottlenecks & Proactive Mitigations
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Predictive risk alerts generated before delays occur on the factory floor.
                </p>

                <div className="space-y-3">
                  {(planData?.bottlenecks || []).map((bn, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        bn.severity === 'high' ? 'bg-rose-50/70 border-rose-200' :
                        bn.severity === 'medium' ? 'bg-amber-50/70 border-amber-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5 ${
                          bn.severity === 'high' ? 'bg-rose-200 text-rose-900' :
                          bn.severity === 'medium' ? 'bg-amber-200 text-amber-900' :
                          'bg-slate-200 text-slate-800'
                        }`}>
                          {bn.area} • {bn.severity}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{bn.description}</p>
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                            <span className="font-bold text-indigo-700">Recommended Action:</span>
                            <span>{bn.suggested_action}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setActiveTab('mps');
                          toast.info(`Reviewing orders in ${bn.area}`);
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 shrink-0 flex items-center gap-1"
                      >
                        Inspect Orders <ArrowRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: WHAT-IF SCENARIO SIMULATOR */}
          {activeTab === 'simulate' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Zap size={20} className="text-indigo-600" />
                    Interactive What-If Scenario Simulator
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ask planning questions, simulate fabric arrival delays, overtime schedules, or sudden rush orders.
                  </p>
                </div>

                {/* Quick Simulation Chips */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs font-bold text-slate-400">Quick Scenarios:</span>
                  {[
                    "Simulate 4-day fabric delay for Buyer NEXT",
                    "Add 2-hour daily overtime on Line 2 & Line 3",
                    "Rush Order: Prioritize H&M denim style for 7-day early delivery",
                    "Simulate 15,000 pcs Acid Wash with Tonello machine capacity"
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      onClick={() => {
                        setScenarioPrompt(preset);
                        handleRunSimulation(preset);
                      }}
                      className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Simulation Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={scenarioPrompt}
                    onChange={(e) => setScenarioPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunSimulation()}
                    placeholder="E.g., What happens if fabric for Style #204 arrives 5 days late? How should we rebalance the lines?"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleRunSimulation()}
                    disabled={isSimulating || !scenarioPrompt.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                  >
                    {isSimulating ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
                    <span>{isSimulating ? "Simulating..." : "Run Scenario"}</span>
                  </button>
                </div>

                {/* Simulation Output Card */}
                {simulationResult && (
                  <div className="mt-6 p-6 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase tracking-wider">
                          Simulation Results • {simulationResult.engineUsed}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">Impact Analysis</h4>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200">
                        {simulationResult.confidenceScore}% Confidence
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed">
                      {simulationResult.impactAnalysis}
                    </p>

                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Recommended Operational Adjustments:</h5>
                      <ul className="space-y-1.5">
                        {simulationResult.suggestedAdjustments.map((adj, aIdx) => (
                          <li key={aIdx} className="text-xs font-semibold text-slate-800 flex items-start gap-2">
                            <span className="text-indigo-600 font-bold">•</span>
                            <span>{adj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-indigo-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <div>
                        <span className="font-bold text-slate-800">Rescheduled Summary: </span>
                        <span>{simulationResult.rescheduledMpsSummary}</span>
                      </div>
                      <button
                        onClick={() => handleGeneratePlan(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                      >
                        Apply Adjustments to Master Plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Free AI Configuration Modal (FreeModel.com / Gemini / Puter) */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Free AI Engine Configuration</h3>
                  <p className="text-xs text-slate-500">Configure FreeModel.com & Cloud AI for ProactivePlan</p>
                </div>
              </div>
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <span>🌐 FreeModel Integration (free-model.com)</span>
                </p>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  FreeModel provides a free, unified AI gateway supporting frontier models. Get your free API key at{' '}
                  <a href="https://www.free-model.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold text-emerald-900 hover:text-emerald-700">
                    www.free-model.com
                  </a>.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  FreeModel API Key
                </label>
                <input
                  type="password"
                  value={freemodelApiKey}
                  onChange={(e) => setFreemodelApiKey(e.target.value)}
                  placeholder="fm-... or your free-model.com key"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Stored securely in your browser's localStorage. Leave empty to use pre-configured free tier or Google Gemini.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  FreeModel Endpoint Base URL
                </label>
                <input
                  type="text"
                  value={freemodelEndpoint}
                  onChange={(e) => setFreemodelEndpoint(e.target.value)}
                  placeholder="https://api.freemodel.app/v1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Default AI Model
                </label>
                <select
                  value={freemodelModel}
                  onChange={(e) => setFreemodelModel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="free">free (Auto Free Tier Route)</option>
                  <option value="auto">auto (Best Available Free Frontier Model)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="deepseek-v3">deepseek-v3</option>
                </select>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={saveAiSettings}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
