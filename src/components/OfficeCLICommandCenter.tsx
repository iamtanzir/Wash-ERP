import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, Sparkles, Play, Download, Copy, RefreshCw, FileSpreadsheet, 
  FileText, CheckCheck, ShieldAlert, Calculator, Code2, Check, 
  HelpCircle, Zap, Cpu, CornerDownLeft, Layers, ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
  PRESET_OFFICE_SKILLS, 
  executeOfficeCliCommand, 
  OfficeCliResult, 
  PresetSkill 
} from '../lib/officeCli';

export default function OfficeCLICommandCenter() {
  const [commandInput, setCommandInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [historyResults, setHistoryResults] = useState<OfficeCliResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OfficeCliResult | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyResults]);

  const handleRunCommand = async (cmdToRun?: string) => {
    const raw = cmdToRun || commandInput;
    if (!raw || !raw.trim()) {
      toast.error("Please enter a command or prompt");
      return;
    }

    setIsExecuting(true);
    try {
      const res = await executeOfficeCliCommand(raw);
      setHistoryResults(prev => [...prev, res]);
      setSelectedResult(res);
      setCommandInput('');
      toast.success("Command executed successfully!");
    } catch (err: any) {
      toast.error(`Execution error: ${err?.message || err}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const categories = ['All', 'Spreadsheet', 'Document', 'Batch Order', 'AI Briefing', 'Chemical Audit'];

  const filteredSkills = PRESET_OFFICE_SKILLS.filter(s => 
    activeCategoryFilter === 'All' ? true : s.category === activeCategoryFilter
  );

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileSpreadsheet': return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
      case 'FileCheck': return <FileText className="w-4 h-4 text-blue-400" />;
      case 'CheckCheck': return <CheckCheck className="w-4 h-4 text-purple-400" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'Calculator': return <Calculator className="w-4 h-4 text-cyan-400" />;
      default: return <Code2 className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/50">
              <Terminal size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">iOfficeAI / OfficeCLI Automation Center</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                  CLI & Agent Skills
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                AI-driven office automation engine: generate spreadsheets, documents, batch order updates, and daily briefings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunCommand('office --help')}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700"
            >
              <HelpCircle size={14} />
              CLI Syntax Guide
            </button>
            <button
              onClick={() => setHistoryResults([])}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-slate-700"
            >
              <RefreshCw size={14} />
              Clear Terminal
            </button>
          </div>
        </div>

        {/* Command Line Input Box */}
        <div className="mt-5 relative">
          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-2xl focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all p-2">
            <div className="pl-3 pr-2 text-blue-400 font-mono font-bold text-sm flex items-center gap-1.5 shrink-0">
              <span className="text-emerald-400">tanzirerp@wash-erp</span>
              <span className="text-slate-500">:</span>
              <span className="text-blue-400">~/office-cli$</span>
            </div>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRunCommand();
              }}
              placeholder="Enter command or natural prompt e.g., 'office generate:excel --type=wash-pnl'..."
              className="w-full bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-slate-500 px-2 py-1"
            />
            <button
              onClick={() => handleRunCommand()}
              disabled={isExecuting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-2 transition-all shrink-0 active:scale-95 disabled:opacity-50"
            >
              {isExecuting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Play size={14} className="fill-current" />
              )}
              <span>Run</span>
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 px-2">
            <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono">Enter</kbd> to execute</span>
            <span>Supports standard CLI flags e.g., <code className="text-blue-300">--month=current</code>, <code className="text-blue-300">--format=xlsx</code></span>
          </div>
        </div>
      </div>

      {/* Preset Skills Grid & Filter */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              Pre-Configured OfficeCLI Skills
            </h3>
            <p className="text-xs text-slate-500">
              Select any skill below to auto-populate and run automated tasks on ERP data.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 rounded-xl font-bold transition-all",
                  activeCategoryFilter === cat
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map(skill => (
            <div
              key={skill.id}
              onClick={() => {
                setCommandInput(skill.cliCommand);
                handleRunCommand(skill.cliCommand);
              }}
              className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group flex flex-col justify-between bg-white shadow-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {renderIcon(skill.iconName)}
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                      {skill.category}
                    </span>
                  </div>
                  <ArrowUpRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs group-hover:text-blue-600 transition-colors">
                  {skill.name}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                  {skill.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 font-mono text-[10px] text-slate-400 group-hover:text-slate-600 truncate">
                $ {skill.cliCommand}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terminal History & Output Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Execution History List */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white space-y-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Terminal size={15} className="text-emerald-400" />
              CLI Execution Log ({historyResults.length})
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Live Session</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
            {historyResults.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 p-6 text-center">
                <Code2 size={32} className="text-slate-700" />
                <p className="text-xs">No CLI commands executed yet.</p>
                <p className="text-[11px] text-slate-600">Type a command or click a preset skill above.</p>
              </div>
            ) : (
              historyResults.map((res) => {
                const isSelected = selectedResult?.id === res.id;
                return (
                  <div
                    key={res.id}
                    onClick={() => setSelectedResult(res)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer space-y-1.5",
                      isSelected
                        ? "bg-slate-800 border-blue-500/80 shadow-md"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-bold">{res.timestamp}</span>
                      <span className="text-slate-400">{res.executionTimeMs}ms</span>
                    </div>
                    <div className="text-blue-300 truncate font-semibold">
                      $ {res.command}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span className="capitalize text-slate-300">{res.type} output</span>
                      {res.downloadUrl && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Download size={10} /> File Ready
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

        {/* Right Column: Detailed Output & Result Viewer */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Output Inspector
              </span>
              {selectedResult && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Status: 200 OK
                </span>
              )}
            </div>

            {selectedResult && (
              <div className="flex items-center gap-2">
                {selectedResult.downloadUrl && (
                  <a
                    href={selectedResult.downloadUrl}
                    download={selectedResult.downloadFilename || 'Office_CLI_Export.csv'}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    <Download size={13} />
                    Download File
                  </a>
                )}
                <button
                  onClick={() => handleCopyText(JSON.stringify(selectedResult.content, null, 2), selectedResult.id)}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-300"
                >
                  {copiedId === selectedResult.id ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === selectedResult.id ? 'Copied' : 'Copy Result'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {!selectedResult ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 p-8 text-center">
                <FileSpreadsheet size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600">No output selected</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Run a CLI command or click an entry from the execution log on the left to view response data.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Process Step Logs */}
                <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs text-slate-300 space-y-1">
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2">
                    Execution Trace Logs
                  </p>
                  {selectedResult.outputLog.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>

                {/* Output Content Visualizer */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Result Data Stream ({selectedResult.type})
                  </h4>

                  {selectedResult.type === 'table' && Array.isArray(selectedResult.content) && (
                    <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                      <table className="w-full text-xs text-left text-slate-700">
                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <tr>
                            {Object.keys(selectedResult.content[0] || {}).map(col => (
                              <th key={col} className="px-3 py-2.5 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {selectedResult.content.map((row: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              {Object.values(row).map((val: any, j: number) => (
                                <td key={j} className="px-3 py-2 whitespace-nowrap">{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedResult.type === 'text' && (
                    <pre className="p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedResult.content}
                    </pre>
                  )}

                  {selectedResult.type === 'badge' && (
                    <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-950">
                      <div className="flex items-center gap-2 font-black text-sm">
                        <CheckCheck size={18} className="text-emerald-600" />
                        <span>{selectedResult.content.message}</span>
                      </div>
                      <div className="text-xs space-y-1 pt-2 border-t border-emerald-200 font-medium">
                        <p>• Affected Lots: {selectedResult.content.affectedOrders}</p>
                        <p>• Target Process Stage: {selectedResult.content.targetStage}</p>
                        <p>• Preserved Log Rule: First Recv and Last Delivery Log Retained</p>
                      </div>
                    </div>
                  )}

                  {selectedResult.type === 'json' && (
                    <pre className="p-4 bg-slate-900 border border-slate-800 rounded-2xl font-mono text-xs text-emerald-400 overflow-x-auto">
                      {JSON.stringify(selectedResult.content, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
