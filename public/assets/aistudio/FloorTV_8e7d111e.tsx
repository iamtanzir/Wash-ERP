import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Maximize2, RefreshCw } from "lucide-react";
import { dhakaDateStr, shipRisk, toIsoDate } from "@/erp/lib/production";

// Big-screen live view for the wash floor TV. Refreshes itself every minute.
const REFRESH_MS = 60 * 1000;
const RUNNING = ["In Washing", "Hydroing", "Drying"];

interface OrderRow {
  id: string;
  buyer?: string;
  file_no?: string;
  style_no?: string;
  color?: string;
  order_qty?: number | string;
  status?: string;
  erp_ship_date?: string;
}
interface LogRow {
  id: string;
  erp_order?: string;
  log_date?: string;
  received_qty?: number;
  delivered_qty?: number;
}
interface LoadRow {
  id: string;
  load_no?: string;
  mc_number?: string;
  plan_date?: string;
  shift?: string;
  buyer?: string;
  style_no?: string;
  color?: string;
  total_weight_kg?: number;
  capacity_utilization_pct?: number;
  status?: string;
}

async function getList<T>(collection: string): Promise<T[]> {
  const res = await fetch(`/api/db/${collection}`);
  if (!res.ok) throw new Error(`Could not load ${collection}`);
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

function machineCode(raw: string | undefined): string {
  const s = String(raw ?? "");
  const m = s.match(/[A-Z]{2}-\d+/);
  return m ? m[0] : s.split(" (")[0] || "—";
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function FloorTV() {
  const now = useClock();
  const today = dhakaDateStr(now);
  const opts = { refetchInterval: REFRESH_MS, refetchOnWindowFocus: true } as const;
  const orders = useQuery({ queryKey: ["tv", "erp_orders"], queryFn: () => getList<OrderRow>("erp_orders"), ...opts });
  const logs = useQuery({ queryKey: ["tv", "daily_logs"], queryFn: () => getList<LogRow>("daily_logs"), ...opts });
  const loads = useQuery({ queryKey: ["tv", "wash_mc_loads"], queryFn: () => getList<LoadRow>("wash_mc_loads"), ...opts });

  const target = useMemo(() => {
    const saved = Number(typeof window !== "undefined" ? localStorage.getItem("wash_daily_target") : 0);
    return saved > 0 ? saved : 12000;
  }, []);

  const stats = useMemo(() => {
    const active = (orders.data ?? []).filter((o) => o.status !== "Closed");
    const activeIds = new Set(active.map((o) => o.id));
    const perOrder = new Map<string, { rcv: number; del: number }>();
    let todayRcv = 0;
    let todayDel = 0;
    for (const l of logs.data ?? []) {
      const rcv = Number(l.received_qty) || 0;
      const del = Number(l.delivered_qty) || 0;
      if (toIsoDate(l.log_date) === today) {
        todayRcv += rcv;
        todayDel += del;
      }
      if (l.erp_order && activeIds.has(l.erp_order)) {
        const t = perOrder.get(l.erp_order) ?? { rcv: 0, del: 0 };
        t.rcv += rcv;
        t.del += del;
        perOrder.set(l.erp_order, t);
      }
    }
    let wip = 0;
    perOrder.forEach((t) => (wip += t.rcv - t.del));

    const risky = active
      .map((o) => {
        const t = perOrder.get(o.id) ?? { rcv: 0, del: 0 };
        const qty = Number(o.order_qty) || 0;
        const r = shipRisk(o.erp_ship_date, qty, t.del, today);
        return { o, qty, del: t.del, balance: Math.max(0, qty - t.del), ...r };
      })
      .filter((x) => x.risk === "late" || x.risk === "due_soon")
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    const todaysLoads = (loads.data ?? []).filter((l) => l.plan_date === today && l.status !== "Cancelled");
    const byMc = new Map<string, LoadRow[]>();
    for (const l of todaysLoads) {
      const code = machineCode(l.mc_number);
      byMc.set(code, [...(byMc.get(code) ?? []), l]);
    }
    const machines = Array.from(byMc.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, list]) => {
        const running = list.find((l) => RUNNING.includes(l.status ?? ""));
        const next = list.find((l) => (l.status ?? "Planned") === "Planned");
        const done = list.filter((l) => l.status === "Completed").length;
        const kgDone = list
          .filter((l) => l.status === "Completed")
          .reduce((s, l) => s + (Number(l.total_weight_kg) || 0), 0);
        return { code, running, next, done, total: list.length, kgDone };
      });

    return { activeCount: active.length, todayRcv, todayDel, wip, risky, machines };
  }, [orders.data, logs.data, loads.data, today]);

  const pct = target > 0 ? Math.min(100, Math.round((stats.todayDel / target) * 100)) : 0;
  const loading = orders.isLoading || logs.isLoading || loads.isLoading;
  const failed = orders.isError || logs.isError || loads.isError;
  const updatedAt = Math.max(orders.dataUpdatedAt, logs.dataUpdatedAt, loads.dataUpdatedAt);

  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka", weekday: "long", day: "2-digit", month: "short", year: "numeric",
  }).format(now);

  const refreshAll = () => {
    void orders.refetch();
    void logs.refetch();
    void loads.refetch();
  };

  return (
    <div className="dark dark-mode-ignore">
      <div className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 font-sans">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} /> Dashboard
            </Link>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">WASH FLOOR LIVE</h1>
              <p className="text-sm md:text-base text-muted-foreground">ওয়াশ ফ্লোর লাইভ · {dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-3xl md:text-5xl font-bold tabular-nums">{timeStr}</div>
              <div className="text-xs text-muted-foreground">
                {failed ? (
                  <span className="text-destructive font-semibold">Connection problem — retrying</span>
                ) : updatedAt ? (
                  <>Updated {new Date(updatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka" })} · auto every 1 min</>
                ) : (
                  "Loading…"
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              aria-label="Refresh now"
              className="rounded-lg border border-border p-3 hover:bg-accent"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => void document.documentElement.requestFullscreen?.()}
              aria-label="Full screen"
              className="rounded-lg border border-border p-3 hover:bg-accent"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </header>

        {/* Today's numbers */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Kpi label="Today Received" sub="আজ রিসিভ" value={fmt(stats.todayRcv)} unit="pcs" tone="text-success" />
          <Kpi label="Today Delivered" sub="আজ ডেলিভারি" value={fmt(stats.todayDel)} unit="pcs" tone="text-info" />
          <Kpi label="WIP on Floor" sub="ফ্লোরে আছে" value={fmt(stats.wip)} unit="pcs" tone="text-warning" />
          <Kpi label="Active Orders" sub="চলমান অর্ডার" value={fmt(stats.activeCount)} unit="" tone="text-foreground" />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 mb-6">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg md:text-xl font-bold">Today's Target · আজকের টার্গেট</h2>
              <p className="text-sm text-muted-foreground">
                Delivered {fmt(stats.todayDel)} of {fmt(target)} pcs
              </p>
            </div>
            <div className={`text-4xl md:text-6xl font-black tabular-nums ${pct >= 100 ? "text-success" : pct >= 60 ? "text-info" : "text-warning"}`}>
              {pct}%
            </div>
          </div>
          <div className="h-5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-success" : pct >= 60 ? "bg-info" : "bg-warning"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Machines */}
          <section className="xl:col-span-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg md:text-xl font-bold mb-4">Machines Today · মেশিন</h2>
            {stats.machines.length === 0 ? (
              <Empty text="No machine loads planned for today. Add them in Wash M/C Load Plan." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.machines.map((m) => {
                  const cur = m.running ?? m.next;
                  const isRunning = Boolean(m.running);
                  return (
                    <div key={m.code} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-black font-mono">{m.code}</span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isRunning ? "bg-info text-background" : cur ? "bg-muted text-foreground" : "bg-success text-background"
                          }`}
                        >
                          {isRunning ? m.running?.status : cur ? "Next: Planned" : "All done"}
                        </span>
                      </div>
                      {cur ? (
                        <div className="space-y-1">
                          <div className="text-lg font-bold truncate">
                            {cur.buyer || "—"} · {cur.style_no || "—"}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {cur.load_no} · {cur.color || "—"} · {fmt(Number(cur.total_weight_kg) || 0)} kg ·{" "}
                            {Math.round(Number(cur.capacity_utilization_pct) || 0)}% load
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No more loads today</div>
                      )}
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Batches done</span>
                        <span className="font-bold tabular-nums">
                          {m.done} / {m.total} · {fmt(m.kgDone)} kg
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Late and due-soon orders */}
          <section className="xl:col-span-2 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg md:text-xl font-bold mb-1">Late &amp; Due Soon · দেরি</h2>
            <p className="text-sm text-muted-foreground mb-4">Not fully delivered, ship date passed or within 3 days</p>
            {stats.risky.length === 0 ? (
              <Empty text="No late orders. Everything is on track." />
            ) : (
              <ul className="space-y-3">
                {stats.risky.slice(0, 12).map((x) => (
                  <li
                    key={x.o.id}
                    className={`rounded-xl border p-3 ${x.risk === "late" ? "border-destructive bg-destructive/15" : "border-warning bg-warning/10"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-lg truncate">
                        {x.o.file_no || "—"} · {x.o.buyer || "—"}
                      </span>
                      <span className={`shrink-0 text-sm font-black ${x.risk === "late" ? "text-destructive" : "text-warning"}`}>
                        {x.risk === "late"
                          ? `${Math.abs(x.daysLeft ?? 0)} day${Math.abs(x.daysLeft ?? 0) === 1 ? "" : "s"} late`
                          : x.daysLeft === 0
                            ? "Ships today"
                            : `${x.daysLeft} day${x.daysLeft === 1 ? "" : "s"} left`}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {x.o.style_no || "—"} · {x.o.color || "—"} · Ship {toIsoDate(x.o.erp_ship_date)}
                    </div>
                    <div className="text-sm mt-1">
                      Delivered <b className="tabular-nums">{fmt(x.del)}</b> / {fmt(x.qty)} · Balance{" "}
                      <b className="tabular-nums">{fmt(x.balance)}</b>
                    </div>
                  </li>
                ))}
                {stats.risky.length > 12 && (
                  <li className="text-sm text-muted-foreground">+ {stats.risky.length - 12} more</li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, sub, value, unit, tone }: { label: string; sub: string; value: string; unit: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
      <div className={`mt-2 text-4xl md:text-6xl font-black tabular-nums ${tone}`}>
        {value}
        {unit && <span className="ml-2 text-base md:text-xl font-bold text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{text}</div>;
}
