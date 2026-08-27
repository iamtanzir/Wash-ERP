const fs = require('fs');

const file = 'src/pages/HMTOD.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update Risk tab columns
content = content.replace(
  /<table className="w-full text-\[10px\] text-left border-collapse min-w-max">[\s\S]*?<tbody/m,
  `<table className="w-full text-[10px] text-left border-collapse min-w-max">
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
                <tbody`
);

content = content.replace(
  /<td className="px-1 py-1 border-r text-center text-rose-600"><\/td>\s*<\/tr>\s*\{group\.items/m,
  `<td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                        <td className="px-1 py-1 border-r text-center text-rose-600"></td>
                      </tr>

                      {group.items`
);

content = content.replace(
  /<td className="px-1 py-1 border-r text-center font-bold text-orange-700 bg-orange-50\/50">\{formatNumber\(needWash\)\}<\/td>\s*<\/tr>\s*\)\}\)\}/m,
  `<td className="px-1 py-1 border-r text-center font-bold text-orange-700 bg-orange-50/50">{formatNumber(needWash)}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700">{formatNumber(Math.max(0, wBln))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700 bg-yellow-100">{formatNumber(Math.ceil(needWash / 4))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-700 font-bold bg-green-50">0</td>
                          <td className="px-1 py-1 border-r text-center text-red-600 font-bold bg-red-50">{formatNumber(Math.max(0, needRfd - 500))}</td>
                          <td className="px-1 py-1 border-r text-center text-slate-500">INCTL</td>
                        </tr>
                      )})}`
);

fs.writeFileSync(file, content, 'utf8');
