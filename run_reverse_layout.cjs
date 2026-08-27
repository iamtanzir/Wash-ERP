const fs = require('fs');
const file = 'src/components/Layout.tsx';

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

content = content.replace(/bg-amber-500\/10/g, 'bg-amber-50');
content = content.replace(/bg-amber-500\/20/g, 'bg-amber-100');
content = content.replace(/text-amber-300/g, 'text-amber-700');

// Specific header/sidebar remaining
content = content.replace(/drop-shadow-md/g, '');
content = content.replace(/bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-\[0_0_20px_rgba\(245,158,11,0\.3\)\] shrink-0 overflow-hidden border border-amber-500\/30/g, 'bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0 overflow-hidden');
content = content.replace(/text-amber-400/g, 'text-blue-400');
content = content.replace(/drop-shadow-\[0_0_8px_rgba\(16,185,129,0\.4\)\]/g, '');

content = content.replace(/border-transparent text-slate-400 hover:bg-slate-100 hover:border-slate-100 hover:text-slate-700/g, 'text-slate-400 hover:bg-slate-800 hover:text-slate-100');
content = content.replace(/bg-blue-50\/15 border-blue-50\/30 text-blue-600 shadow-\[0_0_20px_rgba\(16,185,129,0\.15\)\]/g, 'bg-blue-600 text-slate-800 shadow-lg shadow-blue-900/50');
content = content.replace(/bg-blue-50\/15 border border-blue-50\/30 text-blue-600 whitespace-nowrap shadow-\[0_0_10px_rgba\(16,185,129,0\.1\)\]/g, 'bg-green-100 text-green-700 whitespace-nowrap');
content = content.replace(/text-amber-500\/80/g, 'text-slate-600');
content = content.replace(/text-blue-500\/80/g, 'text-slate-600');
content = content.replace(/text-slate-800\/20/g, 'text-slate-200');

fs.writeFileSync(file, content, 'utf8');
console.log(`Updated ${file}`);
