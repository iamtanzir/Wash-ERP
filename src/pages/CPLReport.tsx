import { useQuery } from '@tanstack/react-query';
import { api, DailyLog, Order } from '../lib/api';
import { formatNumber, formatDate } from '../lib/utils';
import { useState, useMemo } from 'react';
import React from 'react';
import { Link } from 'react-router-dom';

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

export default function CplReport() {
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    unit: '',
    buyer: '',
    erpFile: '',
    styleNo: '',
    color: '',
    erpShipDate: '',
    receivedDate: '',
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
    queryKey: ['activeOrdersCPL'],
    queryFn: () => api.getActiveOrders()
  });

  const { data: allLogsRes, isLoading: loadingLogs } = useQuery({
    queryKey: ['recentLogsCPL'],
    queryFn: () => api.getRecentLogs(5000) 
  });

  const processedData = useMemo(() => {
    if (!activeOrders || !allLogsRes) return { grouped: {} as Record<string, OrderStats[]>, grandTotals: { ordQty: 0, todayRcv: 0, totalRcv: 0, todayDel: 0, totalDel: 0, balance: 0, ready: 0 }};

    const todayStr = new Date().toISOString().split('T')[0];
    const statsMap = new Map<string, OrderStats>();

    // Only process orders that have cpl_qty_kg > 0
    activeOrders.filter(o => o.cpl_qty_kg && o.cpl_qty_kg > 0).forEach(o => {
      statsMap.set(o.id!, {
        order: o,
        todayRcv: 0,
        totalRcv: 0,
        todayDel: 0,
        totalDel: 0,
        totalReady: 0,
        unit: 'INCTL', // default unit
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
      
      grandTotals.ordQty += stat.order.cpl_qty_kg || 0;
      grandTotals.todayRcv += stat.todayRcv;
      grandTotals.totalRcv += stat.totalRcv;
      grandTotals.todayDel += stat.todayDel;
      grandTotals.totalDel += stat.totalDel;
      grandTotals.balance += stat.balance;
      grandTotals.ready += stat.totalReady;
    });

    return { grouped, grandTotals };
  }, [activeOrders, allLogsRes]);

  const { grouped, grandTotals } = processedData;

  const filterOptions = useMemo(() => {
    const flatStats = Object.values(grouped).flat() as OrderStats[];
    return {
      unit: Array.from(new Set(Object.keys(grouped))).sort(),
      buyer: Array.from(new Set(flatStats.map(s => s.order.buyer).filter(Boolean))).sort(),
      erpShipDate: Array.from(new Set(flatStats.map(s => s.order.erp_date ? formatDate(s.order.erp_date) : '-'))).sort(),
      receivedDate: Array.from(new Set(flatStats.map(s => s.firstRcvDate ? formatDate(s.firstRcvDate) : '-'))).sort(),
      erpFile: Array.from(new Set(flatStats.map(s => s.order.file_no).filter(Boolean))).sort(),
      styleNo: Array.from(new Set(flatStats.map(s => s.order.style_no).filter(Boolean))).sort(),
      color: Array.from(new Set(flatStats.map(s => s.order.color).filter(Boolean))).sort(),
      ordQty: Array.from(new Set(flatStats.map(s => formatNumber(s.order.cpl_qty_kg)))).sort(),
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
      // Apply unit filter
      if (columnFilters.unit && unit !== columnFilters.unit) return;

      const filtered = grouped[unit].filter(stat => {
        const matchesSearch = !s || (
          stat.order.file_no.toLowerCase().includes(s) ||
          stat.order.buyer.toLowerCase().includes(s) ||
          (stat.order.style_no && stat.order.style_no.toLowerCase().includes(s))
        );

        const rcvDateStr = stat.firstRcvDate ? formatDate(stat.firstRcvDate) : '-';
        const erpDateStr = stat.order.erp_date ? formatDate(stat.order.erp_date) : '-';

        const matchesBuyer = !columnFilters.buyer || stat.order.buyer === columnFilters.buyer;
        const matchesErpShip = !columnFilters.erpShipDate || erpDateStr === columnFilters.erpShipDate;
        const matchesRcvDate = !columnFilters.receivedDate || rcvDateStr === columnFilters.receivedDate;
        const matchesErpFile = !columnFilters.erpFile || stat.order.file_no === columnFilters.erpFile;
        const matchesStyle = !columnFilters.styleNo || stat.order.style_no === columnFilters.styleNo;
        const matchesColor = !columnFilters.color || stat.order.color === columnFilters.color;
        const matchesOrdQty = !columnFilters.ordQty || formatNumber(stat.order.cpl_qty_kg) === columnFilters.ordQty;
        const matchesTodayRcv = !columnFilters.todayRcv || (stat.todayRcv > 0 ? formatNumber(stat.todayRcv) : '0') === columnFilters.todayRcv;
        const matchesTotalRcv = !columnFilters.totalRcv || (stat.totalRcv > 0 ? formatNumber(stat.totalRcv) : '0') === columnFilters.totalRcv;
        const matchesTodayDel = !columnFilters.todayDel || (stat.todayDel > 0 ? formatNumber(stat.todayDel) : '0') === columnFilters.todayDel;
        const matchesTotalDel = !columnFilters.totalDel || (stat.totalDel > 0 ? formatNumber(stat.totalDel) : '0') === columnFilters.totalDel;
        const matchesBalance = !columnFilters.balance || formatNumber(stat.balance) === columnFilters.balance;
        const matchesReady = !columnFilters.readyForDelivery || (stat.totalReady > 0 ? formatNumber(stat.totalReady) : '0') === columnFilters.readyForDelivery;
        const matchesWash = !columnFilters.washType || stat.order.wash_type === columnFilters.washType;
        const matchesFloor = !columnFilters.floor || stat.order.sew_floor === columnFilters.floor;

        return matchesSearch && matchesBuyer && matchesErpShip && matchesRcvDate && matchesErpFile && 
               matchesStyle && matchesColor && matchesOrdQty && matchesTodayRcv && matchesTotalRcv && matchesTodayDel && 
               matchesTotalDel && matchesBalance && matchesReady && matchesWash && matchesFloor;
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
      <span className="text-center whitespace-nowrap">{label}</span>
      <select
        className="w-full max-w-[80px] text-[10px] sm:text-[11px] font-bold border border-[#FFD700] rounded bg-white text-[#1E5D7B] py-0.5 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
      <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full min-h-[420px]">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Daily Wash Status Update Report (CPL)</h3>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder="Search File, Buyer..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-slate-300 rounded px-3 py-2 w-48 lg:w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Link to="/new-plan" className="bg-blue-600 font-medium text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
              + New Plan
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-[#FFF6CC] border-b border-[#FFD700]">
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider sticky left-0 z-10 bg-[#FFF6CC] border-r border-[#FFD700] align-top">
                  <FilterSelect column="unit" options={filterOptions.unit} label="UNIT" />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-center border-r border-[#FFD700] align-top">
                  <FilterSelect column="receivedDate" options={filterOptions.receivedDate} label="RECEIVED DATE" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="styleNo" options={filterOptions.styleNo} label="STYLE NO" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="buyer" options={filterOptions.buyer} label="BUYER" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="erpFile" options={filterOptions.erpFile} label="ERP/FILE" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="color" options={filterOptions.color} label="COLOR" />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-center border-r border-[#FFD700] align-top">
                  <FilterSelect column="erpShipDate" options={filterOptions.erpShipDate} label="ERP DATE" />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] align-top">
                  <FilterSelect column="ordQty" options={filterOptions.ordQty} label={<>ORDER QTY<br/>(KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] bg-[#FFF2B2] align-top">
                  <FilterSelect column="todayRcv" options={filterOptions.todayRcv} label={<>TODAY FABRICS<br/>RECEIVED (KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] bg-[#FFF2B2] align-top">
                  <FilterSelect column="totalRcv" options={filterOptions.totalRcv} label={<>TOTAL FABRICS<br/>RECEIVED (KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] bg-[#FFF2B2] align-top">
                  <FilterSelect column="todayDel" options={filterOptions.todayDel} label={<>TODAY FABRICS<br/>DELIVERY (KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] bg-[#FFF2B2] align-top">
                  <FilterSelect column="totalDel" options={filterOptions.totalDel} label={<>TOTAL FABRICS<br/>DELIVERY (KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] align-top">
                  <FilterSelect column="balance" options={filterOptions.balance} label={<>TOTAL FABRICS<br/>BALANCE (KG)</>} />
                </th>
                <th className="px-2 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider text-right border-r border-[#FFD700] bg-green-200 align-top">
                  <FilterSelect column="readyForDelivery" options={filterOptions.readyForDelivery} label={<>READY FOR<br/>DELIVERY (KG)</>} />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="floor" options={filterOptions.floor} label="FABRICS SEW FLOOR" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider border-r border-[#FFD700] align-top">
                  <FilterSelect column="washType" options={filterOptions.washType} label="WASH PLAN" />
                </th>
                <th className="px-3 py-3 text-[11px] font-bold text-[#1E5D7B] uppercase tracking-wider min-w-[150px] align-top pt-3 text-center border-[#FFD700]">FABRICS WASH<br/>CLOSING INFO / REMARKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800 bg-white">
              {Object.keys(filteredGroups).length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-6 py-8 text-center text-slate-500 italic">No active CPL orders found</td>
                </tr>
              ) : (
                Object.entries(filteredGroups).map(([unit, stats]: [string, OrderStats[]]) => {
                  const unitGrand = stats.reduce((acc, stat) => {
                    acc.ord += stat.order.cpl_qty_kg || 0;
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
                        <tr key={stat.order.id} className={`hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          {idx === 0 && (
                            <td rowSpan={stats.length + 1} className="p-2 border-r border-b border-slate-200 font-bold bg-[#43a1c6] text-white text-center transform -rotate-180 sticky left-0 z-10" style={{ writingMode: 'vertical-rl' }}>
                              <span>{unit}</span>
                            </td>
                          )}
                          <td className="px-2 py-2 text-center border-r border-slate-200 whitespace-nowrap">{stat.firstRcvDate ? formatDate(stat.firstRcvDate) : '-'}</td>
                          <td className="px-3 py-2 border-r border-slate-200">{stat.order.style_no || '-'}</td>
                          <td className="px-3 py-2 border-r border-slate-200 font-bold">{stat.order.buyer}</td>
                          <td className="px-3 py-2 border-r border-slate-200 font-bold text-[#1E5D7B]">{stat.order.file_no}</td>
                          <td className="px-3 py-2 border-r border-slate-200">{stat.order.color || '-'}</td>
                          <td className="px-2 py-2 text-center border-r border-slate-200 whitespace-nowrap text-slate-500">{stat.order.erp_date ? formatDate(stat.order.erp_date) : '-'}</td>
                          
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums font-bold">{formatNumber(stat.order.cpl_qty_kg)}</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums bg-yellow-50">{stat.todayRcv > 0 ? formatNumber(stat.todayRcv) : 0}</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums bg-yellow-50">{stat.totalRcv > 0 ? formatNumber(stat.totalRcv) : 0}</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums bg-yellow-50">{stat.todayDel > 0 ? formatNumber(stat.todayDel) : 0}</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums bg-yellow-50">{stat.totalDel > 0 ? formatNumber(stat.totalDel) : 0}</td>
                          
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums font-medium text-slate-600">{formatNumber(stat.balance)}</td>
                          <td className="px-2 py-2 text-right border-r border-slate-200 tabular-nums bg-green-50 font-medium text-green-700">{stat.totalReady > 0 ? formatNumber(stat.totalReady) : 0}</td>
                          
                          <td className="px-3 py-2 border-r border-slate-200 uppercase">{stat.order.sew_floor || '-'}</td>
                          <td className="px-3 py-2 border-r border-slate-200">{stat.order.wash_type || '-'}</td>
                          <td className="px-3 py-2 text-slate-600 italic bg-yellow-50/30">{stat.latestRemarks || stat.order.remarks || '-'}</td>
                        </tr>
                      ))}
                      {/* Unit Total Row */}
                      <tr className="bg-[#FFF2B2] font-bold border-b border-[#FFD700] text-slate-900">
                        <td colSpan={6} className="px-3 py-2 text-center border-r border-[#FFD700] uppercase tracking-widest">{unit} CPL Wash</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.ord)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.tRcv)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.totRcv)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.tDel)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.totDel)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.bal)}</td>
                        <td className="px-2 py-2 text-right border-r border-[#FFD700] tabular-nums">{formatNumber(unitGrand.ready)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {Object.keys(filteredGroups).length > 0 && (
              <tfoot>
                <tr className="bg-green-100 font-bold border-t-2 border-green-200 text-sm text-green-900">
                  <td colSpan={7} className="px-3 py-3 text-center border-r border-green-200 uppercase tracking-widest">G.Total</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.ordQty)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.todayRcv)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.totalRcv)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.todayDel)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.totalDel)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.balance)}</td>
                  <td className="px-2 py-3 text-right border-r border-green-200 tabular-nums">{formatNumber(grandTotals.ready)}</td>
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
