const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Remove the injected auto subtotal from tbody if exists
content = content.replace(
  /\{Object\.keys\(filteredGroups\)\.length > 0 && \([\s\S]*?<tr className="font-bold text-\[12px\]">[\s\S]*?Auto Subtotal[\s\S]*?<\/tr>\s*\)\}\s*<\/tbody>/m,
  '</tbody>'
);

// Replace tfoot
content = content.replace(
  /\{Object\.keys\(filteredGroups\)\.length > 0 && \(\s*<tfoot>[\s\S]*?<\/tfoot>\s*\)\}/m,
  `{Object.keys(filteredGroups).length > 0 && (
                  <tfoot>
                    <tr className="font-bold text-[12px] bg-white text-black">
                      <td className="px-2 py-2 text-center border border-black uppercase">G.Total</td>
                      <td colSpan={3} className="px-2 py-2 text-center border border-black text-red-600">Auto Subtotal</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.ordQty)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.todayRcv)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.totalRcv)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.todayDel)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.totalDel)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.balance)}</td>
                      <td className="px-2 py-2 text-center border border-black">{formatNumber(grandTotals.ready)}</td>
                      <td colSpan={3} className="px-2 py-2 border border-black"></td>
                    </tr>
                  </tfoot>
                )}`
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
