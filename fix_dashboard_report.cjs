const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Replace table headers
content = content.replace(
  /<table className="w-full text-left border-collapse min-w-max">[\s\S]*?<\/thead>/m,
  `<table className="w-full text-center border-collapse min-w-max text-[11px] font-medium font-sans">
                <thead>
                  <tr>
                    <th colSpan={14} className="border border-black bg-white px-2 py-1 text-center">
                      <div className="flex justify-between items-center w-full">
                        <div className="w-[150px]"></div>
                        <h2 className="text-xl font-bold font-serif underline decoration-2 underline-offset-4 tracking-wide">Wash Garments Received & Delivery Report</h2>
                        <div className="w-[150px] flex justify-end">
                          <span className="font-bold border border-black bg-white px-2 py-1 flex items-center">
                            Date: <span className="ml-2 bg-yellow-200 px-3 py-0.5 border border-black inline-block min-w-[100px] text-center">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-')}</span>
                          </span>
                        </div>
                      </div>
                    </th>
                  </tr>
                  <tr className="bg-white text-black font-bold">
                    <th className="px-1 py-2 border border-black align-middle w-[60px]">
                      <FilterSelect column="unit" options={filterOptions.unit} label="Unit" />
                    </th>
                    <th className="px-1 py-2 border border-black align-middle w-[80px]">
                      <FilterSelect column="buyer" options={filterOptions.buyer} label="Buyer" />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle w-[100px]">
                      <FilterSelect column="erpFile" options={filterOptions.erpFile} label="ERP/File" />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle min-w-[120px]">
                      <FilterSelect column="color" options={filterOptions.color} label="Color" />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle">
                      <FilterSelect column="ordQty" options={filterOptions.ordQty} label="Ord Qty" />
                    </th>
                    <th className="px-1 py-2 border border-black align-middle">
                      <FilterSelect column="todayRcv" options={filterOptions.todayRcv} label={<>Today<br/>Received</>} />
                    </th>
                    <th className="px-1 py-2 border border-black align-middle">
                      <FilterSelect column="totalRcv" options={filterOptions.totalRcv} label={<>Total<br/>Received</>} />
                    </th>
                    <th className="px-1 py-2 border border-black align-middle">
                      <FilterSelect column="todayDel" options={filterOptions.todayDel} label={<>Today<br/>Delivery</>} />
                    </th>
                    <th className="px-1 py-2 border border-black align-middle">
                      <FilterSelect column="totalDel" options={filterOptions.totalDel} label={<>Total<br/>Delivery</>} />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle">
                      <FilterSelect column="balance" options={filterOptions.balance} label="Balance" />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle bg-yellow-200">
                      <FilterSelect column="readyForDelivery" options={filterOptions.readyForDelivery} label={<>Ready For<br/>Deliver</>} />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle w-[100px]">
                      <FilterSelect column="washType" options={filterOptions.washType} label="Type of Wash" />
                    </th>
                    <th className="px-2 py-2 border border-black align-middle w-[60px]">
                      <FilterSelect column="floor" options={filterOptions.floor} label="Floor" />
                    </th>
                    <th className="px-3 py-2 border border-black align-middle min-w-[150px] bg-yellow-200">Remarks</th>
                  </tr>
                </thead>`
);

// Replace tbody text-xs
content = content.replace(
  /<tbody className="divide-y divide-slate-200 text-xs text-slate-700 bg-white">/m,
  '<tbody className="text-[11px] text-black bg-white">'
);

// Replace no active orders row
content = content.replace(
  /<td colSpan={17 \+ customFields\.length}.*?>No active orders found<\/td>/m,
  '<td colSpan={14} className="px-6 py-8 text-center text-slate-400 italic border border-black">No active orders found</td>'
);

// Replace table body rendering
content = content.replace(
  /Object\.entries\(filteredGroups\)\.map\(\(\[unit, stats\]: \[string, OrderStats\[\]\]\) => \{[\s\S]*?<\/React\.Fragment>/g,
  `Object.entries(filteredGroups).map(([unit, stats]: [string, OrderStats[]]) => {
                      return (
                        <React.Fragment key={unit}>
                          {stats.map((stat, idx) => (
                            <tr key={stat.order.id} className="hover:bg-blue-50/50">
                              <td className="px-2 py-1.5 text-center border border-black whitespace-nowrap font-bold bg-yellow-200">{unit}</td>
                              <td className="px-2 py-1.5 border border-black text-center">{stat.order.buyer}</td>
                              <td className="px-2 py-1.5 border border-black text-center">{stat.order.file_no}</td>
                              <td className={\`px-2 py-1.5 border border-black text-center \${stat.order.color?.includes('46-215') ? 'bg-yellow-200 font-bold' : ''}\`}>{stat.order.color || '-'}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{formatNumber(stat.order.order_qty)}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.todayRcv > 0 ? formatNumber(stat.todayRcv) : 0}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.totalRcv > 0 ? formatNumber(stat.totalRcv) : 0}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.todayDel > 0 ? formatNumber(stat.todayDel) : 0}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.totalDel > 0 ? formatNumber(stat.totalDel) : 0}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{formatNumber(stat.balance)}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.totalReady > 0 ? formatNumber(stat.totalReady) : 0}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.order.wash_type || '-'}</td>
                              <td className="px-2 py-1.5 text-center border border-black">{stat.order.sew_floor || '-'}</td>
                              <td className="px-2 py-1.5 border border-black bg-yellow-200">{stat.latestRemarks || '-'}</td>
                            </tr>
                          ))}
                        </React.Fragment>
`
);

// We need to also close the map block
content = content.replace(
  /<\/React\.Fragment>\s*\)\s*\}\)\s*\}\s*<\/tbody>\s*<\/table>/m,
  `                       </React.Fragment>
                      );
                    })}
                  
                  {Object.keys(filteredGroups).length > 0 && (
                    <tr className="font-bold text-[12px]">
                      <td colSpan={4} className="px-2 py-2 text-center border border-black bg-white text-red-600 font-bold">Auto Subtotal</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.ordQty)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.todayRcv)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.totalRcv)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.todayDel)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.totalDel)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.balance)}</td>
                      <td className="px-2 py-2 text-center border border-black bg-white">{formatNumber(grandTotals.ready)}</td>
                      <td colSpan={3} className="px-2 py-2 border border-black bg-white"></td>
                    </tr>
                  )}
                </tbody>
              </table>`
);

// We need to make sure we replaced the React.Fragment and map logic correctly.
// Let's do it carefully with sed/awk or a safer replace logic since my previous regex might miss closing parentheses.
fs.writeFileSync('src/pages/Dashboard.tsx', content);
