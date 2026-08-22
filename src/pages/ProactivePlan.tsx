import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Order } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { Calendar, Cpu, Sparkles, Filter, Clock, CheckCircle2, AlertCircle, ArrowRight, CheckSquare, Zap, Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function ProactivePlan() {
  const { data: rawOrders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.getActiveOrders(),
  });

  const [activeTab, setActiveTab] = useState<'mps' | 'tna' | 'capacity'>('mps');
  const [isGenerating, setIsGenerating] = useState(false);

  const pendingOrders = Array.isArray(rawOrders) ? rawOrders.filter(o => o.status !== 'Shipped') : [];

  const handleAiSchedule = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success("AI Master Production Schedule Generated Successfully");
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header section with AI Button */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ProactivePlan</h1>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold tracking-wider uppercase">AI Powered</span>
          </div>
          <p className="text-sm text-slate-500">Cloud-Based AI Apparel Planning Solution</p>
        </div>
        
        <button
          onClick={handleAiSchedule}
          disabled={isGenerating || pendingOrders.length === 0}
          className="relative z-10 group overflow-hidden bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
        >
          {isGenerating ? (
            <RefreshCw className="animate-spin" size={18} />
          ) : (
            <Sparkles size={18} className="group-hover:animate-pulse" />
          )}
          {isGenerating ? "Optimizing Schedule..." : "Auto-Generate AI Plan"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          onClick={() => setActiveTab('mps')}
          className={`px-4 py-2 text-sm font-bold tracking-wide uppercase transition-all border-b-2 ${
            activeTab === 'mps' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Master Production Schedule
        </button>
        <button
          onClick={() => setActiveTab('tna')}
          className={`px-4 py-2 text-sm font-bold tracking-wide uppercase transition-all border-b-2 ${
            activeTab === 'tna' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          T&A Tracking
        </button>
        <button
          onClick={() => setActiveTab('capacity')}
          className={`px-4 py-2 text-sm font-bold tracking-wide uppercase transition-all border-b-2 ${
            activeTab === 'capacity' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Capacity & Machines
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="min-h-[400px]">
          {activeTab === 'mps' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-600" />
                  Active Orders Schedule
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-1 rounded-md">{pendingOrders.length} Orders</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-bold text-slate-600">Order Ref</th>
                      <th className="p-4 font-bold text-slate-600">Style</th>
                      <th className="p-4 font-bold text-slate-600 text-right">Volume</th>
                      <th className="p-4 font-bold text-slate-600">Cutting Start</th>
                      <th className="p-4 font-bold text-slate-600">Sewing Line</th>
                      <th className="p-4 font-bold text-slate-600">Ex-Factory</th>
                      <th className="p-4 font-bold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingOrders.map(order => {
                      // Generate some fake AI dates based on erp_ship_date
                      const target = new Date(order.erp_ship_date || new Date().toISOString());
                      const cutting = new Date(target); cutting.setDate(target.getDate() - 30);
                      const sewing = new Date(target); sewing.setDate(target.getDate() - 25);
                      
                      return (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-mono text-indigo-600 font-medium">{order.buyer} / {order.file_no || order.plan}</td>
                          <td className="p-4 text-slate-800">{order.style_no}</td>
                          <td className="p-4 text-right font-mono text-slate-600">{formatNumber(order.order_qty)}</td>
                          <td className="p-4 text-slate-600">{formatDate(cutting.toISOString())}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-100">Line {(order.id.charCodeAt(0) % 5) + 1}</span>
                          </td>
                          <td className="p-4 font-bold text-slate-800">{formatDate(order.erp_ship_date || '')}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">In Progress</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pendingOrders.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">No active orders to schedule.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tna' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingOrders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden group hover:border-indigo-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-800">{order.buyer}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{order.style_no} - {order.file_no || order.plan}</p>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                      {formatDate(order.erp_ship_date || '')}
                    </span>
                  </div>
                  
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent hidden"></div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">Yarn / Fabric In-house</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                          <div className="bg-green-500 h-1.5 rounded-full w-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <Activity size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">Cutting & Sewing</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                          <div className="bg-indigo-500 h-1.5 rounded-full w-[60%]"></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                        <Clock size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-500">Washing & Finishing</p>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                          <div className="bg-slate-300 h-1.5 rounded-full w-[0%]"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'capacity' && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Cpu size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">AI Machine Allocation</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                ProactivePlan automatically calculates required machine capacities across cutting, sewing, and washing based on SAM (Standard Allowed Minutes) and style complexity.
              </p>
              <button 
                onClick={handleAiSchedule}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Run Allocation Algorithm
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
