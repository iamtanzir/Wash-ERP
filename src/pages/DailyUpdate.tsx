import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { toast } from 'sonner';
import { PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function DailyUpdate() {
  const queryClient = useQueryClient();
  const { isEditor } = useAuth();
  const [formData, setFormData] = useState({
    erp_order: '',
    log_date: new Date().toISOString().split('T')[0],
    received_qty: 0,
    receive_challan: '',
    delivered_qty: 0,
    delivery_challan: '',
    ready_for_delivery_qty: 0,
    lab_samp_qty: 0,
    unit: 'INCTL',
    sub_factory: '',
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

  // Calculate generic total balances per order dynamically for the form
  const selectedOrderLogs = useMemo(() => {
    if (!formData.erp_order || !recentLogs?.items) return null;
    return recentLogs.items.filter(l => l.erp_order === formData.erp_order);
  }, [formData.erp_order, recentLogs]);

  const existingWip = useMemo(() => {
    if (!selectedOrderLogs) return 0;
    const rcv = selectedOrderLogs.reduce((s, l) => s + (l.received_qty || 0), 0);
    const del = selectedOrderLogs.reduce((s, l) => s + (l.delivered_qty || 0), 0);
    return rcv - del;
  }, [selectedOrderLogs]);

  const currentWip = existingWip + formData.received_qty - formData.delivered_qty;

  const mutation = useMutation({
    mutationFn: (data: any) => api.submitDailyLog(data),
    onSuccess: () => {
      toast.success('Daily log added successfully');
      queryClient.invalidateQueries({ queryKey: ['recentLogs'] });
      queryClient.invalidateQueries({ queryKey: ['activeOrders'] });
      setFormData(prev => ({
        ...prev,
        received_qty: 0,
        receive_challan: '',
        delivered_qty: 0,
        delivery_challan: '',
        ready_for_delivery_qty: 0,
        lab_samp_qty: 0,
        remarks: ''
      }));
      setSearchQuery('');
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
    if (formData.delivered_qty > formData.received_qty + existingWip) {
       // warning but may allow if there are logs we didn't fetch
       toast.warning("Delivery is more than known WIP, but submitting anyway.");
    }

    mutation.mutate({
      ...formData,
      created_by: "operator" // In a real app derived from auth
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 h-fit">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">New Entry</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="block font-medium text-slate-700 mb-1" title="ফাইল নির্বাচন করুন">File No (ERP Order) *</label>
              <input
                type="text"
                list="erp-orders-list"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  const val = e.target.value;
                  const matched = activeOrders?.find((o: any) => 
                     `${o.file_no}${o.color ? ` - ${o.color}` : ''} ${o.floor ? `[${o.floor}]` : ''} (${o.buyer})` === val
                  );
                  setFormData({ ...formData, erp_order: matched ? matched.id : "" });
                }}
                className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                placeholder="-- Type or Select Order --"
                required
              />
              <datalist id="erp-orders-list">
                {activeOrders?.map((o: any) => (
                  <option key={o.id} value={`${o.file_no}${o.color ? ` - ${o.color}` : ''} ${o.floor ? `[${o.floor}]` : ''} (${o.buyer})`} />
                ))}
              </datalist>
              {formData.erp_order && (
                <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                  {(() => {
                    const selected = activeOrders?.find((o: any) => o.id === formData.erp_order);
                    if (!selected) return null;
                    return (
                      <div className="flex flex-col gap-1">
                        <div><span className="font-semibold text-slate-600">Garment Sew Floor:</span> {selected.floor || 'N/A'}</div>
                        <div><span className="font-semibold text-slate-600">Color/Item:</span> {selected.color || 'N/A'}</div>
                        <div><span className="font-semibold text-slate-600">Wash Type:</span> {selected.wash_type || 'N/A'}</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1" title="তারিখ">Log Date *</label>
              <input 
                type="date"
                value={formData.log_date}
                onChange={e => setFormData({ ...formData, log_date: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="গ্রহণ পরিমাণ">Rcv Qty</label>
                <input 
                  type="number"
                  min="0"
                  value={formData.received_qty}
                  onChange={e => setFormData({ ...formData, received_qty: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="গ্রহণ চালান">Rcv Challan</label>
                <input 
                  type="text"
                  value={formData.receive_challan}
                  onChange={e => setFormData({ ...formData, receive_challan: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="ডেলিভারি পরিমাণ">Del Qty</label>
                <input 
                  type="number"
                  min="0"
                  value={formData.delivered_qty}
                  onChange={e => setFormData({ ...formData, delivered_qty: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="ডেলিভারি চালান">Del Challan</label>
                <input 
                  type="text"
                  value={formData.delivery_challan}
                  onChange={e => setFormData({ ...formData, delivery_challan: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="প্রস্তুত डिलीवरी">Ready For Del</label>
                <input 
                  type="number"
                  min="0"
                  value={formData.ready_for_delivery_qty}
                  onChange={e => setFormData({ ...formData, ready_for_delivery_qty: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="ল্যাব/স্যাম্পল">Lab/Samp Qty</label>
                <input 
                  type="number"
                  min="0"
                  value={formData.lab_samp_qty}
                  onChange={e => setFormData({ ...formData, lab_samp_qty: parseInt(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                />
              </div>
            </div>

            {formData.erp_order && (
              <div className="bg-slate-50 rounded p-3 text-xs border border-slate-100 flex justify-between items-center">
                <span className="text-slate-500 font-medium">Estimated New WIP:</span>
                <span className={`font-bold text-base tabular-nums ${currentWip < 0 ? 'text-red-500' : 'text-orange-600'}`}>{formatNumber(currentWip)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="ইউনিট">Unit</label>
                <select 
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                >
                  <option value="INCTL">INCTL</option>
                  <option value="NKFL">NKFL</option>
                  <option value="B2B">B2B</option>
                  <option value="Outside">Outside</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1" title="সাব-ফ্যাক্টরি">Sub-Factory</label>
                <input 
                  type="text"
                  value={formData.sub_factory}
                  onChange={e => setFormData({ ...formData, sub_factory: e.target.value })}
                  className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                  placeholder="Wash Plant"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1" title="মন্তব্য">Remarks</label>
              <input 
                type="text"
                value={formData.remarks}
                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
                placeholder="Optional notes..."
              />
            </div>

            <button 
              type="submit"
              disabled={mutation.isPending || !isEditor}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded transition-colors"
            >
              {mutation.isPending ? 'Saving...' : !isEditor ? 'Read-Only (Viewer)' : 'Save Log Entry'}
            </button>
          </form>
        </div>

        {/* Recent Logs Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[420px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-sm font-bold text-slate-700 uppercase">Recent Transactions</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">File No</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Rcv Qty</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Del Qty</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Unit</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading logs...</td></tr>}
                {recentLogs?.items?.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500 italic">No recent transactions</td></tr>
                )}
                {recentLogs?.items?.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{formatDate(log.log_date)}</td>
                    <td className="px-6 py-4 font-medium text-blue-600 font-mono flex flex-col gap-0.5">
                      <span>{log.expand?.erp_order?.file_no || 'Unknown'}</span>
                      {log.expand?.erp_order?.color && <span className="text-xs text-slate-400 font-sans">{log.expand?.erp_order?.color}</span>}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-emerald-600 font-medium">
                      {log.received_qty > 0 ? `+${formatNumber(log.received_qty)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-orange-600 font-medium">
                      {log.delivered_qty > 0 ? `+${formatNumber(log.delivered_qty)}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[10px] uppercase font-bold text-slate-600">{log.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 truncate max-w-[150px]" title={log.remarks}>{log.remarks || '-'}</td>
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
