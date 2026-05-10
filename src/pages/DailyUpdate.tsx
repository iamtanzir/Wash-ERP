import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { PlusCircle, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function DailyUpdate() {
  const queryClient = useQueryClient();
  const { isEditor } = useAuth();
  
  // Tree Structure States
  const [transactionType, setTransactionType] = useState<'received' | 'delivery'>('received');
  const [entryCategory, setEntryCategory] = useState<'GMT' | 'CPL'>('GMT');
  const [gmtFloor, setGmtFloor] = useState('G.F (INCTL)');
  const [cplUnit, setCplUnit] = useState('INCTL');
  const [entryQuantity, setEntryQuantity] = useState<number>(0);
  const [displayColor, setDisplayColor] = useState('');

  const [formData, setFormData] = useState({
    erp_order: '',
    log_date: new Date().toISOString().split('T')[0],
    remarks: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: activeOrders } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.getActiveOrders()
  });

  const { data: recentLogs, isLoading } = useQuery({
    queryKey: ['recentLogs'],
    queryFn: () => api.getRecentLogs(50)
  });

  const selectedOrderLogs = useMemo(() => {
    if (!formData.erp_order || !recentLogs?.items) return null;
    return recentLogs.items.filter(l => l.expand?.erp_order?.id === formData.erp_order || l.erp_order === formData.erp_order);
  }, [formData.erp_order, recentLogs]);

  const existingWip = useMemo(() => {
    if (!selectedOrderLogs) return 0;
    const rcv = selectedOrderLogs.reduce((s, l) => s + (l.received_qty || 0), 0);
    const del = selectedOrderLogs.reduce((s, l) => s + (l.delivered_qty || 0), 0);
    return rcv - del;
  }, [selectedOrderLogs]);

  const currentWip = existingWip + (transactionType === 'received' ? entryQuantity : 0) - (transactionType === 'delivery' ? entryQuantity : 0);

  const mutation = useMutation({
    mutationFn: (data: any) => api.submitDailyLog(data),
    onSuccess: () => {
      toast.success('Daily log added successfully');
      queryClient.invalidateQueries({ queryKey: ['recentLogs'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      setFormData(prev => ({
        ...prev,
        remarks: ''
      }));
      setEntryQuantity(0);
      setSearchQuery('');
      setDisplayColor('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add daily log');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.erp_order) {
      toast.error("Please select an ERP Order");
      return;
    }
    if (entryQuantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    if (transactionType === 'delivery' && entryQuantity > existingWip) {
       toast.warning("Delivery is more than known WIP, but submitting anyway.");
    }

    mutation.mutate({
      ...formData,
      received_qty: transactionType === 'received' ? entryQuantity : 0,
      delivered_qty: transactionType === 'delivery' ? entryQuantity : 0,
      unit: entryCategory === 'GMT' ? gmtFloor : cplUnit,
      created_by: "operator" // In a real app derived from auth
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">DAILY DATA ENTRY</h1>
          <p className="text-slate-500 text-sm">Log production updates for active ERP plans</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold uppercase tracking-wider">Live Sync Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Entry Form - Bento Style */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Entry Panel</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-mono italic">v2.1 Stable</span>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* 1. Transaction Type */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all ${transactionType === 'received' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <input type="radio" name="transactionType" value="received" checked={transactionType === 'received'} onChange={() => setTransactionType('received')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${transactionType === 'received' ? 'border-emerald-500' : 'border-slate-300'}`}>
                      {transactionType === 'received' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                    <span className={`text-sm font-bold ${transactionType === 'received' ? 'text-emerald-700' : 'text-slate-600'}`}>Received</span>
                  </label>
                  <label className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all ${transactionType === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <input type="radio" name="transactionType" value="delivery" checked={transactionType === 'delivery'} onChange={() => setTransactionType('delivery')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${transactionType === 'delivery' ? 'border-orange-500' : 'border-slate-300'}`}>
                      {transactionType === 'delivery' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                    </div>
                    <span className={`text-sm font-bold ${transactionType === 'delivery' ? 'text-orange-700' : 'text-slate-600'}`}>Delivery</span>
                  </label>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              {/* 2. Date */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Log Date *</label>
                <input 
                  type="date"
                  value={formData.log_date}
                  onChange={e => setFormData({ ...formData, log_date: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all font-mono"
                  required
                />
              </div>

              {/* 3. Entry Category */}
              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Entry Category *</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all ${entryCategory === 'GMT' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <input type="radio" value="GMT" checked={entryCategory === 'GMT'} onChange={() => setEntryCategory('GMT')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${entryCategory === 'GMT' ? 'border-blue-500' : 'border-slate-300'}`}>
                      {entryCategory === 'GMT' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className={`text-sm font-bold ${entryCategory === 'GMT' ? 'text-blue-700' : 'text-slate-600'}`}>GMT (Garments)</span>
                  </label>
                  <label className={`flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all ${entryCategory === 'CPL' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <input type="radio" value="CPL" checked={entryCategory === 'CPL'} onChange={() => setEntryCategory('CPL')} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${entryCategory === 'CPL' ? 'border-indigo-500' : 'border-slate-300'}`}>
                      {entryCategory === 'CPL' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                    <span className={`text-sm font-bold ${entryCategory === 'CPL' ? 'text-indigo-700' : 'text-slate-600'}`}>CPL (Fabric)</span>
                  </label>
                </div>

                {entryCategory === 'GMT' ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Floor Selection</label>
                    <select value={gmtFloor} onChange={e => setGmtFloor(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 font-bold text-slate-700">
                      <option value="G.F (INCTL)">G.F (INCTL)</option>
                      <option value="1st.F (INCTL)">1st.F (INCTL)</option>
                      <option value="2nd.F (INCTL)">2nd.F (INCTL)</option>
                      <option value="K.F (NKFL)">K.F (NKFL)</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Selection</label>
                    <select value={cplUnit} onChange={e => setCplUnit(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 font-bold text-slate-700">
                      <option value="INCTL">INCTL</option>
                      <option value="Textile Unit">Textile Unit</option>
                      <option value="R&D">R&D</option>
                      <option value="NKFL">NKFL</option>
                      <option value="B2B">B2B</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-100" />

              {/* 4. ERP/File Reference */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ERP / File Reference *</label>
                <div className="relative group">
                  <input
                    type="text"
                    list="erp-orders-list"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      const val = e.target.value;
                      const matched = activeOrders?.find((o: any) => 
                         `${o.file_no}${o.color ? ` - ${o.color}` : ''} (${o.buyer})` === val
                      );
                      if (matched) {
                        setFormData({ ...formData, erp_order: matched.id });
                        setDisplayColor(matched.color || '');
                      } else {
                        setFormData({ ...formData, erp_order: "" });
                      }
                    }}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-all font-medium text-slate-700"
                    placeholder="Start typing file no..."
                    required
                  />
                  <datalist id="erp-orders-list">
                    {activeOrders?.map((o: any) => (
                      <option key={o.id} value={`${o.file_no}${o.color ? ` - ${o.color}` : ''} (${o.buyer})`} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 5. Color / Combo */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Color / Combo</label>
                <input 
                  type="text"
                  value={displayColor}
                  onChange={e => setDisplayColor(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-slate-700"
                  placeholder="e.g. Jet Black"
                />
              </div>

              {/* 6. Order Quantity */}
              <div className="space-y-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                <label className="text-[11px] font-black text-blue-800 uppercase tracking-wider">
                  {transactionType === 'received' ? 'Receive Quantity' : 'Delivery Quantity'} *
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    min="0"
                    value={entryQuantity || ''}
                    onChange={e => setEntryQuantity(parseInt(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-blue-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-500 transition-all font-black text-blue-900 pr-12"
                    placeholder="0"
                    required
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-blue-400">
                    {entryCategory === 'GMT' ? 'pcs' : 'kg'}
                  </div>
                </div>
              </div>

              {/* Auto Calculation Block */}
              {formData.erp_order && (
                <div className="bg-slate-900 rounded-xl p-4 shadow-lg space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Received</span>
                    <span className="text-xs font-mono text-emerald-400">
                      {formatNumber(selectedOrderLogs?.reduce((sum, l) => sum + (l.received_qty || 0), 0) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Delivered</span>
                    <span className="text-xs font-mono text-orange-400">
                      {formatNumber(selectedOrderLogs?.reduce((sum, l) => sum + (l.delivered_qty || 0), 0) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-300 uppercase font-black tracking-widest">WIP / Balance</span>
                      <span className="text-[9px] text-slate-500">After this entry</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xl font-black tabular-nums ${currentWip < 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {formatNumber(currentWip)}
                      </span>
                      <span className="text-[9px] text-slate-500">{entryCategory === 'GMT' ? 'PCS' : 'KG'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-100" />

              {/* 7. Remarks */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                <textarea 
                  value={formData.remarks}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-all text-slate-700 h-16 resize-none"
                  placeholder="Optional notes..."
                />
              </div>

              <button 
                type="submit"
                disabled={mutation.isPending || !isEditor || entryQuantity <= 0}
                className="w-full bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
              >
                {mutation.isPending ? 'Processing...' : !isEditor ? 'Restricted Access' : 'Save & Post Entry'}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Logs Table - Wide Style */}
        <div className="lg:col-span-8 bg-white rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col h-full min-h-[600px]">
          <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <History className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Transaction History</h2>
                <p className="text-[10px] text-slate-400">Showing last 50 entries</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 uppercase">Automated Log</div>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">File Identity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rcv</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Del</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && <tr><td colSpan={6} className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>}
                {recentLogs?.items?.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-medium italic">No transactions found in this session</td></tr>
                )}
                {recentLogs?.items?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-mono text-xs">{formatDate(log.log_date)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700 tracking-tight">{log.expand?.erp_order?.file_no || '---'}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-blue-500 font-bold uppercase">{log.expand?.erp_order?.buyer}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-[10px] text-slate-400 italic">{log.expand?.erp_order?.color || 'No Color'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-emerald-600 font-black text-xs">
                      {log.received_qty > 0 ? `+${formatNumber(log.received_qty)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-orange-600 font-black text-xs">
                      {log.delivered_qty > 0 ? `+${formatNumber(log.delivered_qty)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-900 px-2 py-0.5 rounded text-[9px] uppercase font-black text-white">{log.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs italic group-hover:text-slate-600 transition-colors">{log.remarks || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
