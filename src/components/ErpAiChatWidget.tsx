import React, { useState, useRef, useEffect } from 'react';
import {
  Headphones,
  Send,
  Database,
  RefreshCw,
  Minimize2,
  FileSpreadsheet,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Plus,
  Trash2,
  RotateCcw,
  Calculator,
  HardDrive
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import {
  get100MbCacheStats,
  syncSnapshotTo100MbCache,
  search100MbBrowserCache,
  appendMemoryTo100MbCache,
  clear100MbBrowserCache,
  formatCacheUsage,
  type BrowserCacheStats
} from '../lib/browserCache100Mb';

interface ExcelSheetAttachment {
  sheetName: string;
  fileName: string;
  columns: string[];
  rows: (string | number)[][];
  summaryRow?: (string | number)[];
  formulaSummary: string[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  statusLabel?: string;
  matchedOrdersCount?: number;
  latencyMs?: number;
  excelSheet?: ExcelSheetAttachment;
  rated?: 'up' | 'down';
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Assalamu Alaikum! I am connected to your live ERP database, 5-year memory archive, 100MB browser cache, and inbuilt Excel + Industrial Wash Chemical + Garment Consumption + BD Labor Law engines. Ask in English or Banglish about orders (e.g. 111-1111 ERP te koto sew hoise?), chemical recipes (500 kg acid wash), BD worker OT/HR rules, or Excel formulas like =BDOT(6700, 2).",
  statusLabel: 'Live DB • 5Y Memory • 100MB Cache'
};

const SAMPLE_PROMPTS = [
  'Today total sew/recv & delivery koto pcs?',
  'All buyers wash rejection % summary',
  '500 kg acid wash chemical koto lagbe?',
  'BD worker 6700 basic 2 hr OT & HR rules',
  '180 gsm t-shirt 1000 pcs consumption & FOB',
  'Last 5 years ERP memory & buyer history',
  'Excel: Buyer-wise Summary & WIP %'
];

export default function ErpAiChatWidget({ embedded = false }: { embedded?: boolean }) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [panelTab, setPanelTab] = useState<'chat' | 'skills'>('chat');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Self-improving skills & feedback state
  const [learnedRules, setLearnedRules] = useState<any[]>([]);
  const [builtInRules, setBuiltInRules] = useState<any[]>([]);
  const [skillStats, setSkillStats] = useState({ upvotes: 0, downvotes: 0, learnedCount: 0 });
  const [newRuleTrigger, setNewRuleTrigger] = useState('');
  const [newRuleText, setNewRuleText] = useState('');
  const [teachTargetMsgId, setTeachTargetMsgId] = useState<string | null>(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [cacheStats, setCacheStats] = useState<BrowserCacheStats>({
    usedBytes: 0,
    usedMb: 0,
    usedLabel: '0 KB',
    maxMb: 100,
    usagePct: 0,
    recordCount: 0,
    lastSyncedAt: null,
    retentionWindowStart: null
  });
  const [memory5YCount, setMemory5YCount] = useState(0);
  const [syncingCache, setSyncingCache] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSkills = async () => {
    try {
      const [data, mem5y] = await Promise.all([
        api.getSupportSkills(),
        api.getSupport5YrMemory().catch(() => ({ count: 0 }))
      ]);
      setBuiltInRules(data.builtInRules || []);
      setLearnedRules(data.learnedRules || []);
      if (data.stats) setSkillStats(data.stats);
      if (typeof mem5y?.count === 'number') setMemory5YCount(mem5y.count);
    } catch {
      // Non-blocking
    }
  };

  const sync100MbBrowserCache = async (showToast = false) => {
    setSyncingCache(true);
    try {
      const snap = await api.getSupportCacheSnapshot();
      const updated = await syncSnapshotTo100MbCache(snap);
      setCacheStats(updated);
      if (typeof snap?.memories?.length === 'number') {
        setMemory5YCount(snap.memories.length);
      }
      if (showToast) {
        toast.success(`Synced ${updated.recordCount} records (${updated.usedLabel} / 100 MB browser cache)`);
      }
    } catch {
      const stats = await get100MbCacheStats().catch(() => null);
      if (stats) setCacheStats(stats);
    } finally {
      setSyncingCache(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    api
      .getSupportHistory()
      .then(res => {
        if (mounted && Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages(res.messages);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setHistoryLoaded(true);
      });
    loadSkills();
    get100MbCacheStats().then(s => {
      if (mounted) setCacheStats(s);
    });
    sync100MbBrowserCache(false);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      sync100MbBrowserCache(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, panelTab]);

  const persistMessages = (updated: ChatMessage[]) => {
    if (!historyLoaded) return;
    api.saveSupportHistory(updated).catch(() => {});
  };

  const handleClearHistory = async () => {
    setMessages([WELCOME_MESSAGE]);
    await api.clearSupportHistory().catch(() => {});
    toast.success('Support chat thread reset');
  };

  const handleDownloadExcel = (sheet: ExcelSheetAttachment) => {
    const aoa: (string | number)[][] = [sheet.columns, ...sheet.rows];
    if (sheet.summaryRow) {
      aoa.push(sheet.summaryRow);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
    XLSX.writeFile(wb, sheet.fileName);
    toast.success(`Downloaded ${sheet.fileName}`);
  };

  const handleSend = async (customText?: string) => {
    const query = (customText ?? input).trim();
    if (!query || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: query
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    persistMessages(nextMessages);
    if (!customText) setInput('');
    setSending(true);

    try {
      const historyPayload = nextMessages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const browserCacheContext = await search100MbBrowserCache(query).catch(() => ({
        cachedBytes: cacheStats.usedBytes,
        hits: []
      }));

      const res = await api.chatWithErpAi({
        messages: historyPayload,
        provider: 'auto',
        browserCacheContext
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        statusLabel: res.formulaResult
          ? 'Formula Verified'
          : res.excelSheet
          ? 'Verified Calc + .xlsx Ready'
          : (res.fiveYearHitsCount || 0) > 0
          ? '5-Year Memory + Live DB'
          : 'Live DB + 100MB Cache',
        matchedOrdersCount: res.matchedOrdersCount,
        latencyMs: res.latencyMs,
        excelSheet: res.excelSheet
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      persistMessages(finalMessages);

      // Persist memory into 100MB IndexedDB browser cache
      const dhakaDate = new Date(Date.now() + 6 * 3600 * 1000).toISOString().split('T')[0];
      appendMemoryTo100MbCache({ query, summary: res.reply, date: dhakaDate })
        .then(() => get100MbCacheStats().then(setCacheStats))
        .catch(() => {});
    } catch (err: any) {
      // Fallback to local 100MB Browser IndexedDB Cache if network is unreachable
      const offlineCache = await search100MbBrowserCache(query).catch(() => ({ cachedBytes: 0, hits: [] }));
      if (offlineCache.hits.length > 0) {
        const offlineLines = offlineCache.hits
          .map(h => `• [${h.source}] **${h.title}** — ${h.detail}`)
          .join('\n');
        const offlineMsg: ChatMessage = {
          id: `cache-${Date.now()}`,
          role: 'assistant',
          content: `💾 **Browser 100MB Cache Recall (Offline Mode):**\n\n${offlineLines}`,
          statusLabel: '100MB Browser Cache'
        };
        setMessages(prev => [...prev, offlineMsg]);
      } else {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Could not reach support service: ${err?.message || 'Unknown error'}. Please try again.`,
          statusLabel: 'Connection Issue'
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleFeedback = async (msgIdx: number, rating: 'up' | 'down') => {
    const targetMsg = messages[msgIdx];
    const prevUserMsg = [...messages.slice(0, msgIdx)].reverse().find(m => m.role === 'user');
    const updated = messages.map((m, i) => (i === msgIdx ? { ...m, rated: rating } : m));
    setMessages(updated);
    persistMessages(updated);

    if (rating === 'down') {
      setTeachTargetMsgId(targetMsg.id);
      setCorrectionInput('');
    } else {
      await api
        .submitSupportFeedback({
          messageId: targetMsg.id,
          query: prevUserMsg?.content || '',
          reply: targetMsg.content,
          rating: 'up'
        })
        .catch(() => {});
      loadSkills();
      toast.success('Feedback saved to Support memory');
    }
  };

  const handleSubmitCorrection = async (msgIdx: number) => {
    const targetMsg = messages[msgIdx];
    const prevUserMsg = [...messages.slice(0, msgIdx)].reverse().find(m => m.role === 'user');
    if (!correctionInput.trim()) return;

    await api.submitSupportFeedback({
      messageId: targetMsg.id,
      query: prevUserMsg?.content || '',
      reply: targetMsg.content,
      rating: 'down',
      correctionNote: correctionInput.trim()
    });
    setTeachTargetMsgId(null);
    setCorrectionInput('');
    await loadSkills();
    toast.success('Support learned your correction permanently!');
  };

  const handleTeachSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    try {
      await api.teachSupportSkill({
        trigger: newRuleTrigger.trim() || 'general',
        ruleText: newRuleText.trim(),
        category: 'buyer_rule'
      });
      setNewRuleTrigger('');
      setNewRuleText('');
      await loadSkills();
      toast.success('New permanent rule taught to Support');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save rule');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await api.deleteSupportSkill(id);
      await loadSkills();
      toast.success('Rule removed');
    } catch {
      toast.error('Failed to remove rule');
    }
  };

  const renderPanel = () => (
    <div
      className={cn(
        'bg-white border border-slate-200 flex flex-col overflow-hidden',
        embedded
          ? 'rounded-2xl shadow-sm h-[540px] w-full'
          : 'rounded-2xl shadow-2xl w-[94vw] sm:w-[440px] h-[560px]'
      )}
    >
      {/* Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center shrink-0">
            <Headphones size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black tracking-wide truncate text-white">Support</h4>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <Database size={10} className="text-blue-400 shrink-0" />
              <span>
                Live DB • 5Y Memory • {cacheStats.usedLabel || formatCacheUsage(cacheStats.usedBytes)} / 100MB Cache
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setPanelTab(panelTab === 'chat' ? 'skills' : 'chat')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer',
              panelTab === 'skills' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'
            )}
            title="Self-Improving Skills & Excel Formulas"
          >
            <BookOpen size={12} />
            <span>Skills ({builtInRules.length + learnedRules.length})</span>
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset Chat Thread"
          >
            <RotateCcw size={14} />
          </button>

          {!embedded && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Minimize Support"
            >
              <Minimize2 size={15} />
            </button>
          )}
        </div>
      </div>

      {panelTab === 'skills' ? (
        /* SELF-IMPROVING MEMORY & EXCEL CALCULATION SKILL PANEL */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Learned Rules</p>
              <p className="text-base font-black text-indigo-600">{learnedRules.length}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">5Y Memory</p>
              <p className="text-base font-black text-emerald-600">{memory5YCount}</p>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Browser Cache</p>
              <p className="text-xs font-black text-blue-600">
                {cacheStats.usedLabel || formatCacheUsage(cacheStats.usedBytes)} / 100 MB
              </p>
            </div>
          </div>

          {/* 100 MB Browser Cache & 5-Year Memory Control */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-blue-900 flex items-center gap-1.5">
                <HardDrive size={14} /> 100 MB Cache &amp; 5-Year Memory
              </p>
              <span className="text-[10px] font-bold text-blue-700">
                {cacheStats.recordCount} cached items ({skillStats.upvotes} 👍🏻)
              </span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.max(2, Math.min(100, cacheStats.usagePct))}%` }}
              />
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={syncingCache}
                onClick={() => sync100MbBrowserCache(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-1.5 px-2.5 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} className={syncingCache ? 'animate-spin' : ''} />
                <span>{syncingCache ? 'Syncing...' : 'Sync 5Y Data to 100MB Cache'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  const s = await clear100MbBrowserCache();
                  setCacheStats(s);
                  toast.success('Browser cache cleared');
                }}
                className="bg-white border border-blue-200 text-slate-600 hover:text-rose-600 font-bold py-1.5 px-2.5 rounded-lg text-[10px] cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Industrial Wash, Garment & BD Labor Formula Reference */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1.5">
            <p className="font-bold text-emerald-900 flex items-center gap-1.5">
              <Calculator size={14} /> Inbuilt Wash Chem, Garment &amp; BD HR Formulas
            </p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Run formulas directly (=CHEM, =OWG, =BDOT, =BDWAGE, =EFF, =KNITCONS, =SUM, =PCT):
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {[
                '=CHEM(500, 8, 2.5)',
                '=BDOT(6700, 2)',
                '=BDWAGE(6700)',
                '=KNITCONS(74, 56, 180, 8)',
                '=EFF(850, 14, 35, 480)',
                '=PCT(1207, 2500)'
              ].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setPanelTab('chat');
                    handleSend(f);
                  }}
                  className="text-[10px] font-mono font-bold bg-white border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded hover:bg-emerald-100 cursor-pointer"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Teach New Permanent Skill */}
          <form onSubmit={handleTeachSkill} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" /> Teach Permanent Support Rule
            </p>
            <input
              type="text"
              value={newRuleTrigger}
              onChange={e => setNewRuleTrigger(e.target.value)}
              placeholder="Keywords (e.g. next, target, gsm, yilmak)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]"
            />
            <textarea
              rows={2}
              required
              value={newRuleText}
              onChange={e => setNewRuleText(e.target.value)}
              placeholder="Permanent instruction (e.g. Daily washing target for Shift A is 2500 Kg)"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] resize-none"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 rounded-lg text-[11px] cursor-pointer"
            >
              Save Permanent Knowledge
            </button>
          </form>

          {/* Learned & Built-in Rules List */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Knowledge Base</p>
            {learnedRules.map(r => (
              <div key={r.id} className="bg-white p-2.5 rounded-xl border border-indigo-200 flex items-start justify-between gap-2">
                <div>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    Learned • {r.trigger}
                  </span>
                  <p className="text-[11px] text-slate-800 mt-1">{r.ruleText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSkill(r.id)}
                  className="text-slate-300 hover:text-rose-500 p-1 cursor-pointer"
                  title="Remove Rule"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {builtInRules.map(r => (
              <div key={r.id} className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  Built-in Skill • {r.category}
                </span>
                <p className="text-[11px] text-slate-700 mt-1">{r.ruleText}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {SAMPLE_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                disabled={sending}
                className="text-[10px] font-semibold bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors shrink-0 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/40">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={cn('flex flex-col max-w-[92%]', msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}
              >
                <div
                  className={cn(
                    'px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-xs',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                  )}
                >
                  {msg.content}

                  {/* Inbuilt Excel Sheet Preview + Download Button */}
                  {msg.excelSheet && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-emerald-800 flex items-center gap-1">
                          <FileSpreadsheet size={13} /> {msg.excelSheet.sheetName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadExcel(msg.excelSheet!)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <FileSpreadsheet size={11} /> Download .xlsx
                        </button>
                      </div>
                      <div className="overflow-x-auto max-h-36 border border-slate-200 rounded-lg">
                        <table className="w-full text-[10px] text-left border-collapse">
                          <thead className="bg-slate-100 font-bold text-slate-700">
                            <tr>
                              {msg.excelSheet.columns.slice(0, 6).map((c, cIdx) => (
                                <th key={cIdx} className="p-1.5 border-b border-slate-200 whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {msg.excelSheet.rows.slice(0, 5).map((r, rIdx) => (
                              <tr key={rIdx}>
                                {r.slice(0, 6).map((cell, cellIdx) => (
                                  <td key={cellIdx} className="p-1.5 whitespace-nowrap font-mono">{String(cell)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                          {msg.excelSheet.summaryRow && (
                            <tfoot className="bg-yellow-100 font-bold text-slate-900">
                              <tr>
                                {msg.excelSheet.summaryRow.slice(0, 6).map((cell, cIdx) => (
                                  <td key={cIdx} className="p-1.5 border-t border-slate-300 whitespace-nowrap font-mono">
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer metadata & Self-Improve Feedback */}
                {msg.role === 'assistant' && (
                  <div className="flex flex-wrap items-center gap-2 mt-1 px-1">
                    {msg.statusLabel && (
                      <span className="text-[9px] text-slate-400 font-medium">
                        {msg.statusLabel}
                        {typeof msg.matchedOrdersCount === 'number' && msg.matchedOrdersCount > 0
                          ? ` • ${msg.matchedOrdersCount} DB match`
                          : ''}
                        {msg.latencyMs ? ` • ${msg.latencyMs}ms` : ''}
                      </span>
                    )}

                    {msg.id !== 'welcome' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFeedback(idx, 'up')}
                          className={cn(
                            'p-0.5 rounded hover:bg-emerald-50 cursor-pointer',
                            msg.rated === 'up' ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'
                          )}
                          title="Helpful (Reinforce)"
                        >
                          <ThumbsUp size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFeedback(idx, 'down')}
                          className={cn(
                            'p-0.5 rounded hover:bg-rose-50 cursor-pointer',
                            msg.rated === 'down' ? 'text-rose-600' : 'text-slate-300 hover:text-rose-600'
                          )}
                          title="Teach Correction"
                        >
                          <ThumbsDown size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Correction / Self-Improve Input when disliked */}
                {teachTargetMsgId === msg.id && (
                  <div className="mt-1.5 w-full bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={correctionInput}
                      onChange={e => setCorrectionInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmitCorrection(idx)}
                      placeholder="Teach Support the right rule..."
                      className="flex-1 bg-white border border-amber-200 rounded-lg px-2 py-1 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSubmitCorrection(idx)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      Teach
                    </button>
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="mr-auto flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-500 shadow-xs">
                <RefreshCw size={13} className="animate-spin text-blue-600" />
                <span>Calculating &amp; checking live ERP database...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask ERP DB or =SUM(100, 200) / Excel Sheet..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-2.5 rounded-xl transition-colors shrink-0 cursor-pointer"
              title="Send to Support"
            >
              <Send size={15} />
            </button>
          </form>
        </>
      )}
    </div>
  );

  if (embedded) {
    return renderPanel();
  }

  return (
    <div className="fixed bottom-12 right-5 z-50 flex flex-col items-end">
      {isOpen ? (
        <div className="mb-2">{renderPanel()}</div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-full shadow-xl border border-slate-700 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Live ERP Support • Permanent Memory & Excel Calculations"
        >
          <Headphones size={15} className="text-emerald-400" />
          <span className="text-xs font-extrabold tracking-wide">Support</span>
        </button>
      )}
    </div>
  );
}
