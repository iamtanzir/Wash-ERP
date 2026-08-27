const fs = require('fs');

const files = [
  'src/pages/Dashboard.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Backgrounds and Borders
  content = content.replace(/\bbg-white\b/g, 'bg-white/5 backdrop-blur-xl');
  content = content.replace(/\bborder-slate-200\b/g, 'border-white/10');
  content = content.replace(/\bbg-slate-50\b/g, 'bg-black/20');
  content = content.replace(/\bbg-slate-100\b/g, 'bg-white/5');
  content = content.replace(/\bbg-slate-200\b/g, 'bg-white/10');
  content = content.replace(/\bborder-slate-300\b/g, 'border-white/20');
  content = content.replace(/\bborder-slate-100\b/g, 'border-white/5');
  content = content.replace(/\bdivide-slate-100\b/g, 'divide-white/5');
  content = content.replace(/\bdivide-slate-200\b/g, 'divide-white/10');

  // Text Colors
  content = content.replace(/\btext-slate-900\b/g, 'text-white drop-shadow-sm');
  content = content.replace(/\btext-slate-800\b/g, 'text-white');
  content = content.replace(/\btext-slate-700\b/g, 'text-slate-200');
  content = content.replace(/\btext-slate-600\b/g, 'text-slate-300');
  content = content.replace(/\btext-slate-500\b/g, 'text-slate-400');
  content = content.replace(/\btext-slate-400\b/g, 'text-slate-500');
  content = content.replace(/\btext-gray-500\b/g, 'text-slate-400');

  // Accents (Blue to Emerald/Amber)
  content = content.replace(/\btext-blue-600\b/g, 'text-emerald-400');
  content = content.replace(/\btext-blue-700\b/g, 'text-emerald-300');
  content = content.replace(/\bbg-blue-50\b/g, 'bg-emerald-500/10');
  content = content.replace(/\bbg-blue-100\b/g, 'bg-emerald-500/20');
  content = content.replace(/\bbg-blue-500\/10\b/g, 'bg-emerald-500/10');
  content = content.replace(/\bborder-blue-200\b/g, 'border-emerald-500/20');
  content = content.replace(/\bborder-blue-500\/20\b/g, 'border-emerald-500/20');
  content = content.replace(/\bbg-blue-600\b/g, 'bg-emerald-600');
  content = content.replace(/\bhover:bg-blue-600\b/g, 'hover:bg-emerald-500');
  content = content.replace(/\bhover:bg-blue-700\b/g, 'hover:bg-emerald-400');
  content = content.replace(/\bhover:bg-slate-100\b/g, 'hover:bg-white/10');
  content = content.replace(/\bhover:bg-slate-50\b/g, 'hover:bg-white/5');
  content = content.replace(/\bhover:bg-slate-50\/50\b/g, 'hover:bg-white/5');

  // Shadows
  content = content.replace(/\bshadow-sm\b/g, 'shadow-[0_4px_20px_rgba(0,0,0,0.3)]');
  content = content.replace(/\bshadow-md\b/g, 'shadow-[0_8px_30px_rgba(0,0,0,0.4)]');
  content = content.replace(/\bshadow-lg\b/g, 'shadow-[0_10px_40px_rgba(0,0,0,0.5)]');

  // Charts grid
  content = content.replace(/stroke="#e2e8f0"/g, 'stroke="rgba(255,255,255,0.1)"');
  content = content.replace(/fill="#f8fafc"/g, 'fill="rgba(0,0,0,0.2)"');
  content = content.replace(/fill="#0f172a"/g, 'fill="#f8fafc"');
  content = content.replace(/fill="#1e293b"/g, 'fill="#f1f5f9"');
  content = content.replace(/fill="#64748b"/g, 'fill="#94a3b8"');
  content = content.replace(/fill="#475569"/g, 'fill="#cbd5e1"');

  // Specific amber highlights
  content = content.replace(/\bbg-amber-50\b/g, 'bg-amber-500/10');
  content = content.replace(/\bbg-amber-100\b/g, 'bg-amber-500/20');
  content = content.replace(/\btext-amber-700\b/g, 'text-amber-300');
  content = content.replace(/\bborder-amber-200\b/g, 'border-amber-500/30');

  // Specific green/emerald highlights
  content = content.replace(/\bbg-green-50\b/g, 'bg-emerald-500/10');
  content = content.replace(/\bbg-green-100\b/g, 'bg-emerald-500/20');
  content = content.replace(/\btext-green-700\b/g, 'text-emerald-300');
  content = content.replace(/\btext-green-600\b/g, 'text-emerald-400');
  content = content.replace(/\bborder-green-200\b/g, 'border-emerald-500/30');

  // Red/Rose highlights
  content = content.replace(/\bbg-rose-50\b/g, 'bg-rose-500/10');
  content = content.replace(/\bbg-rose-100\b/g, 'bg-rose-500/20');
  content = content.replace(/\btext-rose-700\b/g, 'text-rose-300');

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Updated ${file}`);
});
