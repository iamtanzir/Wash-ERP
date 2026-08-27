const fs = require('fs');
const files = ['src/pages/Dashboard.tsx', 'src/pages/IoTTracking.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(/bg-black\/20 backdrop-blur-md border border-white\/10/g, 'bg-[#fafafa]');
  content = content.replace(/bg-white\/5 backdrop-blur-xl/g, 'bg-white');
  content = content.replace(/border-white\/10/g, 'border-slate-200');
  content = content.replace(/bg-black\/20/g, 'bg-slate-50');
  content = content.replace(/bg-white\/5/g, 'bg-slate-100');
  content = content.replace(/bg-white\/10/g, 'bg-slate-200');
  content = content.replace(/border-white\/20/g, 'border-slate-300');
  content = content.replace(/border-white\/5/g, 'border-slate-100');
  content = content.replace(/divide-white\/5/g, 'divide-slate-100');
  content = content.replace(/divide-white\/10/g, 'divide-slate-200');

  content = content.replace(/text-white drop-shadow-sm/g, 'text-slate-900');
  content = content.replace(/text-white/g, 'text-slate-800');
  content = content.replace(/text-slate-200/g, 'text-slate-700');
  content = content.replace(/text-slate-300/g, 'text-slate-600');
  content = content.replace(/text-slate-400/g, 'text-slate-500');
  content = content.replace(/text-slate-500/g, 'text-slate-400');
  
  content = content.replace(/text-emerald-400/g, 'text-blue-600');
  content = content.replace(/text-emerald-300/g, 'text-blue-700');
  content = content.replace(/bg-emerald-500\/10/g, 'bg-blue-50');
  content = content.replace(/bg-emerald-500\/20/g, 'bg-blue-100');
  content = content.replace(/border-emerald-500\/20/g, 'border-blue-200');
  content = content.replace(/border-emerald-500\/30/g, 'border-blue-200'); 
  content = content.replace(/bg-emerald-600/g, 'bg-blue-600');
  content = content.replace(/hover:bg-emerald-500/g, 'hover:bg-blue-600');
  content = content.replace(/hover:bg-emerald-400/g, 'hover:bg-blue-700');

  content = content.replace(/shadow-\[0_4px_20px_rgba\(0,0,0,0\.3\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_8px_30px_rgba\(0,0,0,0\.4\)\]/g, 'shadow-md');
  content = content.replace(/shadow-\[0_10px_40px_rgba\(0,0,0,0\.5\)\]/g, 'shadow-lg');

  content = content.replace(/stroke="rgba\(255,255,255,0\.1\)"/g, 'stroke="#e2e8f0"');

  content = content.replace(/fill="#f8fafc"/g, 'FILL_0F172A');
  content = content.replace(/fill="rgba\(0,0,0,0\.2\)"/g, 'FILL_F8FAFC');
  
  content = content.replace(/FILL_0F172A/g, 'fill="#0f172a"');
  content = content.replace(/FILL_F8FAFC/g, 'fill="#f8fafc"');

  content = content.replace(/fill="#f1f5f9"/g, 'fill="#1e293b"');
  content = content.replace(/fill="#94a3b8"/g, 'fill="#64748b"');
  content = content.replace(/fill="#cbd5e1"/g, 'fill="#475569"');

  content = content.replace(/bg-amber-500\/10/g, 'bg-amber-50');
  content = content.replace(/bg-amber-500\/20/g, 'bg-amber-100');
  content = content.replace(/text-amber-300/g, 'text-amber-700');

  content = content.replace(/bg-rose-500\/10/g, 'bg-rose-50');
  content = content.replace(/bg-rose-500\/20/g, 'bg-rose-100');
  content = content.replace(/text-rose-300/g, 'text-rose-700');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
