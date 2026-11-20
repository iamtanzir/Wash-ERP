import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Cpu,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Server,
  Radio,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Zap,
  ShieldAlert,
  Play,
  Pause,
  Link2,
  WashingMachine,
  Droplets,
  Flame,
  Wind,
  Layers,
  Terminal,
  Globe
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface OpenRemoteAttribute {
  name: string;
  label: string;
  type: 'number' | 'string' | 'boolean';
  unit?: string;
  value: number | string | boolean;
  meta?: {
    readOnly?: boolean;
    ruleWatched?: boolean;
    min?: number;
    max?: number;
  };
  timestamp: number;
}

interface OpenRemoteAsset {
  id: string;
  name: string;
  type: string;
  realm: string;
  parentId: string | null;
  protocol: string;
  zone: string;
  linkedOrderRef?: string;
  linkedBuyer?: string;
  online: boolean;
  updatedOn: number;
  attributes: Record<string, OpenRemoteAttribute>;
}

interface OpenRemoteRule {
  id: string;
  name: string;
  enabled: boolean;
  assetId: string;
  assetName: string;
  attributeName: string;
  operator: '>' | '<' | '==' | '!=';
  threshold: number | string | boolean;
  thenAction: string;
  severity: 'info' | 'warning' | 'critical';
  triggerCount: number;
  lastTriggered?: number;
}

interface OpenRemoteEvent {
  id: string;
  timestamp: number;
  assetId: string;
  assetName: string;
  eventType: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface BridgeConfig {
  mode: 'embedded' | 'hybrid-bridge';
  managerUrl: string;
  realm: string;
  clientId: string;
  mqttTopicPrefix: string;
  pollIntervalSec: number;
  lastSyncAt?: number;
  lastSyncStatus?: string;
}

const VALUE_CHAIN = [
  { id: 1, title: 'Material & Fabric Arr.', stage: 'CPL Gate', status: 'done' },
  { id: 2, title: 'Sewing → Wash RFID', stage: 'RFID Portal', status: 'done' },
  { id: 3, title: 'Wet Wash & Enzyme', stage: 'Tonello BW', status: 'current' },
  { id: 4, title: 'Laser & Ozone Dry', stage: 'Ozone #01', status: 'current' },
  { id: 5, title: 'Steam Tumble Dry', stage: 'Dryer #01', status: 'pending' },
  { id: 6, title: 'ETP Water Recycle', stage: 'ETP Utility', status: 'done' },
  { id: 7, title: 'End-Line QC & Dispatch', stage: 'Finish Gate', status: 'pending' }
];

function getAssetIcon(type: string) {
  switch (type) {
    case 'WashMachineAsset':
      return WashingMachine;
    case 'WaterSensorAsset':
      return Droplets;
    case 'DryerAsset':
      return Flame;
    case 'OzoneAsset':
      return Wind;
    case 'RFIDGatewayAsset':
      return Radio;
    case 'BuildingAsset':
      return Layers;
    default:
      return Cpu;
  }
}

export default function IoTTracking() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'assets' | 'rules' | 'ingest' | 'bridge'>('assets');
  const [assets, setAssets] = useState<OpenRemoteAsset[]>([]);
  const [rules, setRules] = useState<OpenRemoteRule[]>([]);
  const [events, setEvents] = useState<OpenRemoteEvent[]>([]);
  const [bridgeConfig, setBridgeConfig] = useState<BridgeConfig>({
    mode: 'embedded',
    managerUrl: 'https://127.0.0.1',
    realm: 'wash-factory',
    clientId: 'openremote-erp-bridge',
    mqttTopicPrefix: 'wash-factory/sensors/#',
    pollIntervalSec: 15
  });

  const [selectedAssetId, setSelectedAssetId] = useState<string>('or-asset-tonello-01');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [autoStream, setAutoStream] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [pulsing, setPulsing] = useState<boolean>(false);
  const [syncingBridge, setSyncingBridge] = useState<boolean>(false);

  // Rolling live telemetry trend for selected/plant metrics
  const [telemetryTrend, setTelemetryTrend] = useState<
    { time: string; powerKw: number; waterLiters: number; avgTempC: number; rfidPcs: number }[]
  >([]);

