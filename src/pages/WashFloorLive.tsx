import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  Maximize2,
  Minimize2,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { api, DailyLog, Order } from "../lib/api";
import { formatNumber } from "../lib/utils";
import { useRealTimeClock, getRealTime } from "../hooks/useRealTime";
import { SpringNumber } from "../components/SpringMotion";
import { prefetchRoute } from "../lib/routePrefetch";
import type { WashMcLoad } from "./WashMcLoadPlan";

const DAILY_TARGET_KEY = "wash_daily_target";
const LEGACY_TARGET_KEY = "wash_floor_daily_target_v1";
const RUNNING_STATUSES = new Set(["In Washing", "Hydroing", "Drying"]);

function getDhakaISODate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value || "2026";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function toIsoDate(raw?: string): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s || s === "-") return "";
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    return `${dmySlash[3]}-${dmySlash[2].padStart(2, "0")}-${dmySlash[1].padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return "";
  return getDhakaISODate(parsed);
}

function formatDhakaLongDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  return `${weekday}, ${day} ${month} ${year}`;
}

function formatDhakaClock12(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value || "12";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const second = parts.find((p) => p.type === "second")?.value || "00";
  const dayPeriod = (parts.find((p) => p.type === "dayPeriod")?.value || "am").toLowerCase();
  return `${hour}:${minute}:${second} ${dayPeriod}`;
}

function formatDhakaTime24(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function machineCode(raw?: string): string {
  const s = String(raw ?? "");
  const m = s.match(/[A-Z]{2}-\d+/);
  return m ? m[0] : s.split(" (")[0] || "—";
}

function shipRisk(shipDateRaw: string | undefined, orderQty: number, totalDel: number, todayISO: string) {
  const shipISO = toIsoDate(shipDateRaw);
  if (!shipISO || totalDel >= orderQty) {
    return { risk: "ok" as const, daysLeft: null as number | null, shipISO };
  }
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const [sy, sm, sd] = shipISO.split("-").map(Number);
  const todayUTC = Date.UTC(ty, tm - 1, td);
  const shipUTC = Date.UTC(sy, sm - 1, sd);
  const daysLeft = Math.round((shipUTC - todayUTC) / 86400000);
  if (daysLeft < 0) return { risk: "late" as const, daysLeft, shipISO };
  if (daysLeft <= 3) return { risk: "due_soon" as const, daysLeft, shipISO };
  return { risk: "ok" as const, daysLeft, shipISO };
}

export default function WashFloorLive() {
  const now = useRealTimeClock();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [dailyTarget, setDailyTarget] = useState<number>(() => {
    const saved =
      Number(localStorage.getItem(DAILY_TARGET_KEY)) ||
      Number(localStorage.getItem(LEGACY_TARGET_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : 12000;
  });
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(dailyTarget));

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // Fullscreen may be restricted inside some embedded iframes
    }
  };

  const {
    data: activeOrders = [],
    isFetching: fetchingOrders,
    isError: ordersError,
    dataUpdatedAt: ordersUpdatedAt,
    refetch: refetchOrders,
  } = useQuery<Order[]>({
    queryKey: ["washFloorLiveOrders"],
    queryFn: () => api.getActiveOrders(),
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: logsRes,
    isFetching: fetchingLogs,
    isError: logsError,
    dataUpdatedAt: logsUpdatedAt,
    refetch: refetchLogs,
  } = useQuery<{ items: DailyLog[] }>({
    queryKey: ["washFloorLiveLogs"],
    queryFn: () => api.getRecentLogs(5000),
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const {
    data: washMcLoads = [],
    isFetching: fetchingLoads,
    isError: loadsError,
    dataUpdatedAt: loadsUpdatedAt,
    refetch: refetchLoads,
  } = useQuery<WashMcLoad[]>({
    queryKey: ["washFloorLiveMcLoads"],
    queryFn: async () => {
      const res = await fetch("/api/db/wash_mc_loads");
      if (!res.ok) throw new Error("Could not load wash_mc_loads");
      const data: unknown = await res.json();
      return Array.isArray(data) ? (data as WashMcLoad[]) : [];
    },
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const isRefreshing = fetchingOrders || fetchingLogs || fetchingLoads;
  const failed = ordersError || logsError || loadsError;

  const handleManualRefresh = () => {
    void refetchOrders();
    void refetchLogs();
    void refetchLoads();
  };

  const handleSaveTarget = () => {
    const parsed = Number(targetInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      setDailyTarget(parsed);
      localStorage.setItem(DAILY_TARGET_KEY, String(parsed));
      localStorage.setItem(LEGACY_TARGET_KEY, String(parsed));
    }
    setEditingTarget(false);
  };

  const todayISO = useMemo(() => getDhakaISODate(now), [now]);

  const metrics = useMemo(() => {
    const logs = logsRes?.items || [];
    const activeIds = new Set(activeOrders.map((o) => o.id));
    const perOrder = new Map<string, { rcv: number; del: number }>();

    let todayRcv = 0;
    let todayDel = 0;

    for (const o of activeOrders) {
      if (o.id) perOrder.set(o.id, { rcv: 0, del: 0 });
    }

    for (const l of logs) {
      const rcv = Number(l.received_qty) || 0;
      const del = Number(l.delivered_qty) || 0;
      if (toIsoDate(l.log_date) === todayISO) {
        todayRcv += rcv;
        todayDel += del;
      }
      if (l.erp_order && activeIds.has(l.erp_order)) {
        const cur = perOrder.get(l.erp_order) ?? { rcv: 0, del: 0 };
        cur.rcv += rcv;
        cur.del += del;
        perOrder.set(l.erp_order, cur);
      }
    }

    let wipOnFloor = 0;
    perOrder.forEach((v) => {
      wipOnFloor += v.rcv - v.del;
    });

    const risky = activeOrders
      .map((o) => {
        const t = perOrder.get(o.id) ?? { rcv: 0, del: 0 };
        const qty = Number(o.order_qty) || 0;
        const r = shipRisk(o.erp_ship_date, qty, t.del, todayISO);
        return {
          o,
          qty,
          del: t.del,
          balance: Math.max(0, qty - t.del),
          ...r,
        };
      })
      .filter((x) => x.risk === "late" || x.risk === "due_soon")
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    const todaysLoads = washMcLoads.filter(
      (l) => toIsoDate(l.plan_date) === todayISO && l.status !== "Cancelled"
    );
    const byMc = new Map<string, WashMcLoad[]>();
    for (const l of todaysLoads) {
      const code = machineCode(l.mc_number);
      byMc.set(code, [...(byMc.get(code) ?? []), l]);
    }
    const machines = Array.from(byMc.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, list]) => {
        const running = list.find((l) => RUNNING_STATUSES.has(l.status ?? ""));
        const next = list.find((l) => (l.status ?? "Planned") === "Planned");
        const done = list.filter((l) => l.status === "Completed").length;
        const kgDone = list
          .filter((l) => l.status === "Completed")
          .reduce((s, l) => s + (Number(l.total_weight_kg) || 0), 0);
        return { code, running, next, done, total: list.length, kgDone };
      });

    const targetPct =
      dailyTarget > 0 ? Math.min(100, Math.round((todayDel / dailyTarget) * 100)) : 0;

    return {
      todayRcv,
      todayDel,
      wipOnFloor,
      activeOrdersCount: activeOrders.length,
      targetPct,
      machines,
      risky,
    };
  }, [activeOrders, logsRes, washMcLoads, todayISO, dailyTarget]);

  const lastUpdatedTs = Math.max(ordersUpdatedAt || 0, logsUpdatedAt || 0, loadsUpdatedAt || 0);
  const lastUpdatedStr = lastUpdatedTs
    ? formatDhakaTime24(getRealTime(lastUpdatedTs))
    : formatDhakaTime24(now);

  return (
    <div className="min-h-screen bg-[#060b16] text-slate-100 p-4 sm:p-6 md:p-7 flex flex-col gap-5">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            onMouseEnter={() => prefetchRoute("/")}
            className="btn-neon-glass btn-neon-glass--dark btn-neon-glass--cyan gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </Link>

          <div>
            <h1 className="text-xl sm:text-2xl md:text-[26px] font-black tracking-tight text-white uppercase leading-none">
              WASH FLOOR LIVE
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              ওয়াশ ফ্লোর লাইভ · {formatDhakaLongDate(now)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right">
            <div className="font-mono text-2xl sm:text-3xl md:text-[34px] font-black tracking-wider text-white tabular-nums leading-none">
              {formatDhakaClock12(now)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              {failed ? (
                <span className="text-rose-400 font-semibold">Connection problem — retrying</span>
              ) : (
                <>Updated {lastUpdatedStr} · auto every 1 min</>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh now"
            title="Refresh live floor metrics"
            className="btn-neon-glass btn-neon-glass--dark btn-neon-glass--cyan w-10 h-10 rounded-lg disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin text-sky-300" : ""} />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Full screen"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen TV Mode"}
            className="btn-neon-glass btn-neon-glass--dark btn-neon-glass--blue w-10 h-10 rounded-lg"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </header>

      {/* 4 KPI Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TODAY RECEIVED
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">আজ রিসিভ</p>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl md:text-[42px] font-black font-mono text-emerald-400 tabular-nums leading-none">
              <SpringNumber value={metrics.todayRcv} formatter={formatNumber} />
            </span>
            <span className="text-sm font-semibold text-slate-400">pcs</span>
          </div>
        </div>

        <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              TODAY DELIVERED
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">আজ ডেলিভারি</p>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl md:text-[42px] font-black font-mono text-sky-400 tabular-nums leading-none">
              <SpringNumber value={metrics.todayDel} formatter={formatNumber} />
            </span>
            <span className="text-sm font-semibold text-slate-400">pcs</span>
          </div>
        </div>

        <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              WIP ON FLOOR
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">ফ্লোরে আছে</p>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl md:text-[42px] font-black font-mono text-amber-400 tabular-nums leading-none">
              <SpringNumber value={metrics.wipOnFloor} formatter={formatNumber} />
            </span>
            <span className="text-sm font-semibold text-slate-400">pcs</span>
          </div>
        </div>

        <div className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ACTIVE ORDERS
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">চলমান অর্ডার</p>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-4xl md:text-[42px] font-black font-mono text-white tabular-nums leading-none">
              <SpringNumber value={metrics.activeOrdersCount} formatter={formatNumber} />
            </span>
          </div>
        </div>
      </section>

      {/* Today's Target Progress Card */}
      <section className="bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-bold text-white">
                Today&apos;s Target · আজকের টার্গেট
              </h2>
              {!editingTarget ? (
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput(String(dailyTarget));
                    setEditingTarget(true);
                  }}
                  title="Adjust daily target"
                  className="text-slate-500 hover:text-slate-200 p-1 rounded transition-colors"
                >
                  <Edit3 size={13} />
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={100}
                    step={500}
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    className="w-24 px-2 py-0.5 text-xs font-mono bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-sky-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTarget}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                    title="Save target"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTarget(false)}
                    className="p-1 text-slate-400 hover:text-slate-200"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Delivered {formatNumber(metrics.todayDel)} of {formatNumber(dailyTarget)} pcs
            </p>
          </div>

          <div
            className={`text-3xl md:text-4xl font-black font-mono tabular-nums ${
              metrics.targetPct >= 100
                ? "text-emerald-400"
                : metrics.targetPct >= 60
                ? "text-sky-400"
                : "text-amber-400"
            }`}
          >
            {metrics.targetPct}%
          </div>
        </div>

        <div className="mt-4 w-full h-3.5 bg-slate-800/90 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              metrics.targetPct >= 100
                ? "bg-emerald-400"
                : metrics.targetPct >= 60
                ? "bg-sky-400"
                : "bg-amber-400"
            }`}
            style={{ width: `${metrics.targetPct}%` }}
          />
        </div>
      </section>

      {/* Bottom Two Columns: Machines Today & Late / Due Soon */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Machines Today (grouped by Machine Code) */}
        <div className="lg:col-span-7 bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col shadow-lg">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-base md:text-lg font-bold text-white">
              Machines Today · মেশিন
            </h2>
            {metrics.machines.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
                {metrics.machines.length} Machines
              </span>
            )}
          </div>

          {metrics.machines.length === 0 ? (
            <Link
              to="/wash-mc-plan"
              className="flex-1 min-h-[120px] rounded-xl border border-dashed border-slate-800 hover:border-slate-700 flex items-center justify-center p-6 text-center text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              No machine loads planned for today. Add them in Wash M/C Load Plan.
            </Link>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.machines.map((m) => {
                const cur = m.running ?? m.next;
                const isRunning = Boolean(m.running);
                return (
                  <div
                    key={m.code}
                    className="rounded-xl border border-slate-800 bg-[#060b16] p-4 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-black font-mono text-white">{m.code}</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          isRunning
                            ? "bg-sky-500 text-slate-950"
                            : cur
                            ? "bg-slate-800 text-slate-200"
                            : "bg-emerald-500 text-slate-950"
                        }`}
                      >
                        {isRunning ? m.running?.status : cur ? "Next: Planned" : "All done"}
                      </span>
                    </div>

                    {cur ? (
                      <div className="space-y-1">
                        <div className="text-base font-bold text-slate-100 truncate">
                          {cur.buyer || "—"} · {cur.style_no || "—"}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {cur.load_no} · {cur.color || "—"} · {formatNumber(Number(cur.total_weight_kg) || 0)} kg ·{" "}
                          {Math.round(Number(cur.capacity_utilization_pct) || 0)}% load
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400">No more loads today</div>
                    )}

                    <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Batches done</span>
                      <span className="font-bold font-mono tabular-nums text-slate-200">
                        {m.done} / {m.total} · {formatNumber(m.kgDone)} kg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Late & Due Soon */}
        <div className="lg:col-span-5 bg-[#0b1220] border border-slate-800/90 rounded-2xl p-5 flex flex-col shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base md:text-lg font-bold text-white">
                Late &amp; Due Soon · দেরি
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Not fully delivered, ship date passed or within 3 days
              </p>
            </div>
            {metrics.risky.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono shrink-0">
                {metrics.risky.length} Alert{metrics.risky.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {metrics.risky.length === 0 ? (
            <div className="flex-1 min-h-[120px] rounded-xl border border-dashed border-slate-800 flex items-center justify-center p-6 text-center text-sm text-slate-400">
              No late orders. Everything is on track.
            </div>
          ) : (
            <ul className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
              {metrics.risky.slice(0, 12).map((x) => (
                <li
                  key={x.o.id}
                  className={`rounded-xl border p-3.5 ${
                    x.risk === "late"
                      ? "border-rose-500/50 bg-rose-500/10"
                      : "border-amber-500/50 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base text-white truncate">
                      {x.o.file_no || "—"} · {x.o.buyer || "—"}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-black uppercase font-mono ${
                        x.risk === "late" ? "text-rose-400" : "text-amber-400"
                      }`}
                    >
                      {x.risk === "late"
                        ? `${Math.abs(x.daysLeft ?? 0)} day${Math.abs(x.daysLeft ?? 0) === 1 ? "" : "s"} late`
                        : x.daysLeft === 0
                        ? "Ships today"
                        : `${x.daysLeft} day${x.daysLeft === 1 ? "" : "s"} left`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {x.o.style_no || "—"} · {x.o.color || "—"} · Ship {x.shipISO || "—"}
                  </div>
                  <div className="text-xs text-slate-300 mt-1.5 font-mono">
                    Delivered <b className="tabular-nums text-white">{formatNumber(x.del)}</b> /{" "}
                    {formatNumber(x.qty)} · Balance{" "}
                    <b className="tabular-nums text-white">{formatNumber(x.balance)}</b>
                  </div>
                </li>
              ))}
              {metrics.risky.length > 12 && (
                <li className="text-xs text-slate-400 text-center font-mono">
                  + {metrics.risky.length - 12} more
                </li>
              )}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
