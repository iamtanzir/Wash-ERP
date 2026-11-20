import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Download, FileBarChart, Ruler, Trash2 } from "lucide-react";
import { useAuth } from "@/erp/contexts/AuthContext";
import { dhakaDateStr } from "@/erp/lib/production";
import {
  DEFAULT_COUNTRIES,
  DEFAULT_DEFECTS,
  DEFAULT_SIZES,
  NO_SIZE,
  STAGES,
  defectSummary,
  entryTotal,
  groupEntries,
  normalizeDefect,
  parseSizeList,
  rejectionPct,
  sizeColumns,
  type RejectionEntry,
  type Stage,
} from "@/erp/lib/rejection";

interface OrderRow { id: string; buyer?: string; file_no?: string; color?: string; style_no?: string }
interface LogRow { erp_order?: string; received_qty?: number }
interface SizeSet { id: string; buyer: string; sizes: string[] }

const ENTRIES = "rejection_entries";
const SIZE_SETS = "rejection_size_sets";

async function getList<T>(collection: string): Promise<T[]> {
  const res = await fetch(`/api/db/${collection}`);
  if (!res.ok) throw new Error(`Could not load ${collection}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}
async function send(url: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const pct = (n: number) => `${n.toFixed(2)}%`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "buyer";
const input =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const label = "text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

export default function RejectionReport() {
  const { isEditor, isAdmin } = useAuth() as { isEditor: boolean; isAdmin: boolean };
  const [tab, setTab] = useState<"entry" | "report" | "sizes">("entry");
  const qc = useQueryClient();

  const entriesQ = useQuery({ queryKey: [ENTRIES], queryFn: () => getList<RejectionEntry>(ENTRIES) });
  const setsQ = useQuery({ queryKey: [SIZE_SETS], queryFn: () => getList<SizeSet>(SIZE_SETS) });
  const ordersQ = useQuery({ queryKey: ["rej", "erp_orders"], queryFn: () => getList<OrderRow>("erp_orders") });
  const logsQ = useQuery({ queryKey: ["rej", "daily_logs"], queryFn: () => getList<LogRow>("daily_logs") });

  const receivedByOrder = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of logsQ.data ?? []) {
      if (l.erp_order) m[l.erp_order] = (m[l.erp_order] ?? 0) + (Number(l.received_qty) || 0);
    }
    return m;
  }, [logsQ.data]);

  const sizesFor = (buyer: string): string[] => {
    const set = (setsQ.data ?? []).find((s) => s.buyer.trim().toLowerCase() === buyer.trim().toLowerCase());
    return set?.sizes?.length ? set.sizes : DEFAULT_SIZES;
  };

  const buyers = useMemo(() => {
    const s = new Set<string>();
    (ordersQ.data ?? []).forEach((o) => o.buyer && s.add(o.buyer.trim()));
    (setsQ.data ?? []).forEach((x) => x.buyer && s.add(x.buyer.trim()));
    (entriesQ.data ?? []).forEach((x) => x.buyer && s.add(x.buyer.trim()));
    return Array.from(s).sort();
  }, [ordersQ.data, setsQ.data, entriesQ.data]);

  const tabs = [
    { id: "entry" as const, name: "Entry · এন্ট্রি", icon: ClipboardList },
    { id: "report" as const, name: "Report · রিপোর্ট", icon: FileBarChart },
    { id: "sizes" as const, name: "Buyer Size Lists", icon: Ruler },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">WASH REJECTION REPORT (SIZE-WISE)</h1>
        <p className="text-sm text-muted-foreground">সব বায়ারের সাইজ-ভিত্তিক রিজেকশন · Before / After wash · auto TTL and %</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <t.icon size={16} /> {t.name}
          </button>
        ))}
      </div>

      {tab === "entry" && (
        <EntryTab
          canEdit={isEditor}
          canDelete={isAdmin}
          buyers={buyers}
          orders={ordersQ.data ?? []}
          entries={entriesQ.data ?? []}
          receivedByOrder={receivedByOrder}
          sizesFor={sizesFor}
          onChanged={() => void qc.invalidateQueries({ queryKey: [ENTRIES] })}
        />
      )}
      {tab === "report" && (
        <ReportTab
          loading={entriesQ.isLoading}
          buyers={buyers}
          entries={entriesQ.data ?? []}
          receivedByOrder={receivedByOrder}
          sizesFor={sizesFor}
        />
      )}
      {tab === "sizes" && (
        <SizesTab
          canEdit={isEditor}
          buyers={buyers}
          sets={setsQ.data ?? []}
          onChanged={() => void qc.invalidateQueries({ queryKey: [SIZE_SETS] })}
        />
      )}
    </div>
  );
}

/* ---------------- Entry ---------------- */

function EntryTab(props: {
  canEdit: boolean;
  canDelete: boolean;
  buyers: string[];
  orders: OrderRow[];
  entries: RejectionEntry[];
  receivedByOrder: Record<string, number>;
  sizesFor: (buyer: string) => string[];
  onChanged: () => void;
}) {
  const { canEdit, canDelete, buyers, orders, entries, receivedByOrder, sizesFor, onChanged } = props;
  const [date, setDate] = useState(dhakaDateStr());
  const [buyer, setBuyer] = useState("");
  const [fileText, setFileText] = useState("");
  const [colour, setColour] = useState("");
  const [country, setCountry] = useState("");
  const [stage, setStage] = useState<Stage>("Before Wash Rejections");
  const [defect, setDefect] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [manualRecv, setManualRecv] = useState("");
  const [remarks, setRemarks] = useState("");
  const firstSizeRef = useRef<HTMLInputElement>(null);

  const sizes = [...sizesFor(buyer), NO_SIZE];
  const buyerOrders = orders.filter((o) => !buyer || (o.buyer ?? "").trim().toLowerCase() === buyer.trim().toLowerCase());
  const orderLabel = (o: OrderRow) => `${o.file_no ?? ""}${o.color ? ` - ${o.color}` : ""}`;
  const fileNo = fileText.split(" - ")[0]?.trim() ?? "";
  const order =
    buyerOrders.find((o) => orderLabel(o) === fileText) ??
    (() => {
      const byFile = buyerOrders.filter((o) => (o.file_no ?? "").trim().toLowerCase() === fileNo.toLowerCase());
      return byFile.length === 1 ? byFile[0] : undefined;
    })();
  const systemRecv = order ? receivedByOrder[order.id] ?? 0 : 0;
  const numbers: Record<string, number> = {};
  for (const s of sizes) {
    const n = parseInt(qty[s] ?? "", 10);
    if (n > 0) numbers[s] = n;
  }
  const ttl = entryTotal(numbers);
  const recv = systemRecv > 0 ? systemRecv : Number(manualRecv) || 0;

  useEffect(() => {
    if (order) {
      setColour(order.color ?? "");
      if (!buyer && order.buyer) setBuyer(order.buyer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const save = useMutation({
    mutationFn: () =>
      send(`/api/db/${ENTRIES}`, "POST", {
        date,
        buyer: buyer.trim(),
        file_no: fileNo,
        colour: colour.trim(),
        country: country.trim(),
        stage,
        defect: normalizeDefect(defect),
        sizes: numbers,
        order_id: order?.id ?? "",
        recv_qty: systemRecv > 0 ? 0 : Number(manualRecv) || 0,
        remarks: remarks.trim(),
      }),
    onSuccess: () => {
      toast.success(`Saved ${ttl} pcs rejection`);
      setQty({});
      setRemarks("");
      onChanged();
      setTimeout(() => firstSizeRef.current?.focus(), 0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => send(`/api/db/${ENTRIES}/${id}`, "DELETE"),
    onSuccess: () => {
      toast.success("Entry deleted");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!buyer.trim() || !fileNo || !defect.trim()) {
      toast.error("Buyer, ERP/File and Defect are required");
      return;
    }
    if (ttl <= 0) {
      toast.error("Enter at least one size quantity");
      firstSizeRef.current?.focus();
      return;
    }
    if (recv > 0 && ttl > recv) {
      if (!window.confirm(`Rejection ${ttl} pcs is more than Recv Qty ${recv}. Save anyway?`)) return;
    }
    save.mutate();
  };

  const recent = entries.filter((e) => e.date === date).slice(0, 30);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <form onSubmit={submit} className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Your account is read-only. Ask an admin to add entries.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={label} htmlFor="rej-date">Date *</label>
            <input id="rej-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} required />
          </div>
          <div className="space-y-1">
            <label className={label} htmlFor="rej-buyer">Buyer *</label>
            <input id="rej-buyer" list="rej-buyers" value={buyer} onChange={(e) => setBuyer(e.target.value)} className={input} placeholder="e.g. H&M" autoFocus required />
            <datalist id="rej-buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
          </div>
          <div className="space-y-1">
            <label className={label} htmlFor="rej-file">ERP / File / Job *</label>
            <input id="rej-file" list="rej-files" value={fileText} onChange={(e) => setFileText(e.target.value)} className={input} placeholder="111-8663" required />
            <datalist id="rej-files">{buyerOrders.map((o) => <option key={o.id} value={orderLabel(o)} />)}</datalist>
          </div>
          <div className="space-y-1">
            <label className={label} htmlFor="rej-colour">Colour</label>
            <input id="rej-colour" value={colour} onChange={(e) => setColour(e.target.value)} className={input} placeholder="51-122" />
          </div>
          <div className="space-y-1">
            <label className={label} htmlFor="rej-country">Country</label>
            <input id="rej-country" list="rej-countries" value={country} onChange={(e) => setCountry(e.target.value)} className={input} placeholder="US / Normal / Asia" />
            <datalist id="rej-countries">{DEFAULT_COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="space-y-1">
            <label className={label} htmlFor="rej-defect">Defect / Remarks type *</label>
            <input id="rej-defect" list="rej-defects" value={defect} onChange={(e) => setDefect(e.target.value)} className={input} placeholder="Shade Reject" required />
            <datalist id="rej-defects">{DEFAULT_DEFECTS.map((d) => <option key={d} value={d} />)}</datalist>
          </div>
        </div>

        <div className="space-y-1">
          <span className={label}>Rejection stage *</span>
          <div className="grid grid-cols-2 gap-2">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                  stage === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {s === "Before Wash Rejections" ? "Before Wash" : "After Wash"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className={label}>Size-wise qty (pcs) — {buyer || "default"} sizes</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {sizes.map((s, i) => (
              <div key={s} className="space-y-1">
                <label htmlFor={`rej-size-${i}`} className="block text-center text-[11px] font-bold text-foreground">{s}</label>
                <input
                  id={`rej-size-${i}`}
                  ref={i === 0 ? firstSizeRef : undefined}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={qty[s] ?? ""}
                  onChange={(e) => setQty({ ...qty, [s]: e.target.value })}
                  className={`${input} px-1 text-center tabular-nums`}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted p-3 text-sm">
          <div>
            <div className={label}>TTL</div>
            <div className="text-2xl font-black tabular-nums text-foreground">{fmt(ttl)}</div>
          </div>
          <div>
            <div className={label}>Recv Qty</div>
            {systemRecv > 0 ? (
              <div className="text-2xl font-black tabular-nums text-foreground" title="From Daily Update receive entries">{fmt(systemRecv)}</div>
            ) : (
              <input
                aria-label="Recv Qty"
                type="number"
                min="0"
                value={manualRecv}
                onChange={(e) => setManualRecv(e.target.value)}
                className={`${input} mt-1`}
                placeholder="type if not in system"
              />
            )}
          </div>
          <div>
            <div className={label}>This entry %</div>
            <div className="text-2xl font-black tabular-nums text-foreground">{recv > 0 ? pct(rejectionPct(ttl, recv)) : "—"}</div>
          </div>
        </div>

        <div className="space-y-1">
          <label className={label} htmlFor="rej-remarks">Note</label>
          <input id="rej-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={input} placeholder="Optional" />
        </div>

        <button
          type="submit"
          disabled={!canEdit || save.isPending}
          className="w-full rounded-xl bg-primary py-3 text-sm font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save Rejection"}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          <b>Enter</b> = Save · Buyer, file, defect stay filled for the next size row
        </p>
      </form>

      <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-foreground">Entries on {date}</h2>
        {recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No rejection entries for this date yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Buyer</th>
                  <th className="py-2 pr-2">ERP · Colour</th>
                  <th className="py-2 pr-2">Stage</th>
                  <th className="py-2 pr-2">Defect</th>
                  <th className="py-2 pr-2">Sizes</th>
                  <th className="py-2 pr-2 text-right">TTL</th>
                  {canDelete && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="py-2 pr-2 font-semibold">{e.buyer}</td>
                    <td className="py-2 pr-2">{e.file_no} · {e.colour || "—"}{e.country ? ` · ${e.country}` : ""}</td>
                    <td className="py-2 pr-2">{e.stage === "Before Wash Rejections" ? "Before" : "After"}</td>
                    <td className="py-2 pr-2">{e.defect}</td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">
                      {Object.entries(e.sizes ?? {}).map(([s, n]) => `${s}:${n}`).join("  ")}
                    </td>
                    <td className="py-2 pr-2 text-right font-bold tabular-nums">{fmt(entryTotal(e.sizes))}</td>
                    {canDelete && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          aria-label="Delete entry"
                          onClick={() => window.confirm("Delete this rejection entry?") && remove.mutate(e.id)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Report ---------------- */

function ReportTab(props: {
  loading: boolean;
  buyers: string[];
  entries: RejectionEntry[];
  receivedByOrder: Record<string, number>;
  sizesFor: (buyer: string) => string[];
}) {
  const { loading, buyers, entries, receivedByOrder, sizesFor } = props;
  const [buyer, setBuyer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stage, setStage] = useState<"" | Stage>("");

  const filtered = entries.filter(
    (e) =>
      (!buyer || e.buyer.trim().toLowerCase() === buyer.toLowerCase()) &&
      (!from || e.date >= from) &&
      (!to || e.date <= to) &&
      (!stage || e.stage === stage),
  );
  const groups = groupEntries(filtered, receivedByOrder).sort((a, b) => b.totalPct - a.totalPct);
  const cols = buyer ? sizeColumns(sizesFor(buyer), filtered) : [];
  const totalRej = groups.reduce((s, g) => s + g.total, 0);
  const totalRecv = groups.reduce((s, g) => s + g.recvQty, 0);
  const before = groups.reduce((s, g) => s + g.before, 0);
  const after = groups.reduce((s, g) => s + g.after, 0);
  const defects = defectSummary(filtered);
  const sizeTotals: Record<string, number> = {};
  for (const g of groups) for (const [s, n] of Object.entries(g.sizes)) sizeTotals[s] = (sizeTotals[s] ?? 0) + n;

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const sizeCols = buyer ? cols : sizeColumns(DEFAULT_SIZES, filtered);
    const lines = filtered.map((e) => {
      const row: Record<string, string | number> = {
        Date: e.date, Buyer: e.buyer, "ERP/File/Job": e.file_no, Colour: e.colour, Country: e.country ?? "",
      };
      for (const s of sizeCols) row[s] = Number(e.sizes?.[s]) || 0;
      row["TTL"] = entryTotal(e.sizes);
      row["Rejection Type"] = e.stage;
      row["Defect"] = e.defect;
      return row;
    });
    const summary = groups.map((g) => ({
      Buyer: g.buyer, "ERP/File/Job": g.file_no, Colour: g.colour, "Recv Qty": g.recvQty,
      "Before Wash": g.before, "Before %": g.beforePct / 100, "After Wash": g.after, "After %": g.afterPct / 100,
      "Total Rejection": g.total, "Total %": g.totalPct / 100,
    }));
    const wb = XLSX.utils.book_new();
    const s1 = XLSX.utils.json_to_sheet(summary);
    for (const ref of Object.keys(s1)) {
      const cell = s1[ref] as { t?: string; z?: string } | undefined;
      const m = ref.match(/^([FHJ])(\d+)$/);
      if (cell && m && Number(m[2]) > 1) cell.z = "0.00%";
    }
    XLSX.utils.book_append_sheet(wb, s1, "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines), "Size-wise lines");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(defects.map((d) => ({ Defect: d.defect, Qty: d.qty }))), "Defects");
    XLSX.writeFile(wb, `Rejection_Report_${buyer || "All_Buyers"}_${dhakaDateStr()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1">
          <label className={label} htmlFor="rf-buyer">Buyer</label>
          <select id="rf-buyer" value={buyer} onChange={(e) => setBuyer(e.target.value)} className={input}>
            <option value="">All buyers</option>
            {buyers.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className={label} htmlFor="rf-from">From</label>
          <input id="rf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label className={label} htmlFor="rf-to">To</label>
          <input id="rf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label className={label} htmlFor="rf-stage">Stage</label>
          <select id="rf-stage" value={stage} onChange={(e) => setStage(e.target.value as "" | Stage)} className={input}>
            <option value="">Before + After</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void exportExcel()}
          disabled={filtered.length === 0}
          className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Download size={16} /> Export Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Rejection" value={`${fmt(totalRej)} pcs`} />
        <Card title="Recv Qty (these files)" value={`${fmt(totalRecv)} pcs`} />
        <Card title="Before / After Wash" value={`${fmt(before)} / ${fmt(after)}`} />
        <Card title="Overall Rejection %" value={totalRecv > 0 ? pct(rejectionPct(totalRej, totalRecv)) : "—"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 overflow-x-auto">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-foreground">ERP / Colour summary</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No rejection entries match these filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {!buyer && <th className="py-2 pr-2">Buyer</th>}
                <th className="py-2 pr-2">ERP/File</th>
                <th className="py-2 pr-2">Colour</th>
                {cols.map((c) => <th key={c} className="py-2 pr-2 text-right">{c}</th>)}
                <th className="py-2 pr-2 text-right">Recv</th>
                <th className="py-2 pr-2 text-right">Before</th>
                <th className="py-2 pr-2 text-right">After</th>
                <th className="py-2 pr-2 text-right">TTL</th>
                <th className="py-2 text-right">TTL %</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key} className="border-b border-border/60">
                  {!buyer && <td className="py-2 pr-2 font-semibold">{g.buyer}</td>}
                  <td className="py-2 pr-2 font-semibold">{g.file_no}</td>
                  <td className="py-2 pr-2">{g.colour || "—"}</td>
                  {cols.map((c) => <td key={c} className="py-2 pr-2 text-right tabular-nums">{fmt(g.sizes[c] ?? 0)}</td>)}
                  <td className="py-2 pr-2 text-right tabular-nums">{g.recvQty ? fmt(g.recvQty) : "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmt(g.before)}{g.recvQty ? <span className="text-muted-foreground"> · {pct(g.beforePct)}</span> : null}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmt(g.after)}{g.recvQty ? <span className="text-muted-foreground"> · {pct(g.afterPct)}</span> : null}</td>
                  <td className="py-2 pr-2 text-right font-bold tabular-nums">{fmt(g.total)}</td>
                  <td className={`py-2 text-right font-black tabular-nums ${g.totalPct >= 1 ? "text-destructive" : "text-foreground"}`}>
                    {g.recvQty ? pct(g.totalPct) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="font-black">
                {!buyer && <td className="py-2 pr-2" />}
                <td className="py-2 pr-2">Grand Total</td>
                <td className="py-2 pr-2" />
                {cols.map((c) => <td key={c} className="py-2 pr-2 text-right tabular-nums">{fmt(sizeTotals[c] ?? 0)}</td>)}
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(totalRecv)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(before)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(after)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{fmt(totalRej)}</td>
                <td className="py-2 text-right tabular-nums">{totalRecv > 0 ? pct(rejectionPct(totalRej, totalRecv)) : "—"}</td>
              </tr>
            </tbody>
          </table>
        )}
        {!buyer && groups.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Pick one buyer to see size-wise columns (each buyer has its own size list).</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-foreground">Defect-wise</h2>
        {defects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No defects recorded.</p>
        ) : (
          <div className="space-y-2">
            {defects.map((d) => (
              <div key={d.defect} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 truncate font-semibold">{d.defect}</span>
                <div className="h-3 flex-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${totalRej ? (d.qty / totalRej) * 100 : 0}%` }} />
                </div>
                <span className="w-24 text-right tabular-nums">{fmt(d.qty)} · {totalRej ? Math.round((d.qty / totalRej) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={label}>{title}</div>
      <div className="mt-1 text-2xl font-black tabular-nums text-foreground">{value}</div>
    </div>
  );
}

/* ---------------- Size lists ---------------- */

function SizesTab(props: { canEdit: boolean; buyers: string[]; sets: SizeSet[]; onChanged: () => void }) {
  const { canEdit, buyers, sets, onChanged } = props;
  const [buyer, setBuyer] = useState("");
  const [text, setText] = useState(DEFAULT_SIZES.join(", "));

  useEffect(() => {
    const s = sets.find((x) => x.buyer.trim().toLowerCase() === buyer.trim().toLowerCase());
    setText((s?.sizes?.length ? s.sizes : DEFAULT_SIZES).join(", "));
  }, [buyer, sets]);

  const save = useMutation({
    mutationFn: () => {
      const sizes = parseSizeList(text);
      if (!buyer.trim() || sizes.length === 0) throw new Error("Enter a buyer and at least one size");
      return send(`/api/db/${SIZE_SETS}/${slug(buyer)}`, "PATCH", { buyer: buyer.trim(), sizes });
    },
    onSuccess: () => {
      toast.success(`Size list saved for ${buyer}`);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Each buyer can have its own sizes. Buyers without a list use {DEFAULT_SIZES.join(", ")}. "{NO_SIZE}" is always added.
        </p>
        <div className="space-y-1">
          <label className={label} htmlFor="sz-buyer">Buyer</label>
          <input id="sz-buyer" list="sz-buyers" value={buyer} onChange={(e) => setBuyer(e.target.value)} className={input} placeholder="e.g. NEXT" />
          <datalist id="sz-buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
        <div className="space-y-1">
          <label className={label} htmlFor="sz-list">Sizes (comma separated, in order)</label>
          <input id="sz-list" value={text} onChange={(e) => setText(e.target.value)} className={input} placeholder="6, 8, 10, 12, 14" />
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!canEdit || save.isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          Save size list
        </button>
      </div>
      <div className="lg:col-span-7 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-foreground">Saved size lists</h2>
        {sets.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet — every buyer uses {DEFAULT_SIZES.join(", ")}.</p>
        ) : (
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setBuyer(s.buyer)} className="w-full rounded-lg border border-border p-3 text-left hover:bg-accent">
                  <span className="font-bold">{s.buyer}</span>
                  <span className="ml-3 text-sm text-muted-foreground">{s.sizes.join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