  // Inline attribute editor state
  const [editAttrName, setEditAttrName] = useState<string>('');
  const [editAttrVal, setEditAttrVal] = useState<string>('');
  const [editOrderLink, setEditOrderLink] = useState<string>('');

  // Create Asset Modal / Form state
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    type: 'WashMachineAsset',
    protocol: 'MQTT',
    zone: 'Wet Process Zone A',
    linkedOrderRef: '',
    initialAttributeName: 'drumTempC',
    initialAttributeValue: '55',
    initialAttributeUnit: '°C'
  });

  // Create Rule Form state
  const [newRule, setNewRule] = useState({
    name: '',
    assetId: 'or-asset-tonello-01',
    attributeName: 'drumTempC',
    operator: '>' as '>' | '<' | '==' | '!=',
    threshold: '75',
    thenAction: 'Throttle Steam Valve & Notify Supervisor',
    severity: 'warning' as 'info' | 'warning' | 'critical'
  });

  // Hardware / RFID Ingest Simulator state
  const [ingestForm, setIngestForm] = useState({
    assetId: 'or-asset-rfid-gate',
    attributeName: 'lastScannedBundle',
    value: 'EPC-BUNDLE-111-1111',
    linkedOrderRef: '111-1111',
    autoLogBundlePcs: '25'
  });

  const { data: erpOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getActiveOrders()
  });

  const appendTrendSnapshot = (nextAssets: OpenRemoteAsset[]) => {
    const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const plant = nextAssets.find(a => a.type === 'BuildingAsset');
    const bw1 = nextAssets.find(a => a.id === 'or-asset-tonello-01');
    const rfid = nextAssets.find(a => a.type === 'RFIDGatewayAsset');
    const powerKw = Number(plant?.attributes?.activePowerKw?.value ?? 180);
    const waterLiters = Number(bw1?.attributes?.waterLiters?.value ?? 620);
    const avgTempC = Number(bw1?.attributes?.drumTempC?.value ?? 58);
    const rfidPcs = Number(rfid?.attributes?.scannedTodayPcs?.value ?? 640);

    setTelemetryTrend(prev => [...prev.slice(-14), { time: label, powerKw, waterLiters, avgTempC, rfidPcs }]);
  };

  const loadState = async () => {
    try {
      const data = await api.getOpenRemoteState();
      const loadedAssets: OpenRemoteAsset[] = data.assets || [];
      setAssets(loadedAssets);
      setRules(data.rules || []);
      setEvents(data.events || []);
      if (data.config) setBridgeConfig(data.config);
      if (loadedAssets.length > 0 && !loadedAssets.some(a => a.id === selectedAssetId)) {
        setSelectedAssetId(loadedAssets[0].id);
      }
      if (loadedAssets.length > 0 && telemetryTrend.length === 0) {
        appendTrendSnapshot(loadedAssets);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load OpenRemote IoT state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const handlePulse = async (silent = false) => {
    setPulsing(true);
    try {
      const res = await api.pulseOpenRemoteTelemetry();
      const nextAssets: OpenRemoteAsset[] = res.assets || [];
      setAssets(nextAssets);
      if (res.rules) setRules(res.rules);
      if (res.events) setEvents(res.events);
      appendTrendSnapshot(nextAssets);

      const triggered = res.triggeredEvents || [];
      if (triggered.length > 0) {
        toast.warning(`OpenRemote Rule Alert: ${triggered[0].assetName}`);
      } else if (!silent) {
        toast.success('OpenRemote floor telemetry updated');
      }
    } catch (err: any) {
      if (!silent) toast.error(err?.message || 'Telemetry pulse failed');
    } finally {
      setPulsing(false);
    }
  };

  useEffect(() => {
    if (!autoStream) return;
    const timer = setInterval(() => {
      handlePulse(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoStream]);

  const selectedAsset = useMemo(
    () => assets.find(a => a.id === selectedAssetId) || assets[0] || null,
    [assets, selectedAssetId]
  );

  useEffect(() => {
    if (selectedAsset) {
      setEditOrderLink(selectedAsset.linkedOrderRef || '');
    }
  }, [selectedAsset?.id]);

  const zones = useMemo(
    () => Array.from(new Set(assets.map(a => a.zone).filter(Boolean))),
    [assets]
  );

  const filteredAssets = useMemo(
    () => (zoneFilter === 'all' ? assets : assets.filter(a => a.zone === zoneFilter)),
    [assets, zoneFilter]
  );

  const kpis = useMemo(() => {
    const onlineCount = assets.filter(a => a.online).length;
    const rootPlant = assets.find(a => a.type === 'BuildingAsset');
    const rfid = assets.find(a => a.type === 'RFIDGatewayAsset');
    const activeAlerts = events.filter(e => e.severity === 'critical' || e.severity === 'warning').length;
    return {
      onlineCount,
      totalAssets: assets.length,
      plantKw: Number(rootPlant?.attributes?.activePowerKw?.value ?? 184.6),
      rfidToday: Number(rfid?.attributes?.scannedTodayPcs?.value ?? 640),
      activeAlerts
    };
  }, [assets, events]);

  const handleToggleBooleanAttr = async (asset: OpenRemoteAsset, attr: OpenRemoteAttribute) => {
    try {
      const nextVal = !Boolean(attr.value);
      const res = await api.writeOpenRemoteAttribute(asset.id, {
        attributeName: attr.name,
        value: nextVal,
        source: 'OpenRemote Operator Console'
      });
      setAssets(prev => prev.map(a => (a.id === asset.id ? res.asset : a)));
      await loadState();
      toast.success(`${asset.name}: ${attr.label} -> ${nextVal ? 'ON / OPEN' : 'OFF / CLOSED'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Attribute write failed');
    }
  };

  const handleWriteAttributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !editAttrName.trim()) return;
    let parsed: number | string | boolean = editAttrVal;
    if (editAttrVal === 'true') parsed = true;
    else if (editAttrVal === 'false') parsed = false;
    else if (!isNaN(Number(editAttrVal)) && editAttrVal.trim() !== '') parsed = Number(editAttrVal);

    try {
      await api.writeOpenRemoteAttribute(selectedAsset.id, {
        attributeName: editAttrName.trim(),
        value: parsed,
        linkedOrderRef: editOrderLink.trim() || undefined,
        source: 'OpenRemote Attribute Editor'
      });
      toast.success(`Updated ${editAttrName} on ${selectedAsset.name}`);
      setEditAttrName('');
      setEditAttrVal('');
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update attribute');
    }
  };

  const handleBindOrderRef = async () => {
    if (!selectedAsset) return;
    try {
      await api.writeOpenRemoteAttribute(selectedAsset.id, {
        attributeName: 'cyclePhase',
        value: selectedAsset.attributes?.cyclePhase?.value || 'Running Batch',
        linkedOrderRef: editOrderLink.trim(),
        source: 'ERP Order Link'
      });
      toast.success(`Linked Order "${editOrderLink || 'None'}" to ${selectedAsset.name}`);
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Order bind failed');
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.name.trim()) return;
    try {
      const val =
        !isNaN(Number(newAsset.initialAttributeValue)) && newAsset.initialAttributeValue.trim() !== ''
          ? Number(newAsset.initialAttributeValue)
          : newAsset.initialAttributeValue;
      const created = await api.createOpenRemoteAsset({
        ...newAsset,
        initialAttributeValue: val
      });
      toast.success(`Provisioned OpenRemote asset: ${created.name}`);
      setShowAddAsset(false);
      setNewAsset({
        name: '',
        type: 'WashMachineAsset',
        protocol: 'MQTT',
        zone: 'Wet Process Zone A',
        linkedOrderRef: '',
        initialAttributeName: 'drumTempC',
        initialAttributeValue: '55',
        initialAttributeUnit: '°C'
      });
      setSelectedAssetId(created.id);
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create asset');
    }
  };

  const handleDeleteAsset = async (id: string) => {
    try {
      await api.deleteOpenRemoteAsset(id);
      toast.success('Removed OpenRemote asset');
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Cannot delete asset');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) return;
    const targetAsset = assets.find(a => a.id === newRule.assetId);
    const threshNum = Number(newRule.threshold);
    try {
      await api.saveOpenRemoteRule({
        ...newRule,
        assetName: targetAsset?.name || newRule.assetId,
        threshold: !isNaN(threshNum) && newRule.threshold.trim() !== '' ? threshNum : newRule.threshold,
        enabled: true
      });
      toast.success('When-Then Automation Rule saved');
      setNewRule({ ...newRule, name: '' });
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save rule');
    }
  };

  const handleToggleRule = async (rule: OpenRemoteRule) => {
    try {
      await api.saveOpenRemoteRule({ ...rule, enabled: !rule.enabled });
      await loadState();
      toast.success(`Rule "${rule.name}" ${!rule.enabled ? 'Enabled' : 'Paused'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Rule toggle failed');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.deleteOpenRemoteRule(id);
      await loadState();
      toast.success('Rule deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const numPcs = Number(ingestForm.autoLogBundlePcs) || 0;
      const res = await api.ingestOpenRemoteTelemetry({
        assetId: ingestForm.assetId,
        attributeName: ingestForm.attributeName,
        value: ingestForm.value,
        linkedOrderRef: ingestForm.linkedOrderRef.trim() || undefined,
        autoLogBundlePcs: numPcs > 0 ? numPcs : undefined,
        source: 'HTTP-Agent / RFID Push'
      });

      if (res.loggedOrder) {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['daily_logs'] });
        toast.success(`Ingested RFID scan & auto-logged +${numPcs} pcs to ERP Order ${res.loggedOrder}`);
      } else {
        toast.success(`Telemetry ingested into OpenRemote Asset`);
      }
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Telemetry ingest failed');
    }
  };

  const handleSyncBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncingBridge(true);
    try {
      const res = await api.syncOpenRemoteBridge(bridgeConfig);
      if (res.config) setBridgeConfig(res.config);
      toast.info(res.statusMessage);
      await loadState();
    } catch (err: any) {
      toast.error(err?.message || 'Bridge sync failed');
    } finally {
      setSyncingBridge(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <div className="w-10 h-10 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl flex items-center justify-center">
                <Wifi size={20} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">OpenRemote Core • IoT Smart Tracking</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                {bridgeConfig.mode === 'hybrid-bridge' ? 'Hybrid Manager Bridge' : 'Embedded Asset Engine'}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Industrial Wash Floor Telemetry, UHF RFID Bundle Scanning, When-Then Automation Rules &amp; OpenRemote Asset Tree
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setAutoStream(v => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                autoStream
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {autoStream ? <Pause size={14} /> : <Play size={14} />}
              <span>{autoStream ? 'Auto-Stream ON (5s)' : 'Start Live Stream'}</span>
            </button>

            <button
              onClick={() => handlePulse(false)}
              disabled={pulsing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={pulsing ? 'animate-spin' : ''} />
              <span>Poll Telemetry</span>
            </button>

            <button
              onClick={() => setShowAddAsset(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Provision Asset</span>
            </button>
          </div>
        </div>

        {/* KPI Bar */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">OpenRemote Assets</p>
            <p className="text-xl font-mono font-black text-white mt-0.5">
              {kpis.onlineCount} <span className="text-xs font-medium text-emerald-400">/ {kpis.totalAssets} Online</span>
            </p>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plant Electrical Load</p>
            <p className="text-xl font-mono font-black text-cyan-400 mt-0.5">{kpis.plantKw} kW</p>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">RFID Auto-Count Today</p>
            <p className="text-xl font-mono font-black text-blue-400 mt-0.5">{kpis.rfidToday} pcs</p>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/80">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rule Alerts Logged</p>
            <p className={`text-xl font-mono font-black mt-0.5 ${kpis.activeAlerts > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {kpis.activeAlerts} Events
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-px">
        {[
          { id: 'assets', label: 'Asset Tree & Live Telemetry', icon: Server },
          { id: 'rules', label: `When-Then Rules (${rules.length})`, icon: Zap },
          { id: 'ingest', label: 'HTTP-Agent & RFID Scanner', icon: Radio },
          { id: 'bridge', label: 'OpenRemote Bridge & Pipeline', icon: Globe }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                active
                  ? 'border-cyan-600 text-cyan-700 bg-cyan-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
          <RefreshCw className="animate-spin text-cyan-600 mx-auto mb-3" size={28} />
          <p className="text-sm font-bold text-slate-700">Initializing OpenRemote Asset Engine...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: ASSET TREE & LIVE TELEMETRY */}
          {activeTab === 'assets' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Asset Tree */}
              <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Asset Hierarchy</h3>
                    <p className="text-[11px] text-slate-500">Realm: {bridgeConfig.realm}</p>
                  </div>
                  <select
                    value={zoneFilter}
                    onChange={e => setZoneFilter(e.target.value)}
                    className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
                  >
                    <option value="all">All Zones ({assets.length})</option>
                    {zones.map(z => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {filteredAssets.map(asset => {
                    const Icon = getAssetIcon(asset.type);
                    const isSelected = selectedAsset?.id === asset.id;
                    const primaryAttr = Object.values<OpenRemoteAttribute>(asset.attributes || {})[0];
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`w-full text-left p-3.5 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                          isSelected ? 'bg-cyan-50/70 border-l-4 border-l-cyan-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <Icon size={17} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{asset.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {asset.protocol}
                              </span>
                              <span className="text-[10px] text-slate-500">{asset.zone}</span>
                            </div>
                            {asset.linkedOrderRef && (
                              <p className="text-[10px] font-bold text-indigo-600 mt-1 flex items-center gap-1">
                                <Link2 size={10} /> ERP Order: {asset.linkedOrderRef}
                                {asset.linkedBuyer ? ` (${asset.linkedBuyer})` : ''}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                              asset.online ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {asset.online ? 'Online' : 'Offline'}
                          </span>
                          {primaryAttr && (
                            <p className="text-xs font-mono font-bold text-slate-800 mt-1.5">
                              {String(primaryAttr.value)}
                              {primaryAttr.unit ? ` ${primaryAttr.unit}` : ''}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Selected Asset Inspector */}
              <div className="lg:col-span-7 space-y-6">
                {selectedAsset && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">{selectedAsset.name}</h3>
                          <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-bold">
                            {selectedAsset.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ID: <span className="font-mono">{selectedAsset.id}</span> • Protocol: {selectedAsset.protocol} • Updated:{' '}
                          {new Date(selectedAsset.updatedOn).toLocaleTimeString()}
                        </p>
                      </div>

                      {selectedAsset.id !== 'or-asset-plant-root' && (
                        <button
                          onClick={() => handleDeleteAsset(selectedAsset.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Asset"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Link to Active ERP Order */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
                      <Link2 size={15} className="text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">Linked ERP Batch / File No:</span>
                      <input
                        list="erp-orders-datalist"
                        value={editOrderLink}
                        onChange={e => setEditOrderLink(e.target.value)}
                        placeholder="e.g. 111-1111"
                        className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono"
                      />
                      <datalist id="erp-orders-datalist">
                        {Array.isArray(erpOrders) &&
                          erpOrders.slice(0, 30).map((o: any) => (
                            <option key={o.id} value={o.file_no}>
                              {o.buyer} - {o.style_no} ({o.order_qty} pcs)
                            </option>
                          ))}
                      </datalist>
                      <button
                        onClick={handleBindOrderRef}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Bind Order
                      </button>
                    </div>

                    {/* Attribute Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.values<OpenRemoteAttribute>(selectedAsset.attributes || {}).map(attr => (
                        <div
                          key={attr.name}
                          className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                        >
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{attr.label}</p>
                            <p className="text-sm font-mono font-black text-slate-900 mt-0.5">
                              {attr.type === 'boolean'
                                ? attr.value
                                  ? 'OPEN / ACTIVE'
                                  : 'CLOSED / IDLE'
                                : `${attr.value}${attr.unit ? ` ${attr.unit}` : ''}`}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{attr.name}</p>
                          </div>

                          {attr.type === 'boolean' ? (
                            <button
                              onClick={() => handleToggleBooleanAttr(selectedAsset, attr)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                attr.value
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                            >
                              {attr.value ? 'Turn OFF' : 'Turn ON'}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditAttrName(attr.name);
                                setEditAttrVal(String(attr.value));
                              }}
                              className="p-2 text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                              title="Write New Attribute Value"
                            >
                              <Sliders size={15} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Quick Attribute Write Form */}
                    <form onSubmit={handleWriteAttributeSubmit} className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editAttrName}
                        onChange={e => setEditAttrName(e.target.value)}
                        placeholder="Attribute name (e.g. drumTempC)"
                        className="flex-1 min-w-[140px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={editAttrVal}
                        onChange={e => setEditAttrVal(e.target.value)}
                        placeholder="New value (e.g. 78 or Optimal)"
                        className="flex-1 min-w-[140px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!editAttrName.trim()}
                        className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Write Attribute
                      </button>
                    </form>
                  </div>
                )}

                {/* Real-time Telemetry Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Activity size={16} className="text-cyan-600" />
                        Live Sensor Time-Series Stream
                      </h3>
                      <p className="text-[11px] text-slate-500">Washer Drum Temp (°C) &amp; Plant Power (kW) across telemetry ticks</p>
                    </div>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                      {telemetryTrend.length} samples
                    </span>
                  </div>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={telemetryTrend} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="powerKw" stroke="#0891b2" fill="#06b6d4" fillOpacity={0.15} strokeWidth={2.5} name="Plant Load (kW)" />
                        <Area type="monotone" dataKey="avgTempC" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeWidth={2} name="Washer #01 Temp (°C)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHEN-THEN RULES & EVENTS */}
          {activeTab === 'rules' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 space-y-5">
                {/* Create Rule */}
                <form onSubmit={handleCreateRule} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    New OpenRemote When-Then Rule
                  </h3>
                  <input
                    type="text"
                    required
                    value={newRule.name}
                    onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Rule Name (e.g. High Washer Drum Temp Alert)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <select
                      value={newRule.assetId}
                      onChange={e => setNewRule({ ...newRule, assetId: e.target.value })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={newRule.attributeName}
                      onChange={e => setNewRule({ ...newRule, attributeName: e.target.value })}
                      placeholder="Attribute (e.g. drumTempC)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <select
                      value={newRule.operator}
                      onChange={e => setNewRule({ ...newRule, operator: e.target.value as any })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    >
                      <option value=">">&gt; Greater Than</option>
                      <option value="<">&lt; Less Than</option>
                      <option value="==">== Equals</option>
                      <option value="!=">!= Not Equals</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={newRule.threshold}
                      onChange={e => setNewRule({ ...newRule, threshold: e.target.value })}
                      placeholder="Threshold (e.g. 75)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                    <select
                      value={newRule.severity}
                      onChange={e => setNewRule({ ...newRule, severity: e.target.value as any })}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newRule.thenAction}
                      onChange={e => setNewRule({ ...newRule, thenAction: e.target.value })}
                      placeholder="Then Action..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                    >
                      Add Rule
                    </button>
                  </div>
                </form>

                {/* Active Rules List */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900">Active Automation Rules</h3>
                  {rules.map(rule => (
                    <div key={rule.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{rule.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              rule.severity === 'critical'
                                ? 'bg-rose-100 text-rose-700'
                                : rule.severity === 'warning'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {rule.severity}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-600">
                          WHEN {rule.assetName}.{rule.attributeName} {rule.operator} {String(rule.threshold)}
                        </p>
                        <p className="text-[11px] text-indigo-700 font-semibold">THEN: {rule.thenAction}</p>
                        <p className="text-[10px] text-slate-400">Triggered {rule.triggerCount || 0} times</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleRule(rule)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {rule.enabled ? 'Enabled' : 'Paused'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Live Event Log */}
              <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-cyan-600" />
                    OpenRemote Telemetry &amp; Rule Event Stream
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">{events.length} latest events</span>
                </div>
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                  {events.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      No events recorded yet. Click "Poll Telemetry" or write a rule-triggering value (e.g. drumTempC &gt; 75).
                    </div>
                  ) : (
                    events.map(evt => (
                      <div
                        key={evt.id}
                        className={`p-3 rounded-xl border text-xs ${
                          evt.severity === 'critical'
                            ? 'bg-rose-50 border-rose-200'
                            : evt.severity === 'warning'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-slate-900">{evt.assetName}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(evt.timestamp).toLocaleTimeString()} • {evt.eventType}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{evt.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HTTP-AGENT & UHF RFID SCANNER INGEST */}
          {activeTab === 'ingest' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={handleIngestSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Radio size={18} className="text-cyan-600" />
                    OpenRemote Edge / UHF RFID Bundle Push Simulator
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Simulates hardware PLC or RFID portal HTTP-Agent telemetry directly into the OpenRemote Asset + ERP Daily Logs.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target OpenRemote Asset</label>
                  <select
                    value={ingestForm.assetId}
                    onChange={e => setIngestForm({ ...ingestForm, assetId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold"
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.protocol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Attribute Key</label>
                    <input
                      type="text"
                      value={ingestForm.attributeName}
                      onChange={e => setIngestForm({ ...ingestForm, attributeName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payload Value</label>
                    <input
                      type="text"
                      value={ingestForm.value}
                      onChange={e => setIngestForm({ ...ingestForm, value: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">ERP Order File No (Auto-Log)</label>
                    <input
                      type="text"
                      value={ingestForm.linkedOrderRef}
                      onChange={e => setIngestForm({ ...ingestForm, linkedOrderRef: e.target.value })}
                      placeholder="e.g. 111-1111"
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-indigo-900 mb-1">Auto-Log Sew/Recv Pcs (0 = off)</label>
                    <input
                      type="number"
                      min="0"
                      value={ingestForm.autoLogBundlePcs}
                      onChange={e => setIngestForm({ ...ingestForm, autoLogBundlePcs: e.target.value })}
                      className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs py-3 rounded-xl shadow-sm cursor-pointer"
                >
                  Send Sensor Telemetry &amp; Update ERP
                </button>
              </form>

              <div className="bg-slate-900 text-slate-200 rounded-2xl p-6 space-y-4 border border-slate-800">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Terminal size={18} />
                  <h3 className="text-sm font-bold text-white">Hardware PLC / MQTT / ESP32 Integration Endpoint</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect factory washing machine PLCs, Raspberry Pi MQTT bridges, or handheld UHF RFID readers directly to this endpoint:
                </p>
                <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
{`POST /api/iot/openremote/ingest
Content-Type: application/json

{
  "assetId": "${ingestForm.assetId}",
  "attributeName": "${ingestForm.attributeName}",
  "value": "${ingestForm.value}",
  "linkedOrderRef": "${ingestForm.linkedOrderRef}",
  "autoLogBundlePcs": ${Number(ingestForm.autoLogBundlePcs) || 0},
  "source": "PLC-MQTT-Gateway"
}`}
                </pre>
                <p className="text-[11px] text-slate-400">
                  Tip: Whenever an RFID portal bundle scan pushes <span className="font-mono text-white">autoLogBundlePcs</span>, it automatically appends a verified row into <span className="font-mono text-cyan-300">daily_logs</span> so FLM Free AI &amp; Wash Floor Live reflect the pieces immediately.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: OPENREMOTE MANAGER BRIDGE & VALUE CHAIN */}
          {activeTab === 'bridge' && (
            <div className="space-y-6">
              <form onSubmit={handleSyncBridge} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Globe size={18} className="text-indigo-600" />
                      OpenRemote Core Manager Bridge (github.com/openremote/core)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Run standalone using the built-in Embedded Engine, or connect to your Docker OpenRemote Manager REST API.
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                    {bridgeConfig.lastSyncStatus || 'Ready'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Operation Mode</label>
                    <select
                      value={bridgeConfig.mode}
                      onChange={e => setBridgeConfig({ ...bridgeConfig, mode: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="embedded">Embedded Zero-Setup Engine</option>
                      <option value="hybrid-bridge">Hybrid (External OpenRemote Server)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">OpenRemote Manager URL</label>
                    <input
                      type="text"
                      value={bridgeConfig.managerUrl}
                      onChange={e => setBridgeConfig({ ...bridgeConfig, managerUrl: e.target.value })}
                      placeholder="https://192.168.1.50"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">OpenRemote Realm</label>
                    <input
                      type="text"
                      value={bridgeConfig.realm}
                      onChange={e => setBridgeConfig({ ...bridgeConfig, realm: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">MQTT Wildcard Topic</label>
                    <input
                      type="text"
                      value={bridgeConfig.mqttTopicPrefix}
                      onChange={e => setBridgeConfig({ ...bridgeConfig, mqttTopicPrefix: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={syncingBridge}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw size={14} className={syncingBridge ? 'animate-spin' : ''} />
                    <span>{syncingBridge ? 'Synchronizing...' : 'Save & Sync OpenRemote Bridge'}</span>
                  </button>
                </div>
              </form>

              {/* Smart Garment Wash Critical Path Stages */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Server size={16} className="text-cyan-600" />
                  Wash Plant Smart Tracking Pipeline (IoT Sensor Coverage)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {VALUE_CHAIN.map(stage => (
                    <div key={stage.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center space-y-2">
                      <div
                        className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center border-2 ${
                          stage.status === 'done'
                            ? 'border-emerald-500 text-emerald-600 bg-white'
                            : stage.status === 'current'
                            ? 'border-cyan-500 text-cyan-600 bg-white shadow-sm'
                            : 'border-slate-300 text-slate-400 bg-white'
                        }`}
                      >
                        {stage.status === 'done' ? <CheckCircle2 size={16} /> : <span className="text-xs font-black">{stage.id}</span>}
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-tight">{stage.title}</p>
                      <span className="inline-block text-[10px] font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                        {stage.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Provision New OpenRemote Asset Modal */}
      {showAddAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAsset}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <h3 className="text-base font-black text-slate-900">Provision OpenRemote IoT Asset</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Asset Name</label>
              <input
                type="text"
                required
                value={newAsset.name}
                onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                placeholder="e.g. Tonello Belly Washer #03"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Asset Type</label>
                <select
                  value={newAsset.type}
                  onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="WashMachineAsset">WashMachineAsset</option>
                  <option value="DryerAsset">DryerAsset</option>
                  <option value="OzoneAsset">OzoneAsset</option>
                  <option value="WaterSensorAsset">WaterSensorAsset</option>
                  <option value="RFIDGatewayAsset">RFIDGatewayAsset</option>
                  <option value="ElectricityMeterAsset">ElectricityMeterAsset</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Protocol Agent</label>
                <select
                  value={newAsset.protocol}
                  onChange={e => setNewAsset({ ...newAsset, protocol: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="MQTT">MQTT</option>
                  <option value="Modbus-TCP">Modbus-TCP</option>
                  <option value="OPC-UA">OPC-UA</option>
                  <option value="HTTP-Agent">HTTP-Agent</option>
                  <option value="OpenRemote-Edge">OpenRemote-Edge</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Floor Zone</label>
                <input
                  type="text"
                  value={newAsset.zone}
                  onChange={e => setNewAsset({ ...newAsset, zone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Linked ERP Order Ref</label>
                <input
                  type="text"
                  value={newAsset.linkedOrderRef}
                  onChange={e => setNewAsset({ ...newAsset, linkedOrderRef: e.target.value })}
                  placeholder="Optional (e.g. 111-1111)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newAsset.initialAttributeName}
                onChange={e => setNewAsset({ ...newAsset, initialAttributeName: e.target.value })}
                placeholder="Attr key"
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
              />
              <input
                type="text"
                value={newAsset.initialAttributeValue}
                onChange={e => setNewAsset({ ...newAsset, initialAttributeValue: e.target.value })}
                placeholder="Value"
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
              />
              <input
                type="text"
                value={newAsset.initialAttributeUnit}
                onChange={e => setNewAsset({ ...newAsset, initialAttributeUnit: e.target.value })}
                placeholder="Unit"
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAsset(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
              >
                Create Asset
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
