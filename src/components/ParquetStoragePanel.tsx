import React, { useState, useEffect } from "react";
import {
  Database,
  Upload,
  RefreshCw,
  CheckCircle2,
  Zap,
  HardDrive,
  FileSpreadsheet,
  ArrowDownToLine
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface ParquetTableStat {
  table: string;
  rowCount: number;
  columnCount: number;
  csvBytes: number;
  jsonBytes: number;
  parquetSnappyBytes: number;
  parquetGzipBytes: number;
  compressionRatioVsCsv: number;
  compressionRatioVsJson: number;
  spaceSavedVsCsvPercent: number;
  parquetReadMs: number;
  csvParseMs: number;
  speedupFactor: number;
  savedOnDisk: boolean;
  diskBytes: number;
  diskUpdatedAt: string | null;
}

interface ParquetStatsResponse {
  parquetDir: string;
  tables: ParquetTableStat[];
  summary: {
    totalRows: number;
    csvBytes: number;
    jsonBytes: number;
    parquetSnappyBytes: number;
    parquetGzipBytes: number;
    diskBytes: number;
    csvParseMs: number;
    parquetReadMs: number;
    overallCompressionVsCsv: number;
    overallSpaceSavedPercent: number;
    overallSpeedup: number;
  };
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ParquetStoragePanel({
  activeDbMode,
  onSwitchToParquet,
  switchingDbMode
}: {
  activeDbMode?: string;
  onSwitchToParquet?: () => void;
  switchingDbMode?: boolean;
}) {
  const [stats, setStats] = useState<ParquetStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [codec, setCodec] = useState<"GZIP" | "SNAPPY">("GZIP");
  const [restoringTable, setRestoringTable] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/parquet/stats");
      if (!res.ok) throw new Error("Failed to fetch Parquet stats");
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      toast.error(err.message || "Could not load Apache Parquet statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSyncParquet = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/backup/parquet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codec })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(data.message || "All tables synced to Apache Parquet!");
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Parquet sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDownloadTable = (table: string) => {
    toast.info(`Generating ${table}.parquet (${codec})...`);
    window.location.href = `/api/backup/parquet/export/${encodeURIComponent(table)}?codec=${codec}`;
  };

  const handleRestoreParquet = async (table: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm(`Restore "${table}" records from Apache Parquet file "${file.name}"?`)) {
      e.target.value = "";
      return;
    }

    setRestoringTable(table);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("table", table);

    try {
      const res = await fetch("/api/backup/parquet/restore", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      toast.success(data.message || `Restored ${table} from Parquet!`);
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to import .parquet file");
    } finally {
      setRestoringTable(null);
      e.target.value = "";
    }
  };

  const isParquetActive = activeDbMode === "parquet";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="p-6 border-b border-slate-200 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 bg-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider">
              <Zap size={12} /> Apache Parquet Engine
            </span>
            {isParquetActive && (
              <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
                <CheckCircle2 size={11} /> Active Primary Database
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold tracking-tight">
            Columnar Binary Database (.parquet) — CSV-এর চেয়ে ছোট ও অনেক দ্রুত
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl">
            সিস্টেমের সব অর্ডার, ডেইলি লগ ও বায়ার ডাটা ব্যাংক এখন সরাসরি Apache Parquet (.parquet) কলামার ফরম্যাটে সংরক্ষণ, কমপ্রেস ও রিস্টোর করা যাবে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value as "GZIP" | "SNAPPY")}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:border-blue-500"
            title="Compression Codec"
          >
            <option value="GZIP">GZIP (Max Compression)</option>
            <option value="SNAPPY">SNAPPY (Ultra Fast)</option>
          </select>

          <button
            type="button"
            onClick={handleSyncParquet}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            <HardDrive size={14} className={syncing ? "animate-pulse" : ""} />
            {syncing ? "Saving .parquet..." : "Save All Tables to .parquet"}
          </button>

          {onSwitchToParquet && !isParquetActive && (
            <button
              type="button"
              onClick={onSwitchToParquet}
              disabled={switchingDbMode}
              className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors disabled:opacity-50"
            >
              <Database size={14} />
              {switchingDbMode ? "Switching..." : "Use Parquet as Live DB"}
            </button>
          )}
        </div>
      </div>

      {/* Benchmark KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>CSV / JSON Raw Size</span>
            <FileSpreadsheet size={14} className="text-slate-400" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {stats ? formatBytes(stats.summary.csvBytes) : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
            JSON: {stats ? formatBytes(stats.summary.jsonBytes) : "—"}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Parquet Compressed</span>
            <Zap size={14} className="text-amber-500" />
          </div>
          <div className="mt-1.5 text-xl font-black text-emerald-700 font-mono">
            {stats
              ? formatBytes(
                  codec === "GZIP" ? stats.summary.parquetGzipBytes : stats.summary.parquetSnappyBytes
                )
              : "—"}
          </div>
          <div className="text-[11px] text-emerald-700 font-bold mt-0.5">
            {stats ? `${stats.summary.overallCompressionVsCsv}x smaller (${stats.summary.overallSpaceSavedPercent}% saved)` : "Calculating..."}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Columnar Read Speed</span>
            <RefreshCw size={14} className={cn("text-blue-500", loading && "animate-spin")} />
          </div>
          <div className="mt-1.5 text-xl font-black text-blue-700 font-mono">
            {stats ? `${stats.summary.parquetReadMs.toFixed(1)} ms` : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {stats ? `${stats.summary.totalRows.toLocaleString()} total rows indexed` : "Loading..."}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Vault Disk Usage</span>
            <HardDrive size={14} className="text-slate-600" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 font-mono">
            {stats ? formatBytes(stats.summary.diskBytes) : "—"}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono" title={stats?.parquetDir}>
            {stats?.parquetDir || "./data/parquet"}
          </div>
        </div>
      </div>

      {/* High-Contrast Table */}
      <div className="overflow-x-auto">
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
            ERP Collections (.parquet Columnar Files)
          </span>
          <button
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh Stats
          </button>
        </div>

        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider">Table / File</th>
              <th className="px-4 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">Rows</th>
              <th className="px-4 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">CSV Size</th>
              <th className="px-4 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">Parquet ({codec})</th>
              <th className="px-4 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">Saved</th>
              <th className="px-4 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider">On Disk</th>
              <th className="px-5 py-3 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">Export / Restore</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading && !stats ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                  Measuring CSV vs Apache Parquet compression...
                </td>
              </tr>
            ) : (
              (stats?.tables || []).map((row) => {
                const pqSize = codec === "GZIP" ? row.parquetGzipBytes : row.parquetSnappyBytes;
                const savedPct =
                  row.csvBytes > 0
                    ? Math.max(0, ((row.csvBytes - pqSize) / row.csvBytes) * 100).toFixed(1)
                    : "0.0";

                return (
                  <tr key={row.table} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-mono font-bold text-slate-900">{row.table}.parquet</div>
                      <div className="text-[10px] text-slate-500">{row.columnCount} columns • Read {row.parquetReadMs}ms</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      {row.rowCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatBytes(row.csvBytes)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      {formatBytes(pqSize)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                        -{savedPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.savedOnDisk ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 size={12} /> {formatBytes(row.diskBytes)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not synced yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadTable(row.table)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-colors"
                          title={`Download ${row.table}.parquet`}
                        >
                          <ArrowDownToLine size={12} />
                          .parquet
                        </button>

                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-[11px] cursor-pointer transition-colors">
                          <Upload size={12} />
                          {restoringTable === row.table ? "..." : "Import"}
                          <input
                            type="file"
                            accept=".parquet"
                            disabled={restoringTable === row.table}
                            onChange={(e) => handleRestoreParquet(row.table, e)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
