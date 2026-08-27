const fs = require('fs');

const file = 'src/pages/DailyUpdate.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('activeTab')) {
  content = content.replace(
    "const [searchQuery, setSearchQuery] = useState('');",
    "const [searchQuery, setSearchQuery] = useState('');\n  const [activeTab, setActiveTab] = useState<'history' | 'database' | 'pivot'>('database');"
  );
  
  content = content.replace(
    /import { PlusCircle, History } from 'lucide-react';/,
    "import { PlusCircle, History, Table2, PivotTable, Download } from 'lucide-react';"
  );
  
  const rightSideStart = `<div className="lg:col-span-8 bg-white rounded-2xl border-2 border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col h-full min-h-[600px]">`;
  const rightSideReplacement = rightSideStart + `
          {/* Tabs Header */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button 
              onClick={() => setActiveTab('history')}
              className={\`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors \${activeTab === 'history' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <History className="w-4 h-4" />
              Recent Logs
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={\`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors \${activeTab === 'database' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <Table2 className="w-4 h-4" />
              Database Report
            </button>
            <button 
              onClick={() => setActiveTab('pivot')}
              className={\`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors \${activeTab === 'pivot' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <PivotTable className="w-4 h-4" />
              Pivot Report
            </button>
          </div>
`;
  
  // Replace the original top bar of the right side with the tabs
  content = content.replace(
    /<div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between">[\s\S]*?<div className="flex-1 overflow-x-auto">/m,
    `
          {/* Tabs Header */}
          <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('history')}
              className={\`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-colors whitespace-nowrap \${activeTab === 'history' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <History className="w-4 h-4" />
              Recent Logs
            </button>
            <button 
              onClick={() => setActiveTab('database')}
              className={\`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-colors whitespace-nowrap \${activeTab === 'database' ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <Table2 className="w-4 h-4" />
              Database Report
            </button>
            <button 
              onClick={() => setActiveTab('pivot')}
              className={\`flex items-center gap-2 px-4 py-4 text-sm font-bold transition-colors whitespace-nowrap \${activeTab === 'pivot' ? 'bg-white text-orange-600 border-b-2 border-orange-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}\`}
            >
              <Table2 className="w-4 h-4" />
              Pivot Report
            </button>
          </div>
          
          <div className="flex-1 overflow-auto bg-slate-100/50">
            {activeTab === 'history' && (
              <div className="min-w-full">
`
  );

  content = content.replace(
    /<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/m,
    `              </tbody>
            </table>
            </div>
            )}
            
            {activeTab === 'database' && (
              <DatabaseReport logs={recentLogs?.items || []} isLoading={isLoading} />
            )}
            
            {activeTab === 'pivot' && (
              <PivotReport logs={recentLogs?.items || []} isLoading={isLoading} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabaseReport({ logs, isLoading }: { logs: any[], isLoading: boolean }) {
  if (isLoading) return <div className="p-10 text-center text-slate-500 font-medium">Loading report...</div>;
  if (!logs.length) return <div className="p-10 text-center text-slate-400 font-medium">No transactions found</div>;
  
  return (
    <div className="w-full overflow-x-auto bg-white">
      <div className="p-3 bg-yellow-300 font-bold text-sm border-b border-slate-300 flex justify-between items-center">
        <span>Report date</span>
        <span>{formatDate(new Date().toISOString())}</span>
      </div>
      <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-[11px]">
        <thead>
          <tr className="bg-yellow-300 border-b-2 border-slate-400">
            <th className="p-2 border border-slate-300 font-bold">Transaction/Challan Date</th>
            <th className="p-2 border border-slate-300 font-bold">Challan Time</th>
            <th className="p-2 border border-slate-300 font-bold bg-green-400">Type of Delivery (R&D)</th>
            <th className="p-2 border border-slate-300 font-bold bg-[#f3d9d5]">Floor</th>
            <th className="p-2 border border-slate-300 font-bold">Challan No.</th>
            <th className="p-2 border border-slate-300 font-bold">Buyer</th>
            <th className="p-2 border border-slate-300 font-bold">ERP Ref. / File Name</th>
            <th className="p-2 border border-slate-300 font-bold">Color Code / Combo Name</th>
            <th className="p-2 border border-slate-300 font-bold text-red-600 bg-yellow-200">Transaction / Challan Qty (pcs)</th>
            <th className="p-2 border border-slate-300 font-bold text-red-600 bg-yellow-200">No. of Bag</th>
            <th className="p-2 border border-slate-300 font-bold bg-green-400">Type of Wash</th>
            <th className="p-2 border border-slate-300 font-bold bg-green-400">Style / Develop Name</th>
            <th className="p-2 border border-slate-300 font-bold bg-green-400">ERP ship date</th>
            <th className="p-2 border border-slate-300 font-bold">Ord Qty (pcs)</th>
            <th className="p-2 border border-slate-300 font-bold">Reject Pcs</th>
            <th className="p-2 border border-slate-300 font-bold">Body hole</th>
            <th className="p-2 border border-slate-300 font-bold">Spot</th>
            <th className="p-2 border border-slate-300 font-bold">Fabric Fault</th>
            <th className="p-2 border border-slate-300 font-bold">Part Shade</th>
            <th className="p-2 border border-slate-300 font-bold">Line Mark</th>
            <th className="p-2 border border-slate-300 font-bold">X</th>
            <th className="p-2 border border-slate-300 font-bold">Y</th>
            <th className="p-2 border border-slate-300 font-bold">Z</th>
            <th className="p-2 border border-slate-300 font-bold">Lab Test</th>
            <th className="p-2 border border-slate-300 font-bold">Approval</th>
            <th className="p-2 border border-slate-300 font-bold">PP Sample</th>
            <th className="p-2 border border-slate-300 font-bold text-red-500 bg-yellow-200">Status</th>
            <th className="p-2 border border-slate-300 font-bold bg-[#fae6db]">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const isToGarments = (log.delivered_qty > 0);
            const deliveryType = isToGarments ? "From Washing to Garments" : "From Garments to Washing";
            const deliveryColor = isToGarments ? "text-red-600" : "text-emerald-600";
            
            return (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-2 border border-slate-200 text-slate-700">{formatDate(log.log_date)}</td>
                <td className="p-2 border border-slate-200 text-slate-700">9:30 am</td>
                <td className={\`p-2 border border-slate-200 font-medium \${deliveryColor}\`}>{deliveryType}</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.unit}</td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right">---</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.buyer}</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.file_no}</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.color || '-'}</td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right font-medium">{isToGarments ? log.delivered_qty : log.received_qty}</td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right">0</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.wash_type || '-'}</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.style_no || '-'}</td>
                <td className="p-2 border border-slate-200 text-slate-700">{log.expand?.erp_order?.erp_ship_date ? formatDate(log.expand.erp_order.erp_ship_date) : '-'}</td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right">{log.expand?.erp_order?.order_qty || 0}</td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700 text-right"></td>
                <td className="p-2 border border-slate-200 text-slate-700"></td>
                <td className="p-2 border border-slate-200 text-slate-700 bg-slate-50">{log.remarks || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PivotReport({ logs, isLoading }: { logs: any[], isLoading: boolean }) {
  if (isLoading) return <div className="p-10 text-center text-slate-500 font-medium">Loading report...</div>;
  if (!logs.length) return <div className="p-10 text-center text-slate-400 font-medium">No transactions found</div>;
  
  // Extract unique dates and sort them
  const datesSet = new Set<string>();
  logs.forEach(l => datesSet.add(l.log_date.split('T')[0]));
  const sortedDates = Array.from(datesSet).sort();

  // Process data for Pivot
  const pivotData: Record<string, any> = {};
  logs.forEach(log => {
    const fileNo = log.expand?.erp_order?.file_no || 'Unknown';
    const color = log.expand?.erp_order?.color || 'No Color';
    const isToGarments = (log.delivered_qty > 0);
    const deliveryType = isToGarments ? "From Washing to Garments" : "From Garments to Washing";
    const qty = isToGarments ? log.delivered_qty : log.received_qty;
    const dateStr = log.log_date.split('T')[0];
    
    if (!pivotData[fileNo]) pivotData[fileNo] = {};
    if (!pivotData[fileNo][color]) pivotData[fileNo][color] = {};
    if (!pivotData[fileNo][color][deliveryType]) {
      pivotData[fileNo][color][deliveryType] = { total: 0 };
    }
    
    pivotData[fileNo][color][deliveryType][dateStr] = (pivotData[fileNo][color][deliveryType][dateStr] || 0) + qty;
    pivotData[fileNo][color][deliveryType].total += qty;
  });

  return (
    <div className="w-full overflow-x-auto bg-white">
      <div className="flex bg-[#dce6f1] border-b border-slate-300">
        <div className="p-2 border-r border-slate-300 font-bold text-xs">Wash Status</div>
        <div className="p-2 font-bold text-xs bg-yellow-300 px-6">{formatDate(new Date().toISOString())}</div>
      </div>
      <table className="w-full text-left border-collapse whitespace-nowrap min-w-max text-[11px]">
        <thead>
          <tr className="bg-[#dce6f1] border-b-2 border-slate-400">
            <th className="p-2 border border-slate-300 font-bold text-center bg-orange-200">Wash R&D Transaction</th>
            <th className="p-2 border border-slate-300 font-bold text-center">Color Name</th>
            <th className="p-2 border border-slate-300 font-bold text-center">Delivery Type</th>
            {sortedDates.map(d => (
              <th key={d} className="p-2 border border-slate-300 font-bold text-center">{formatDate(d).split(',')[0]}</th>
            ))}
            <th className="p-2 border border-slate-300 font-bold text-center">Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(pivotData).map((fileNo, fileIdx) => {
            const colors = Object.keys(pivotData[fileNo]);
            return (
              <React.Fragment key={fileNo}>
                {colors.map((color, colorIdx) => {
                  const types = Object.keys(pivotData[fileNo][color]);
                  return (
                    <React.Fragment key={color}>
                      {types.map((type, typeIdx) => {
                        return (
                          <tr key={type} className="hover:bg-slate-50">
                            {colorIdx === 0 && typeIdx === 0 ? (
                              <td className="p-2 border border-slate-200 font-bold bg-white" rowSpan={colors.reduce((sum, c) => sum + Object.keys(pivotData[fileNo][c]).length, 0)}>
                                [-] {fileNo}
                              </td>
                            ) : null}
                            {typeIdx === 0 ? (
                              <td className="p-2 border border-slate-200 font-bold bg-white" rowSpan={types.length}>
                                [-] {color}
                              </td>
                            ) : null}
                            <td className="p-2 border border-slate-200">{type}</td>
                            
                            {sortedDates.map(d => (
                              <td key={d} className="p-2 border border-slate-200 text-right">
                                {pivotData[fileNo][color][type][d] ? formatNumber(pivotData[fileNo][color][type][d]) : ''}
                              </td>
                            ))}
                            <td className="p-2 border border-slate-200 text-right font-bold bg-slate-50">
                              {formatNumber(pivotData[fileNo][color][type].total)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot className="bg-[#dce6f1] font-bold">
          <tr>
            <td colSpan={3} className="p-2 border border-slate-300 text-right">Grand Total</td>
            {sortedDates.map(d => {
              let dailyTotal = 0;
              Object.keys(pivotData).forEach(fileNo => {
                Object.keys(pivotData[fileNo]).forEach(color => {
                  Object.keys(pivotData[fileNo][color]).forEach(type => {
                    dailyTotal += pivotData[fileNo][color][type][d] || 0;
                  });
                });
              });
              return <td key={d} className="p-2 border border-slate-300 text-right">{formatNumber(dailyTotal)}</td>;
            })}
            <td className="p-2 border border-slate-300 text-right">
              {formatNumber(logs.reduce((sum, log) => sum + Math.max(log.received_qty, log.delivered_qty), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
`
  );
  
  fs.writeFileSync(file, content, 'utf8');
}
