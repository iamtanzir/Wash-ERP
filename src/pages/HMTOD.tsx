import React, { useState, useMemo } from 'react';
import { Ship, AlertTriangle, CheckCircle2, Search, Filter, Download, ArrowRight, Activity, Upload, Table2, Sheet, FileSpreadsheet } from 'lucide-react';
import { cn, formatNumber, formatDate } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import Papa from 'papaparse';
import { toast } from 'sonner';

// Mock data as fallback for Risk Analysis
const mockDataGroups = [
  {
    name: "1st.F",
    items: [
      { erpId: "111-7992", washType: "Garment Dye Snow Wash", erpQty: 21754, wRecv: 9484, wDeli: 7846 },
      { erpId: "111-8013", washType: "GarmentDyesnowWash", erpQty: 28451, wRecv: 16500, wDeli: 11346 },
      { erpId: "111-8043", washType: "Enzyme Wash", erpQty: 10549, wRecv: 8695, wDeli: 7295 },
      { erpId: "111-8094", washType: "Pig Dye Enzm Wash", erpQty: 19576, wRecv: 4700, wDeli: 0 },
    ]
  }
];

export default function HMTOD() {
  const [activeTab, setActiveTab] = useState<'input' | 'pivot' | 'risk'>('input');
  
  // Cutoff Input State
  const [cutoffData, setCutoffData] = useState<any[]>([]);
  const [pasteData, setPasteData] = useState('');

  const { data: erpOrders } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => api.getActiveOrders()
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['allLogs'],
    queryFn: () => api.getRecentLogs(1000)
  });

  const handlePasteData = () => {
    if (!pasteData.trim()) {
      toast.error("Please paste data first");
      return;
    }
    
    // Parse TSV (Excel paste)
    const parsed = Papa.parse(pasteData, { delimiter: '\t', header: true, skipEmptyLines: true });
    if (parsed.data && parsed.data.length > 0) {
      setCutoffData(parsed.data);
      toast.success(`Loaded ${parsed.data.length} rows`);
      setPasteData('');
    } else {
      toast.error("Failed to parse data");
    }
  };

  // Generate Pivot Data
  const pivotData = useMemo(() => {
    if (!cutoffData.length) return { dates: [], rows: [] };
    
    const datesSet = new Set<string>();
    const grouped: Record<string, Record<string, any>> = {};
    
    cutoffData.forEach(row => {
      const file = row['Job ref'] || row['ERP / File / Job'] || row['File'] || row['ERP'] || 'Unknown';
      const color = row['Colour'] || row['Color'] || 'Unknown';
      const date = row['Shipment date'] || row['Ship Date'] || 'Unknown';
      const qty = parseInt(row['Order Qty.'] || row['Order Qty'] || row['Qty'] || '0') || 0;
      
      if (date && date !== 'Unknown') datesSet.add(date);
      
      if (!grouped[file]) grouped[file] = {};
      if (!grouped[file][color]) grouped[file][color] = { total: 0 };
      
      grouped[file][color][date] = (grouped[file][color][date] || 0) + qty;
      grouped[file][color].total += qty;
    });

    // Sort dates
    const dates = Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    const rows: any[] = [];
    Object.keys(grouped).sort().forEach(file => {
      let fileTotal = 0;
      const colors = Object.keys(grouped[file]).sort();
      colors.forEach(color => {
        fileTotal += grouped[file][color].total;
      });
      rows.push({ isGroup: true, file, total: fileTotal });
      
      colors.forEach(color => {
        rows.push({ isGroup: false, file, color, data: grouped[file][color] });
      });
    });

    return { dates, rows, rawGrouped: grouped };
  }, [cutoffData]);

  // Generate Risk Analysis Data
  const riskAnalysisData = useMemo(() => {
    // We try to match ERP Orders and Daily Logs with Pivot Targets
    if (!pivotData.dates.length) return mockDataGroups;

    const floors: Record<string, any[]> = {};
    
    // Group pivot totals by File (ERP)
    const fileTargets: Record<string, Record<string, number>> = {};
    pivotData.rows.forEach(row => {
      if (!row.isGroup) {
        if (!fileTargets[row.file]) fileTargets[row.file] = {};
        pivotData.dates.forEach(d => {
           fileTargets[row.file][d] = (fileTargets[row.file][d] || 0) + (row.data[d] || 0);
        });
        fileTargets[row.file].total = (fileTargets[row.file].total || 0) + (row.data.total || 0);
      }
    });

    Object.keys(fileTargets).forEach(file => {
      const order = erpOrders?.find((o: any) => o.file_no === file || o.id === file);
      const floor = order?.floor || '1st.F';
      
      // Calculate Recv and Deli
      const logs = recentLogs?.items?.filter((l: any) => l.expand?.erp_order?.file_no === file) || [];
      const wRecv = logs.reduce((sum: number, l: any) => sum + (l.received_qty || 0), 0);
      const wDeli = logs.reduce((sum: number, l: any) => sum + (l.delivered_qty || 0), 0);
      const erpQty = order?.order_qty || fileTargets[file].total || 0;

      if (!floors[floor]) floors[floor] = [];
      floors[floor].push({
        erpId: file,
        washType: order?.wash_type || 'Unknown Wash',
        erpQty: erpQty,
        wRecv: wRecv,
        wDeli: wDeli,
        shipTargets: fileTargets[file]
      });
    });

    return Object.keys(floors).map(name => ({
      name,
      items: floors[name]
    }));
  }, [pivotData, erpOrders, recentLogs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">H&M SHIP RISK ANALYSIS</h1>
          <p className="text-slate-500 text-sm mt-1">Dynamic Cutoff & Shipment Tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
        <button 
          onClick={() => setActiveTab('input')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'input' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <Table2 size={18} />
          1. Country-wise Input
        </button>
        <button 
          onClick={() => setActiveTab('pivot')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'pivot' ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <FileSpreadsheet size={18} />
          2. Auto Pivot
        </button>
        <button 
          onClick={() => setActiveTab('risk')}
          className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors ${activeTab === 'risk' ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
        >
          <Activity size={18} />
          3. Wash Risk Analysis
        </button>
      </div>

      <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Paste Excel Data (H&M Cutoff)</h2>
              <span className="text-sm text-slate-500">Must include: ERP Ship Date, Job ref, Style No, Colour, Order Qty., Shipment date</span>
            </div>
            <textarea 
              value={pasteData}
              onChange={(e) => setPasteData(e.target.value)}
              className="w-full h-48 p-4 border-2 border-slate-200 rounded-xl font-mono text-sm focus:border-blue-500 outline-none"
              placeholder="Week\tERP Ship Date\tJob ref\tStyle No\tColour\tCountry\tOrder Qty.\tShipment date\tFLOOR..."
            />
            <button 
              onClick={handlePasteData}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center gap-2"
            >
              <Upload size={18} />
              Process Data
            </button>

            {cutoffData.length > 0 && (
              <div className="mt-8 border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b font-bold text-sm text-slate-700">
                  Preview ({cutoffData.length} rows)
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        {Object.keys(cutoffData[0]).map(k => (
                          <th key={k} className="p-2 border-b font-bold text-slate-600">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cutoffData.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="p-2">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pivot' && (
          <div>
            {!pivotData.dates.length ? (
              <div className="text-center py-20 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No data available. Please paste data in the Input tab first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-left border-collapse min-w-max">
                  <thead className="bg-[#dce6f1] text-[10px] uppercase font-bold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 border border-slate-300">Sum of Order Qty.</th>
                      <th className="px-3 py-2 border border-slate-300" colSpan={pivotData.dates.length + 1}>Ship Date</th>
                    </tr>
                    <tr>
                      <th className="px-3 py-2 border border-slate-300 bg-[#dce6f1]">ERP / File / Job</th>
                      {pivotData.dates.map(d => (
                        <th key={d} className="px-3 py-2 border border-slate-300 text-center">{d}</th>
                      ))}
                      <th className="px-3 py-2 border border-slate-300 text-center bg-blue-100">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {pivotData.rows.map((row, idx) => {
                      if (row.isGroup) {
                        return (
                          <tr key={`group-${idx}`} className="bg-slate-50 font-bold border-t-2 border-slate-300">
                            <td className="px-3 py-2 border border-slate-300">[-] {row.file}</td>
                            {pivotData.dates.map(d => {
                              let dtTotal = 0;
                              // calc group total for this date
                              Object.values(pivotData.rawGrouped[row.file]).forEach((colorData: any) => {
                                dtTotal += (colorData[d] || 0);
                              });
                              return (
                                <td key={d} className="px-3 py-2 border border-slate-300 text-center">
                                  {dtTotal > 0 ? formatNumber(dtTotal) : ''}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 border border-slate-300 text-center bg-blue-50/50">{formatNumber(row.total)}</td>
                          </tr>
                        );
                      } else {
                        return (
                          <tr key={`row-${idx}`} className="hover:bg-slate-50">
                            <td className="px-3 py-2 border border-slate-300 pl-8">{row.color}</td>
                            {pivotData.dates.map(d => (
                              <td key={d} className="px-3 py-2 border border-slate-300 text-center">
                                {row.data[d] > 0 ? formatNumber(row.data[d]) : ''}
                              </td>
                            ))}
                            <td className="px-3 py-2 border border-slate-300 text-center font-bold bg-slate-50/50">{formatNumber(row.data.total)}</td>
                          </tr>
                        );
                      }
                    })}
                  </tbody>
                  <tfoot className="bg-[#dce6f1] font-bold">
                    <tr>
                      <td className="px-3 py-2 border border-slate-300 text-right">Grand Total</td>
                      {pivotData.dates.map(d => {
                        let gdTotal = 0;
                        pivotData.rows.forEach(r => {
                          if (!r.isGroup) gdTotal += (r.data[d] || 0);
                        });
                        return (
                          <td key={d} className="px-3 py-2 border border-slate-300 text-center">{formatNumber(gdTotal)}</td>
                        );
                      })}
                      <td className="px-3 py-2 border border-slate-300 text-center bg-blue-200">
                        {formatNumber(pivotData.rows.reduce((sum, r) => r.isGroup ? sum + r.total : sum, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'risk' && (
          <div>
            {!pivotData.dates.length && (
              <div className="mb-4 p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                Showing fallback data. To see live risk analysis, please input country-wise cutoff data first.
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] text-left border-collapse min-w-max">
                <thead className="bg-[#f8fafc] uppercase font-bold text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-1.5 py-1 border-r bg-white sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-[140px]" rowSpan={2}>ERP Plan / File</th>
                    <th className="px-1.5 py-1 border-r bg-yellow-100 text-yellow-800 text-center" colSpan={pivotData.dates.length || 4}>Ship Qty Pcs of TOD</th>
                    <th className="px-1.5 py-1 border-r bg-pink-100 text-pink-800 text-center" rowSpan={2}>Total Ship Qty<br/>(EID)</th>
                    <th className="px-1.5 py-1 border-r bg-purple-100 text-purple-800 text-center" rowSpan={2}>ERP Qty</th>
                    <th className="px-1.5 py-1 border-r bg-emerald-100 text-emerald-800 text-center" colSpan={3}>Wash Progress</th>
                    <th className="px-1.5 py-1 border-r bg-orange-100 text-orange-800 text-center" colSpan={2}>Shortage / Needs</th>
                    <th className="px-1.5 py-1 border-r bg-blue-100 text-blue-800 text-center" colSpan={5}>Planning</th>
                  </tr>
                  <tr>
                    {(pivotData.dates.length ? pivotData.dates : ['20-May', '30-May', '3-Jun', '6-Jun']).map(d => (
                      <th key={d} className="px-1 py-1 border-r border-t bg-yellow-50 text-yellow-700 text-center whitespace-nowrap">{d}</th>
                    ))}
                    
                    <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">W.Recv (RFD)</th>
                    <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">W.Deli (Wash)</th>
                    <th className="px-1 py-1 border-r border-t bg-emerald-50 text-emerald-700 text-center">W.Bln (WIP)</th>

                    <th className="px-1 py-1 border-r border-t bg-orange-50 text-orange-700 text-center leading-tight">Need RFD<br />from Sew</th>
                    <th className="px-1 py-1 border-r border-t bg-orange-50 text-orange-700 text-center leading-tight">Need Wash<br />Close</th>

                    <th className="px-1 py-1 border-r border-t bg-blue-50 text-blue-700 text-center">Wash Ready</th>
                    <th className="px-1 py-1 border-r border-t bg-blue-50 text-blue-700 text-center">Wash Daily Target</th>
                    <th className="px-1 py-1 border-r border-t bg-blue-50 text-blue-700 text-center">Wash TTL</th>
                    <th className="px-1 py-1 border-r border-t bg-red-50 text-red-700 text-center">Sew Plan Miss</th>
                    <th className="px-1 py-1 border-r border-t bg-blue-50 text-blue-700 text-center">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {riskAnalysisData.map((group: any, groupIdx) => (
                    <React.Fragment key={groupIdx}>
                      <tr className="bg-slate-100 font-bold border-y-2 border-slate-200">
                        <td className="px-1.5 py-1 border-r text-rose-600 bg-slate-100 sticky left-0 z-10 w-[140px]" colSpan={1}>{group.name}</td>
                        {(pivotData.dates.length ? pivotData.dates : [1,2,3,4]).map((d, i) => (
                          <td key={i} className="px-1 py-1 border-r text-center text-rose-600">
                            {/* Target Sum */}
                          </td>
                        ))}
                        <td className="px-1 py-1 border-r text-center text-pink-600 bg-pink-50/50"></td>
                        <td className="px-1 py-1 border-r text-center text-purple-600 bg-purple-50/30"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                      </tr>

                      {group.items.map((row: any, idx: number) => {
                        const totalShip = row.shipTargets?.total || 0;
                        const wBln = Math.max(0, row.wRecv - row.wDeli);
                        const needRfd = Math.max(0, totalShip - row.wRecv);
                        const needWash = Math.max(0, totalShip - row.wDeli);
                        
                        return (
                        <tr key={`${groupIdx}-${idx}`} className="hover:bg-blue-50 transition-colors">
                          <td className="px-1.5 py-1 border-r sticky left-0 z-10 w-[140px] bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                            <div className="font-semibold text-slate-800">{row.erpId}</div>
                            <div className="text-[9px] text-slate-500 leading-tight mt-0.5">{row.washType}</div>
                          </td>
                          {(pivotData.dates.length ? pivotData.dates : [1,2,3,4]).map(d => (
                            <td key={d} className="px-1 py-1 border-r text-center font-bold text-slate-600">
                              {row.shipTargets && row.shipTargets[d] ? formatNumber(row.shipTargets[d]) : ''}
                            </td>
                          ))}
                          
                          <td className="px-1 py-1 border-r text-center font-bold text-pink-700 bg-pink-50/50">{formatNumber(totalShip)}</td>
                          <td className="px-1 py-1 border-r text-center font-bold text-purple-700">{formatNumber(row.erpQty)}</td>
                          
                          <td className="px-1 py-1 border-r text-center text-emerald-700">{formatNumber(row.wRecv)}</td>
                          <td className="px-1 py-1 border-r text-center text-emerald-700">{formatNumber(row.wDeli)}</td>
                          <td className="px-1 py-1 border-r text-center font-bold text-red-600 bg-red-50/30">{formatNumber(wBln)}</td>
                          
                          <td className="px-1 py-1 border-r text-center font-bold text-orange-700 bg-orange-50/50">{formatNumber(needRfd)}</td>
                          <td className="px-1 py-1 border-r text-center font-bold text-orange-700 bg-orange-50/50">{formatNumber(needWash)}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700">{formatNumber(Math.max(0, wBln))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700 bg-yellow-100">{formatNumber(Math.ceil(needWash / 4))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700 font-bold bg-green-50">0</td>
                          <td className="px-1 py-1 border-r text-center text-red-600 font-bold bg-red-50">{formatNumber(Math.max(0, needRfd - 500))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-500">INCTL</td>
                        </tr>
                      )})}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
