import { useQuery } from '@tanstack/react-query';
import { api, DailyLog, Order } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { useState, useMemo } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Filter, PlusCircle, Database } from 'lucide-react';

interface OrderStats {
  order: Order;
  todayRcv: number;
  totalRcv: number;
  todayDel: number;
  totalDel: number;
  totalReady: number;
  unit: string;
  firstRcvDate?: string;
  balance: number;
  latestRemarks: string;
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    unit: '',
    receivedDate: '',
    styleNo: '',
    buyer: '',
    erpFile: '',
    color: '',
    ordQty: '',
    todayRcv: '',
    totalRcv: '',
    todayDel: '',
    totalDel: '',
    balance: '',
    readyForDelivery: '',
    washType: '',
    floor: ''
  });

  const { data: activeOrders, isLoading: loadingOrders } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.getActiveOrders()
  });

  const { data: allLogsRes, isLoading: loadingLogs } = useQuery({
    queryKey: ['recentLogsDashboard'],
    queryFn: () => api.getRecentLogs(5000) 
  });

  const processedData = useMemo(() => {
    if (!activeOrders || !allLogsRes) return { grouped: {} as Record<string, OrderStats[]>, totalWip: 0, todayRcv: 0, todayDel: 0, grandTotals: { ordQty: 0, todayRcv: 0, totalRcv: 0, todayDel: 0, totalDel: 0, balance: 0, ready: 0 }};

    const todayStr = new Date().toISOString().split('T')[0];
    const statsMap = new Map<string, OrderStats>();

    activeOrders.forEach(o => {
      statsMap.set(o.id!, {
        order: o,
        todayRcv: 0,
        totalRcv: 0,
        todayDel: 0,
        totalDel: 0,
        totalReady: 0,
        unit: 'INCTL', // default
        balance: 0,
        latestRemarks: o.remarks || ''
      });
    });

    const logs = allLogsRes.items || [];
    // sort logs ascending by date
    const sortedLogs = [...logs].sort((a,b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime());

    sortedLogs.forEach(log => {
      if (statsMap.has(log.erp_order)) {
        const stats = statsMap.get(log.erp_order)!;
        stats.totalRcv += log.received_qty || 0;
        stats.totalDel += log.delivered_qty || 0;
        
        if (log.log_date.startsWith(todayStr)) {
          stats.todayRcv += log.received_qty || 0;
          stats.todayDel += log.delivered_qty || 0;
        }
        
        stats.balance = stats.totalRcv - stats.totalDel;
        stats.unit = log.unit || stats.unit; // take the latest unit
        
        // Use most recent valid values for some fields
        if (!stats.firstRcvDate && log.received_qty && log.received_qty > 0) {
          stats.firstRcvDate = log.log_date;
        }
        if (log.remarks) {
          stats.latestRemarks = log.remarks;
        }
        stats.totalReady = log.ready_for_delivery_qty || 0; 
      }
    });

    const grouped: Record<string, OrderStats[]> = {};
    let totalWip = 0, todayRcv = 0, todayDel = 0;
    
    const grandTotals = {
      ordQty: 0,
      todayRcv: 0,
      totalRcv: 0,
      todayDel: 0,
      totalDel: 0,
      balance: 0,
      ready: 0
    };

    Array.from(statsMap.values()).forEach(stat => {
      if (!grouped[stat.unit]) grouped[stat.unit] = [];
      grouped[stat.unit].push(stat);
      
      totalWip += stat.balance;
      todayRcv += stat.todayRcv;
      todayDel += stat.todayDel;
      
      grandTotals.ordQty += stat.order.order_qty || 0;
      grandTotals.todayRcv += stat.todayRcv;
      grandTotals.totalRcv += stat.totalRcv;
      grandTotals.todayDel += stat.todayDel;
      grandTotals.totalDel += stat.totalDel;
      grandTotals.balance += stat.balance;
      grandTotals.ready += stat.totalReady;
    });

    return { grouped, totalWip, todayRcv, todayDel, grandTotals };
  }, [activeOrders, allLogsRes]);

  const { grouped, totalWip, todayRcv, todayDel, grandTotals } = processedData;

  // Extract unique values for filters
  const filterOptions = useMemo(() => {
    const flatStats = Object.values(grouped).flat() as OrderStats[];
    return {
      unit: Array.from(new Set(Object.keys(grouped))).sort(),
      receivedDate: Array.from(new Set(flatStats.map(s => s.firstRcvDate ? formatDate(s.firstRcvDate) : '-'))).sort(),
      styleNo: Array.from(new Set(flatStats.map(s => s.order.style_no).filter(Boolean))).sort(),
      buyer: Array.from(new Set(flatStats.map(s => s.order.buyer).filter(Boolean))).sort(),
      erpFile: Array.from(new Set(flatStats.map(s => s.order.file_no).filter(Boolean))).sort(),
      color: Array.from(new Set(flatStats.map(s => s.order.color).filter(Boolean))).sort(),
      ordQty: Array.from(new Set(flatStats.map(s => formatNumber(s.order.order_qty)))).sort(),
      todayRcv: Array.from(new Set(flatStats.map(s => s.todayRcv > 0 ? formatNumber(s.todayRcv) : '0'))).sort(),
      totalRcv: Array.from(new Set(flatStats.map(s => s.totalRcv > 0 ? formatNumber(s.totalRcv) : '0'))).sort(),
      todayDel: Array.from(new Set(flatStats.map(s => s.todayDel > 0 ? formatNumber(s.todayDel) : '0'))).sort(),
      totalDel: Array.from(new Set(flatStats.map(s => s.totalDel > 0 ? formatNumber(s.totalDel) : '0'))).sort(),
      balance: Array.from(new Set(flatStats.map(s => formatNumber(s.balance)))).sort(),
      readyForDelivery: Array.from(new Set(flatStats.map(s => s.totalReady > 0 ? formatNumber(s.totalReady) : '0'))).sort(),
      washType: Array.from(new Set(flatStats.map(s => s.order.wash_type).filter(Boolean))).sort(),
      floor: Array.from(new Set(flatStats.map(s => s.order.sew_floor).filter(Boolean))).sort(),
    };
  }, [grouped]);

  const filteredGroups = useMemo<Record<string, OrderStats[]>>(() => {
    const s = search.toLowerCase();
    const result: Record<string, OrderStats[]> = {};
    
    Object.keys(grouped).forEach(unit => {
      // First apply unit filter if set
      if (columnFilters.unit && unit !== columnFilters.unit) return;

      const filtered = grouped[unit].filter(stat => {
        // Global search
        const matchesSearch = !s || (
          stat.order.file_no.toLowerCase().includes(s) ||
          stat.order.buyer.toLowerCase().includes(s) ||
          (stat.order.style_no && stat.order.style_no.toLowerCase().includes(s))
        );

        const rcvDateStr = stat.firstRcvDate ? formatDate(stat.firstRcvDate) : '-';
        // Column filters
        const matchesDate = !columnFilters.receivedDate || rcvDateStr === columnFilters.receivedDate;
        const matchesStyle = !columnFilters.styleNo || stat.order.style_no === columnFilters.styleNo;
        const matchesBuyer = !columnFilters.buyer || stat.order.buyer === columnFilters.buyer;
        const matchesErp = !columnFilters.erpFile || stat.order.file_no === columnFilters.erpFile;
        const matchesColor = !columnFilters.color || stat.order.color === columnFilters.color;
        const matchesOrdQty = !columnFilters.ordQty || formatNumber(stat.order.order_qty) === columnFilters.ordQty;
        const matchesTodayRcv = !columnFilters.todayRcv || (stat.todayRcv > 0 ? formatNumber(stat.todayRcv) : '0') === columnFilters.todayRcv;
        const matchesTotalRcv = !columnFilters.totalRcv || (stat.totalRcv > 0 ? formatNumber(stat.totalRcv) : '0') === columnFilters.totalRcv;
        const matchesTodayDel = !columnFilters.todayDel || (stat.todayDel > 0 ? formatNumber(stat.todayDel) : '0') === columnFilters.todayDel;
        const matchesTotalDel = !columnFilters.totalDel || (stat.totalDel > 0 ? formatNumber(stat.totalDel) : '0') === columnFilters.totalDel;
        const matchesBalance = !columnFilters.balance || formatNumber(stat.balance) === columnFilters.balance;
        const matchesReadyForDelivery = !columnFilters.readyForDelivery || (stat.totalReady > 0 ? formatNumber(stat.totalReady) : '0') === columnFilters.readyForDelivery;
        const matchesWash = !columnFilters.washType || stat.order.wash_type === columnFilters.washType;
        const matchesFloor = !columnFilters.floor || stat.order.sew_floor === columnFilters.floor;

        return matchesSearch && matchesDate && matchesStyle && matchesBuyer && matchesErp && matchesColor && matchesOrdQty && matchesTodayRcv && matchesTotalRcv && matchesTodayDel && matchesTotalDel && matchesBalance && matchesReadyForDelivery && matchesWash && matchesFloor;
      });
      if (filtered.length > 0) result[unit] = filtered;
    });
    return result;
  }, [grouped, search, columnFilters]);

  if (loadingOrders || loadingLogs) {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  }

  const handleFilterChange = (column: keyof typeof columnFilters, value: string) => {
    setColumnFilters(prev => ({ ...prev, [column]: value }));
  };

  const FilterSelect = ({ column, options, label }: { column: keyof typeof columnFilters, options: any[], label: React.ReactNode }) => (
    <div className="flex flex-col gap-1 items-center">
      <span className="text-center">{label}</span>
      <select
        className="w-full max-w-[80px] text-[9px] border border-yellow-300 rounded bg-white text-slate-700 font-normal py-0.5 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={columnFilters[column]}
        onChange={(e) => handleFilterChange(column, e.target.value)}
      >
        <option value="">All</option>
        {options.map((opt: any) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="w-full mx-auto space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Active Orders</p>
          <p className="text-3xl font-light text-slate-800 mt-1">{activeOrders?.length || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Today's Receive</p>
          <p className="text-3xl font-light text-blue-600 mt-1">{formatNumber(todayRcv)} <span className="text-sm font-normal text-slate-400">pcs</span></p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Today's Delivery</p>
          <p className="text-3xl font-light text-emerald-600 mt-1">{formatNumber(todayDel)} <span className="text-sm font-normal text-slate-400">pcs</span></p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase" title="WIP from recent logs">Pending Balance (WIP)</p>
          <p className="text-3xl font-light text-orange-600 mt-1">{formatNumber(Math.max(0, totalWip))} <span className="text-sm font-normal text-slate-400">pcs</span></p>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/new-plan" className="group bg-blue-600 p-6 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]">
          <div className="text-white">
            <h4 className="text-xl font-black mt-1">NEXT ERP PLAN</h4>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
            <PlusCircle size={32} />
          </div>
        </Link>
        <Link to="/cpl-report" className="group bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-500/20 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]">
          <div className="text-white">
            <h4 className="text-xl font-black mt-1">CPL FABRIC REPORT</h4>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white group-hover:rotate-12 transition-transform">
            <Filter size={32} />
          </div>
        </Link>
        <Link to="/data-bank" className="group bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-500/5 flex items-center justify-between transition-all hover:scale-[1.02] active:scale-[0.98]">
          <div className="text-slate-900">
            <h4 className="text-xl font-black mt-1">BUYER DATA BANK (DB)</h4>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900 group-hover:rotate-12 transition-transform border border-slate-200">
            <Database size={32} />
          </div>
        </Link>
      </div>

      {/* Orders Table */}
      <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full min-h-[420px]">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Garments Wash Status Report (GMT)</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Search File/Style..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs border border-slate-300 rounded px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Link to="/new-plan" className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 transition-colors">
              + New Plan
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-yellow-100 border-b border-yellow-200">
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 z-10 bg-yellow-100 border-r border-yellow-200 align-top">
                  <FilterSelect column="unit" options={filterOptions.unit} label="Unit" />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center border-r border-yellow-200 align-top">
                  <FilterSelect column="receivedDate" options={filterOptions.receivedDate} label="Received Date" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="styleNo" options={filterOptions.styleNo} label="Style NO" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="buyer" options={filterOptions.buyer} label="Buyer" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="erpFile" options={filterOptions.erpFile} label="ERP/File" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="color" options={filterOptions.color} label="Color" />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-center border-r border-yellow-200 align-top">
                  <span>ERP Date</span>
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="ordQty" options={filterOptions.ordQty} label={<>Ord Qty<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="todayRcv" options={filterOptions.todayRcv} label={<>Today Received<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="totalRcv" options={filterOptions.totalRcv} label={<>Total Received<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="todayDel" options={filterOptions.todayDel} label={<>Today Delivery<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="totalDel" options={filterOptions.totalDel} label={<>Total Delivery<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="balance" options={filterOptions.balance} label={<>Balance<br/>(pcs)</>} />
                </th>
                <th className="px-2 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right border-r border-yellow-200 align-top">
                  <FilterSelect column="readyForDelivery" options={filterOptions.readyForDelivery} label={<>Ready For Delivery<br/>(pcs)</>} />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="washType" options={filterOptions.washType} label="Type of Wash" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider border-r border-yellow-200 align-top">
                  <FilterSelect column="floor" options={filterOptions.floor} label="Floor" />
                </th>
                <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wider min-w-[200px] align-top pt-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700 bg-white">
              {Object.keys(filteredGroups).length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-8 text-center text-slate-500 italic">No active orders found</td>
                </tr>
              ) : (
                Object.entries(filteredGroups).map(([unit, stats]: [string, OrderStats[]]) => {
                  const unitGrand = stats.reduce((acc, stat) => {
                    acc.ord += stat.order.order_qty || 0;
                    acc.tRcv += stat.todayRcv;
                    acc.totRcv += stat.totalRcv;
                    acc.tDel += stat.todayDel;
                    acc.totDel += stat.totalDel;
                    acc.bal += stat.balance;
                    acc.ready += stat.totalReady;
                    return acc;
                  }, { ord: 0, tRcv: 0, totRcv: 0, tDel: 0, totDel: 0, bal: 0, ready: 0 });

                  return (
                    <React.Fragment key={unit}>
                      {stats.map((stat, idx) => (
                        <tr key={stat.order.id} className="hover:bg-blue-50/50">
                          {idx === 0 && (
                            <td rowSpan={stats.length + 1} className="p-2 border-r border-b border-slate-200 font-bold bg-[#43a1c6] text-white text-center transform -rotate-180" style={{ writingMode: 'vertical-rl' }}>
                              <span>{unit}</span>
                            </td>
                          )}
                          <td className="px-2 py-3 text-center border-r border-slate-200 whitespace-nowrap">{stat.firstRcvDate ? formatDate(stat.firstRcvDate) : '-'}</td>
                          <td className="px-3 py-3 border-r border-slate-200">{stat.order.style_no || '-'}</td>
                          <td className="px-3 py-3 border-r border-slate-200 font-medium italic font-serif">{stat.order.buyer}</td>
                          <td className="px-3 py-3 border-r border-slate-200 font-mono text-blue-600 font-bold">{stat.order.file_no}</td>
                          <td className="px-3 py-3 border-r border-slate-200">{stat.order.color || '-'}</td>
                          <td className="px-2 py-3 text-center border-r border-slate-200 whitespace-nowrap text-slate-500">{stat.order.erp_date ? formatDate(stat.order.erp_date) : '-'}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{formatNumber(stat.order.order_qty)}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{stat.todayRcv > 0 ? formatNumber(stat.todayRcv) : 0}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{stat.totalRcv > 0 ? formatNumber(stat.totalRcv) : 0}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{stat.todayDel > 0 ? formatNumber(stat.todayDel) : 0}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{stat.totalDel > 0 ? formatNumber(stat.totalDel) : 0}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums font-semibold text-orange-600">{formatNumber(stat.balance)}</td>
                          <td className="px-2 py-3 text-right border-r border-slate-200 tabular-nums">{stat.totalReady > 0 ? formatNumber(stat.totalReady) : 0}</td>
                          <td className="px-3 py-3 border-r border-slate-200">{stat.order.wash_type || '-'}</td>
                          <td className="px-3 py-3 border-r border-slate-200">{stat.order.sew_floor || '-'}</td>
                          <td className="px-3 py-3 text-slate-500 italic">{stat.latestRemarks || '-'}</td>
                        </tr>
                      ))}
                      {/* Unit Total Row */}
                      <tr className="bg-yellow-200/50 font-bold border-b-2 border-yellow-300">
                        <td colSpan={5} className="px-3 py-3 text-center border-r border-slate-300">{unit} Total</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.ord)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.tRcv)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.totRcv)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.tDel)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.totDel)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums text-orange-600">{formatNumber(unitGrand.bal)}</td>
                        <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(unitGrand.ready)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {Object.keys(filteredGroups).length > 0 && (
              <tfoot>
                <tr className="bg-slate-200 font-bold border-t-2 border-slate-300 text-xs">
                  <td colSpan={6} className="px-3 py-3 text-center border-r border-slate-300 uppercase tracking-widest">G.Total</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.ordQty)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.todayRcv)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.totalRcv)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.todayDel)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.totalDel)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums text-orange-700">{formatNumber(grandTotals.balance)}</td>
                  <td className="px-2 py-3 text-right border-r border-slate-300 tabular-nums">{formatNumber(grandTotals.ready)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
