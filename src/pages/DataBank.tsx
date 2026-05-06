import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Download, Filter, Search } from 'lucide-react';
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

  const { data: archiveData, isLoading } = useQuery({
    queryKey: ['archiveData', filters],
    queryFn: () => api.getArchiveData(filters)
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
        <div className="hidden">
          <h1 className="text-2xl font-bold text-slate-900">All Buyer Data</h1>
          <p className="text-slate-500 text-sm mt-1">Immutable archive of closed ERP orders.</p>
        </div>
        <div className="flex items-center gap-2">
           <Filter className="w-4 h-4 text-slate-400" />
           <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Filter Archive</h3>
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
                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Floor</th>
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
                  <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700 italic font-serif">{item.buyer}</td>
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
                    <td className="px-6 py-4 text-center">
                      <span className="px-2 py-1 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600 tracking-wider font-mono">{item.wash_type}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500 uppercase text-[10px] font-bold tracking-wider">{item.sew_floor}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
