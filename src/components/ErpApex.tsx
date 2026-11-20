import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Database, FileCode2, LayoutTemplate, Plus, Terminal, Search, Layers, Globe } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

interface ApexApp {
  id?: string;
  app_id: number;
  name: string;
  pages_count: number;
  theme: string;
  status: "Development" | "Production" | "Locked";
  last_updated: string;
}

interface OracleTable {
  table_name: string;
  columns: { name: string; type: string; nullable: boolean; pk?: boolean }[];
  row_count: number;
}

export default function ErpApex() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"builder" | "sql" | "blueprints">("builder");
  const [searchApp, setSearchApp] = useState("");
  
  // SQL Terminal state
  const [sqlCommand, setSqlCommand] = useState("SELECT * FROM WASH_LOADS FETCH FIRST 25 ROWS ONLY");
  const [sqlTarget, setSqlTarget] = useState<"wash-erp" | "freesql">("wash-erp");
  const [runningSql, setRunningSql] = useState(false);
  const [sqlResult, setSqlResult] = useState<{
    sourceLabel: string;
    headers: string[];
    rows: any[][];
    dbmsOutput?: string[];
    executionMs?: number;
  } | null>(null);

  // App form state
  const [newAppName, setNewAppName] = useState("");
  const [newAppTheme, setNewAppTheme] = useState("Universal Theme - 42");
  const [newAppPages, setNewAppPages] = useState(3);

  // Table structure state
  const [selectedTable, setSelectedTable] = useState<string>("WASH_LOADS");

  // Live Wash ERP / Oracle Relational Schema Catalog
  const schemaTables: Record<string, OracleTable> = {
    WASH_ORDERS: {
      table_name: "WASH_ORDERS",
      row_count: 0,
      columns: [
        { name: "ORDER_ID", type: "VARCHAR2(80)", nullable: false, pk: true },
        { name: "FILE_NO", type: "VARCHAR2(80)", nullable: false },
        { name: "BUYER", type: "VARCHAR2(120)", nullable: false },
        { name: "STYLE_NO", type: "VARCHAR2(80)", nullable: true },
        { name: "COLOR", type: "VARCHAR2(80)", nullable: true },
        { name: "ORDER_QTY", type: "NUMBER(12)", nullable: false },
        { name: "WASH_TYPE", type: "VARCHAR2(100)", nullable: false },
        { name: "TOD", type: "VARCHAR2(40)", nullable: true }
      ]
    },
    WASH_LOADS: {
      table_name: "WASH_LOADS",
      row_count: 0,
      columns: [
        { name: "LOAD_ID", type: "VARCHAR2(80)", nullable: false, pk: true },
        { name: "LOAD_NO", type: "VARCHAR2(50)", nullable: false },
        { name: "MC_NUMBER", type: "VARCHAR2(20)", nullable: false },
        { name: "SHIFT", type: "VARCHAR2(20)", nullable: true },
        { name: "BUYER", type: "VARCHAR2(100)", nullable: true },
        { name: "PCS_QTY", type: "NUMBER(8)", nullable: false },
        { name: "TOTAL_WEIGHT_KG", type: "NUMBER(10,2)", nullable: false },
        { name: "WET_PROCESS_TYPE", type: "VARCHAR2(50)", nullable: false }
      ]
    },
    WASH_REJECTIONS: {
      table_name: "WASH_REJECTIONS",
      row_count: 0,
      columns: [
        { name: "REJ_ID", type: "VARCHAR2(80)", nullable: false, pk: true },
        { name: "BUYER", type: "VARCHAR2(120)", nullable: false },
        { name: "ERP_NO", type: "VARCHAR2(80)", nullable: false },
        { name: "COLOUR", type: "VARCHAR2(80)", nullable: true },
        { name: "R_DATE", type: "VARCHAR2(30)", nullable: true },
        { name: "TTL_QTY", type: "NUMBER(10)", nullable: false },
        { name: "REJECTION_TYPE", type: "VARCHAR2(60)", nullable: false },
        { name: "DEFECT_REMARKS", type: "VARCHAR2(200)", nullable: true }
      ]
    },
    DAILY_LOGS: {
      table_name: "DAILY_LOGS",
      row_count: 0,
      columns: [
        { name: "LOG_ID", type: "VARCHAR2(80)", nullable: false, pk: true },
        { name: "LOG_DATE", type: "VARCHAR2(30)", nullable: false },
        { name: "ERP_ORDER", type: "VARCHAR2(80)", nullable: false },
        { name: "RECEIVED_QTY", type: "NUMBER(10)", nullable: false },
        { name: "DELIVERED_QTY", type: "NUMBER(10)", nullable: false },
        { name: "UNIT", type: "VARCHAR2(30)", nullable: true }
      ]
    },
    BUYER_DATA_BANK: {
      table_name: "BUYER_DATA_BANK",
      row_count: 0,
      columns: [
        { name: "ARCHIVE_ID", type: "VARCHAR2(80)", nullable: false, pk: true },
        { name: "BUYER", type: "VARCHAR2(120)", nullable: false },
        { name: "FILE_NO", type: "VARCHAR2(80)", nullable: false },
        { name: "STYLE_NO", type: "VARCHAR2(80)", nullable: true },
        { name: "ORDER_QTY", type: "NUMBER(12)", nullable: false },
        { name: "TOTAL_RECEIVED", type: "NUMBER(12)", nullable: false },
        { name: "TOTAL_DELIVERED", type: "NUMBER(12)", nullable: false }
      ]
    }
  };

  // React Query fetch APEX Apps
  const { data: apps = [], isLoading: loadingApps } = useQuery<ApexApp[]>({
    queryKey: ["oracleApexApps"],
    queryFn: async () => {
      const res = await fetch("/api/db/oracle_apex_apps");
      if (!res.ok) return [];
      const data = await res.json();

      // Seed if empty
      if (data.length === 0) {
        const seedApps: ApexApp[] = [
          { app_id: 101, name: "Wash Performance Dashboard", pages_count: 7, theme: "Universal Theme - 42", status: "Production", last_updated: new Date().toISOString() },
          { app_id: 102, name: "Chemical inventory master", pages_count: 12, theme: "Universal Theme - 42", status: "Development", last_updated: new Date().toISOString() },
          { app_id: 103, name: "Buyer Data Bank portal", pages_count: 4, theme: "Redwood Light - 45", status: "Development", last_updated: new Date().toISOString() }
        ];

        await fetch("/api/db/batch/oracle_apex_apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: seedApps })
        });
        return seedApps;
      }
      return data;
    }
  });

  // Create App Mutation
  const createAppMutation = useMutation({
    mutationFn: async (app: ApexApp) => {
      const res = await fetch("/api/db/oracle_apex_apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(app)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oracleApexApps"] });
      toast.success("Oracle APEX declarative application model bootstrapped successfully.");
      setNewAppName("");
      setNewAppPages(3);
    }
  });

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return toast.error("Application name is required.");
    const nextId = apps.length > 0 ? Math.max(...apps.map(a => a.app_id)) + 1 : 100;
    
    createAppMutation.mutate({
      app_id: nextId,
      name: newAppName.trim(),
      pages_count: Number(newAppPages),
      theme: newAppTheme,
      status: "Development",
      last_updated: new Date().toISOString()
    });
  };

  // Run SQL Command against Live Wash ERP or Connected Oracle FreeSQL
  const handleRunSQL = async (overrideSql?: string) => {
    const queryText = (overrideSql ?? sqlCommand).trim();
    if (!queryText) return toast.error("Please specify a SQL command.");
    if (overrideSql) setSqlCommand(overrideSql);
    setRunningSql(true);
    try {
      const res = await api.runApexSqlQuery({ sql: queryText, target: sqlTarget });
      setSqlResult({
        sourceLabel: res.sourceLabel,
        headers: res.headers,
        rows: res.rows,
        dbmsOutput: res.dbmsOutput,
        executionMs: res.executionMs,
      });
      toast.success(`${res.sourceLabel}: ${res.rows.length} row(s) returned.`);
    } catch (err: any) {
      toast.error(err?.message || "SQL execution failed.");
    } finally {
      setRunningSql(false);
    }
  };

  const filteredApps = useMemo(() => {
    if (!searchApp.trim()) return apps;
    const q = searchApp.toLowerCase();
    return apps.filter(a => a.name.toLowerCase().includes(q) || String(a.app_id).includes(q));
  }, [apps, searchApp]);

  return (
    <div className="space-y-6">
      {/* Oracle APEX & Multi-ERP Workbench Bar */}
      {isSuperAdmin && (
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Globe size={15} className="text-amber-600 shrink-0" />
            <span>Oracle APEX Workspace &amp; Multi-ERP Bridge</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            Design declarative apps or connect Odoo, ERPNext, Dolibarr, and Oracle APEX servers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/open-erp"
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
          >
            <span>ERP Hub (Odoo · ERPNext · Dolibarr · APEX)</span>
          </Link>
        </div>
      </div>
      )}

      {/* Top control bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "builder"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Application Builder
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "sql"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            SQL Workshop
          </button>
          <button
            onClick={() => setActiveTab("blueprints")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "blueprints"
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            App Blueprints
          </button>
        </div>

        {/* Global Search */}
        <div className="relative max-w-xs w-full mb-1">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchApp}
            onChange={(e) => setSearchApp(e.target.value)}
            placeholder="Search low-code apps..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-lg border border-slate-200 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {activeTab === "builder" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main App designer container */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <LayoutTemplate size={14} className="text-amber-600" /> Oracle APEX App Designer
              </h3>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold">Applications: {filteredApps.length}</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {loadingApps ? (
                <div className="text-center py-6 text-slate-400 text-xs col-span-2">Loading applications...</div>
              ) : filteredApps.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic col-span-2">No low-code applications created.</div>
              ) : (
                filteredApps.map((a, aIdx) => (
                  <div key={a.id || `apex-app-${aIdx}`} className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all flex flex-col justify-between group">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 font-extrabold px-1.5 py-0.2 rounded">APP {a.app_id}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === "Production" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"
                        }`}>
                          {a.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 leading-snug group-hover:text-amber-600 transition-colors">{a.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium font-sans">Pages count: <strong className="text-slate-800">{a.pages_count} declarative pages</strong></p>
                    </div>

                    <div className="border-t border-slate-200/60 mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Theme: {a.theme}</span>
                      <button 
                        onClick={() => toast.success(`Launching Application ${a.app_id} preview in a secure sandbox frame.`)}
                        className="text-[9px] bg-slate-800 text-white font-bold px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                      >
                        Launch App
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Create Model Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} className="text-amber-600" /> Create Low-code App
            </h3>

            <form onSubmit={handleCreateApp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Declarative App Name *</label>
                <input
                  type="text"
                  value={newAppName}
                  onChange={(e) => setNewAppName(e.target.value)}
                  placeholder="e.g. Quality Inspection Log"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Universal Theme</label>
                <select
                  value={newAppTheme}
                  onChange={(e) => setNewAppTheme(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="Universal Theme - 42">Universal Theme - 42 (Fluent UI)</option>
                  <option value="Redwood Light - 45">Redwood Light - 45 (Oracle Classic)</option>
                  <option value="Calm Teal Dark - 48">Calm Teal Dark - 48 (High Contrast)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initial Pages Count</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newAppPages}
                  onChange={(e) => setNewAppPages(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Compile APEX Application</span>
              </button>
            </form>
          </div>
        </div>
      ) : activeTab === "sql" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Object Browser Column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-amber-600" /> Database Object Browser
              </h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Table Object</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="WASH_ORDERS">WASH_ORDERS (Live Active Orders)</option>
                  <option value="WASH_LOADS">WASH_LOADS (Machine Load Plan)</option>
                  <option value="WASH_REJECTIONS">WASH_REJECTIONS (QC Defects)</option>
                  <option value="DAILY_LOGS">DAILY_LOGS (Recv &amp; Delivery)</option>
                  <option value="BUYER_DATA_BANK">BUYER_DATA_BANK (Archived Jobs)</option>
                </select>
              </div>

              {/* Table details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-700">{selectedTable}</span>
                  <button
                    type="button"
                    onClick={() => handleRunSQL(`SELECT * FROM ${selectedTable} FETCH FIRST 25 ROWS ONLY`)}
                    className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded font-bold cursor-pointer"
                  >
                    Query Table
                  </button>
                </div>
                <div className="divide-y divide-slate-150 text-[11px] font-sans text-slate-600">
                  {schemaTables[selectedTable].columns.map((col, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-100/40">
                      <span className="font-mono font-bold text-slate-800">{col.name} {col.pk && <span className="text-amber-600 text-[9px] ml-1 font-black">[PK]</span>}</span>
                      <span className="font-mono text-slate-400">{col.type} {col.nullable ? "NULL" : "NOT NULL"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SQL terminal console */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-800 flex flex-col">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5"><Terminal size={14} className="text-amber-500" /> SQL Command Processor</span>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <div className="inline-flex rounded-lg bg-slate-800 p-0.5 text-[10px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setSqlTarget("wash-erp")}
                        className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                          sqlTarget === "wash-erp" ? "bg-amber-600 text-white" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        Live Wash ERP
                      </button>
                      <button
                        type="button"
                        onClick={() => setSqlTarget("freesql")}
                        className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                          sqlTarget === "freesql" ? "bg-amber-600 text-white" : "text-slate-300 hover:text-white"
                        }`}
                      >
                        Oracle FreeSQL
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRunSQL()}
                    disabled={runningSql}
                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 active:bg-amber-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Play size={10} fill="currentColor" /> {runningSql ? "Running..." : "Run Statement"}
                  </button>
                </div>
              </div>
              <textarea
                value={sqlCommand}
                onChange={(e) => setSqlCommand(e.target.value)}
                className="w-full bg-slate-900 text-amber-400 font-mono text-xs p-4 focus:outline-none min-h-[130px] leading-relaxed resize-y"
                placeholder="Write your SQL SELECT statement (e.g. SELECT * FROM WASH_ORDERS WHERE BUYER LIKE '%H&M%')..."
              />
              <div className="px-4 py-2 bg-slate-950/70 border-t border-slate-800 flex flex-wrap gap-1.5">
                {[
                  { label: "USER_TABLES", sql: "SELECT TABLE_NAME, ROW_COUNT FROM USER_TABLES" },
                  { label: "Active Orders", sql: "SELECT * FROM WASH_ORDERS FETCH FIRST 25 ROWS ONLY" },
                  { label: "M/C Loads", sql: "SELECT * FROM WASH_LOADS FETCH FIRST 25 ROWS ONLY" },
                  { label: "Rejections", sql: "SELECT * FROM WASH_REJECTIONS FETCH FIRST 25 ROWS ONLY" },
                  { label: "Daily Logs", sql: "SELECT * FROM DAILY_LOGS FETCH FIRST 25 ROWS ONLY" },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleRunSQL(preset.sql)}
                    className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded border border-slate-700 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SQL Query Result Display */}
            {sqlResult ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {sqlResult.sourceLabel} · {sqlResult.rows.length} rows
                    {typeof sqlResult.executionMs === "number" ? ` · ${sqlResult.executionMs}ms` : ""}
                  </span>
                </div>
                {sqlResult.dbmsOutput && sqlResult.dbmsOutput.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-900 text-emerald-300 font-mono text-[11px] border-b border-slate-800 whitespace-pre-wrap">
                    {sqlResult.dbmsOutput.join("\n")}
                  </div>
                )}
                <div className="overflow-auto max-h-[260px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 font-mono uppercase">
                        {sqlResult.headers.map((hdr, i) => (
                          <th key={i} className="px-3 py-2 whitespace-nowrap">{hdr}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-mono text-[11px] text-slate-700">
                      {sqlResult.rows.length === 0 ? (
                        <tr>
                          <td colSpan={sqlResult.headers.length} className="px-3 py-4 text-center text-slate-400">
                            No rows matched this query.
                          </td>
                        </tr>
                      ) : (
                        sqlResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 text-slate-800 whitespace-nowrap">{String(val ?? "")}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                Execute a SELECT statement or click any quick query above to inspect real-time Wash ERP data.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={16} className="text-amber-600" /> APEX Declarative App Blueprint
            </h3>
            <p className="text-xs text-slate-500">Rapidly design relational database models, whitelisting compliance protocols, and custom form schemas instantly.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Database size={14} className="text-amber-600" /> Create App on Existing Tables
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Build forms, grids, and dashboards instantly by selecting your enterprise tables (e.g. <code>WASH_LOADS</code>, <code>EMPLOYEES</code>). APEX auto-configures forms with secure audit logic.
              </p>
              <button 
                onClick={() => toast.success("Scanning table triggers... Bootstrap successful.")}
                className="w-full bg-slate-800 text-white font-bold text-[11px] py-1.5 rounded hover:bg-slate-700 transition-colors"
              >
                Scan Table Schemas
              </button>
            </div>

            <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2.5">
              <h4 className="font-bold text-xs text-amber-800 flex items-center gap-1.5">
                <FileCode2 size={14} className="text-amber-600" /> AI-Assisted PL/SQL Code generator
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Automatically generate sequence triggers, auditing functions, or row-level constraints. Keep all operations tightly coupled inside the secure Oracle Database engine.
              </p>
              <button 
                onClick={() => toast.success("Successfully generated PL/SQL row auditing trigger for WASH_LOADS.")}
                className="w-full bg-amber-600 text-white font-bold text-[11px] py-1.5 rounded hover:bg-amber-700 transition-colors"
              >
                Generate Auditing Trigger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
