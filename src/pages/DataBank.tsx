import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DailyLog } from '../lib/api';
import { Download, Filter, Search, History, X, Calendar, FileText, CheckCircle2, PlusCircle } from 'lucide-react';
import { formatNumber, formatDate } from '../lib/utils';
import { BUYERS } from '../lib/constants';
import { toast } from 'sonner';
import Papa from 'papaparse';

export default function DataBank() {
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

  const handleExport = () => {
    if (!archiveData || archiveData.length === 0) {
      toast.warning("No data to export");
      return;
    }

    const exportedData = archiveData.map(item => ({
      'Buyer': item.buyer,
      'File No': item.file_no,
      'Style No': item.style_no,
      'Order Qty': item.order_qty,
      'Total Received': item.total_received,
      'Total Delivered': item.total_delivered,
      'Close Date': item.close_date.split('T')[0],
      'Final Del Qty': item.final_delivered_qty,
      'Wash Type': item.wash_type,
      'Sew Floor': item.sew_floor,
      'Closed By': item.closed_by,
      'Locked At': item.locked_at ? item.locked_at.split('T')[0] : ''
    }));

    const csv = Papa.unparse(exportedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `inctl_wash_erp_archive_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("CSV Exported successfully");
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
           <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Filter Archive</h3>
           </div>
        </div>
        <button 
          onClick={handleExport}
          disabled={isLoading || archiveData?.length === 0}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded font-medium transition-colors text-sm shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV ({archiveData?.length || 0})
        </button>
      </div>

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
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">To Date</label>
            <input 
              type="date"
              value={filters.to_date}
              onChange={e => handleFilterChange('to_date', e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
            />
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

      {/* History Modal */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col scale-in-95 duration-200">
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
      )}
    </div>
  );
}
