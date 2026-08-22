import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Activity, Cpu, Wifi, AlertTriangle, CheckCircle2, Search, ArrowRight, Settings, Smartphone, Server, LayoutTemplate, MapPin, Kanban, Factory, Users, Scissors, ShieldCheck, BarChart, ArrowDown } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const VALUE_CHAIN = [
  { id: 1, title: 'Pre-season planning', status: 'done', issues: ['Inaccurate style allocation'] },
  { id: 2, title: 'Design', status: 'done', issues: ['Lack of Vendor capacity visibility', 'Missing RP details'] },
  { id: 3, title: 'Development', status: 'done', issues: ['Missing Tech Pack info', 'Low Adoption rates'] },
  { id: 4, title: 'RFQ', status: 'done', issues: ['Missing final style details'] },
  { id: 5, title: 'Pencil Booking', status: 'current', issues: ['Actual fabric details unknown'] },
  { id: 6, title: 'Factory Planning', status: 'pending', issues: ['Style changes / OQ adjusted', 'Overbooking'] },
  { id: 7, title: 'Order Confirmation', status: 'pending', issues: ['Fragmented Buys'] },
  { id: 8, title: 'Critical Path Mgt', status: 'pending', issues: ['Missed lead times'] },
  { id: 9, title: 'Pre-Production', status: 'pending', issues: ['Fabric variation = high losses'] },
  { id: 10, title: 'Materials Arrival', status: 'pending', issues: ['Late materials'] },
  { id: 11, title: 'Production', status: 'pending', issues: ['Low efficiency', 'High re-work %'] },
  { id: 12, title: 'Post Production', status: 'pending', issues: ['Production time capacity breached'] },
  { id: 13, title: 'QA', status: 'pending', issues: ['High rejection rate'] },
  { id: 14, title: 'Shipping', status: 'pending', issues: ['Chargebacks'] },
  { id: 15, title: 'KPI Analysis', status: 'pending', issues: ['Lower profit than target'] }
];

const IOT_METRICS = [
  { time: '08:00', efficiency: 65, defects: 12 },
  { time: '10:00', efficiency: 72, defects: 8 },
  { time: '12:00', efficiency: 78, defects: 5 },
  { time: '14:00', efficiency: 75, defects: 7 },
  { time: '16:00', efficiency: 82, defects: 4 },
  { time: '18:00', efficiency: 85, defects: 2 },
];

export default function IoTTracking() {
  const [activeNode, setActiveNode] = useState(5);
  const [activeTab, setActiveTab] = useState<'critical-path' | 'landscape'>('landscape');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
                <Wifi size={20} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Nidle IoT Tracker</h1>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                Live
              </span>
            </div>
            <p className="text-sm text-slate-400">Smart Factory Solution: Real-time critical path and shop-floor visibility</p>
          </div>
          
          <div className="flex gap-3">
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3">
              <Cpu size={16} className="text-slate-400" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Connected Devices</p>
                <p className="text-lg font-mono font-bold text-slate-200">1,248</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 flex items-center gap-3">
              <Activity size={16} className="text-cyan-400" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Efficiency</p>
                <p className="text-lg font-mono font-bold text-cyan-400">76.2%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('landscape')}
          className={`px-4 py-2 text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'landscape' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <LayoutTemplate size={16} />
          Solution Landscape
        </button>
        <button
          onClick={() => setActiveTab('critical-path')}
          className={`px-4 py-2 text-sm font-bold tracking-wide uppercase transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'critical-path' ? 'border-cyan-600 text-cyan-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart size={16} />
          Critical Path Analytics
        </button>
      </div>

      {activeTab === 'critical-path' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Value Chain Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Server size={16} className="text-blue-600" />
              Apparel Value Chain & Critical Path
            </h3>
          </div>
          
          <div className="p-6 flex-1 overflow-x-auto">
            <div className="relative min-w-[800px]">
              {/* Connector Line */}
              <div className="absolute top-6 left-6 right-6 h-1 bg-slate-100 rounded-full z-0">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-1000" style={{ width: '33%' }}></div>
              </div>
              
              <div className="relative z-10 grid grid-cols-5 gap-y-12 gap-x-4">
                {VALUE_CHAIN.map((step) => (
                  <div 
                    key={step.id} 
                    className={`flex flex-col items-center text-center group cursor-pointer transition-transform hover:scale-105 ${activeNode === step.id ? 'scale-105' : ''}`}
                    onClick={() => setActiveNode(step.id)}
                  >
                    <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center mb-3 bg-white transition-colors duration-300
                      ${step.status === 'done' ? 'border-cyan-500 text-cyan-600' : 
                        step.status === 'current' ? 'border-blue-500 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 
                        'border-slate-200 text-slate-400'}`}
                    >
                      {step.status === 'done' ? <CheckCircle2 size={20} /> : <span className="font-bold text-sm">{step.id}</span>}
                    </div>
                    
                    <h4 className={`text-xs font-bold leading-tight px-2 ${step.status === 'current' ? 'text-blue-600' : 'text-slate-700'}`}>
                      {step.title}
                    </h4>
                    
                    {step.status === 'current' && (
                      <div className="mt-2 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 flex items-center gap-1">
                        <AlertTriangle size={10} />
                        Risk Alert
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Node Details & IoT Data */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4">
              Stage Details: {VALUE_CHAIN.find(v => v.id === activeNode)?.title}
            </h3>
            
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <h4 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Potential Bottlenecks
                </h4>
                <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
                  {VALUE_CHAIN.find(v => v.id === activeNode)?.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">IoT Sync Status</p>
                  <p className="text-sm font-mono font-bold text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Connected
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Last Update</p>
                  <p className="text-sm font-mono font-bold text-slate-700 mt-1">2 mins ago</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4 flex justify-between items-center">
              <span>Real-time Floor Metrics</span>
              <Smartphone size={16} className="text-slate-400" />
            </h3>
            
            <div className="h-48 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={IOT_METRICS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="efficiency" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} name="Efficiency %" />
                  <Line yAxisId="right" type="monotone" dataKey="defects" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} name="Defects" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === 'landscape' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-10">
              <h2 className="text-xl font-bold text-slate-800">Get a bird's eye view of Nidle's workflow in all stages!</h2>
              <h3 className="text-3xl font-black text-slate-900 mt-2">Solution <span className="text-cyan-600">Landscape</span></h3>
            </div>
            
            {/* Diagram Representation */}
            <div className="relative max-w-5xl mx-auto py-12">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                {/* Left: Input Management */}
                <div className="flex flex-col items-center gap-4 flex-1">
                  <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-slate-200 shadow-lg flex flex-col items-center justify-center relative group hover:border-cyan-500 transition-colors">
                    <Factory size={40} className="text-slate-600 group-hover:text-cyan-600 mb-2" />
                    <span className="font-bold text-slate-800 text-sm text-center">Warehouse</span>
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center border-2 border-white shadow-sm"><Kanban size={14}/></div>
                  </div>
                  <ArrowDown className="text-slate-300 md:hidden" />
                  <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-slate-200 shadow-lg flex flex-col items-center justify-center relative group hover:border-cyan-500 transition-colors">
                    <Scissors size={40} className="text-slate-600 group-hover:text-cyan-600 mb-2" />
                    <span className="font-bold text-slate-800 text-sm text-center">Cutting</span>
                    <span className="text-[10px] text-slate-500 font-medium absolute bottom-2">Input Management</span>
                  </div>
                </div>

                {/* Arrow Connector Desktop */}
                <div className="hidden md:flex flex-col items-center text-slate-300 gap-2">
                  <ArrowRight size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Input Man</span>
                </div>

                {/* Center: Sewing Line IoT */}
                <div className="flex flex-col items-center gap-4 flex-[2] relative">
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg">
                    <Wifi size={14} className="text-cyan-400" />
                    <span className="text-xs font-bold tracking-wider uppercase">IoT Device Network</span>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-300 w-full relative">
                    <div className="grid grid-cols-2 gap-6">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center relative">
                            <Users size={18} className="text-cyan-600" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">Operator #{i}</p>
                            <p className="text-[10px] text-slate-500">In-Line Productivity</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <span className="font-black text-slate-800 text-lg uppercase tracking-wider">Sewing Line</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 shadow-sm flex items-center gap-2">
                      <Search size={14} className="text-blue-500" /> In Line QC
                    </div>
                  </div>
                </div>

                {/* Arrow Connector Desktop */}
                <div className="hidden md:flex flex-col items-center text-slate-300 gap-2">
                  <ArrowRight size={32} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">QMS</span>
                </div>

                {/* Right: End-Line & Server */}
                <div className="flex flex-col items-center gap-8 flex-1">
                  <div className="w-40 bg-white p-4 rounded-xl border border-slate-200 shadow-lg text-center relative group hover:border-cyan-500 transition-colors">
                    <div className="w-12 h-12 mx-auto bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2">
                      <ShieldCheck size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">End Line QC</span>
                    <p className="text-[10px] text-slate-500 mt-1">Live Heat Maps</p>
                  </div>

                  <div className="w-40 bg-white p-4 rounded-xl border border-slate-200 shadow-lg text-center relative group hover:border-cyan-500 transition-colors">
                    <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center mb-2">
                      <Server size={24} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">Cloud Server</span>
                    <p className="text-[10px] text-slate-500 mt-1">Real-time Sync</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature List */}
            <div className="max-w-4xl mx-auto mt-12 bg-slate-50 p-8 rounded-2xl border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <LayoutTemplate className="text-cyan-600" size={20} />
                Overview of Activities via Nidle (KANBAN, In-Line, and End-Line)
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-cyan-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700 leading-relaxed">The <strong>"Intelligent Input Management System"</strong> reduces material input complexity in the production floor following KANBAN process.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-cyan-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700 leading-relaxed">The <strong>In-Line Productivity System</strong> is in-house designed and developed as a Smart IoT device to track productivity of Operators.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-cyan-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700 leading-relaxed">The <strong>End-Line QC</strong> features quality monitoring where the system tracks defects and reworks. It decreases rework time and increases efficiency by identifying the source of your defects using live heat maps.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-cyan-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700 leading-relaxed">An <strong>Action Plan</strong> is created to help you plan and monitor improvements over time.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-cyan-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-slate-700 leading-relaxed">Your organization's performance is tracked and verified across <strong>5 levels of maturity</strong> that showcase your progress.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
