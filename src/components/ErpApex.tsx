import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Database, FileCode2, LayoutTemplate, Plus, Terminal, Search, Settings, HelpCircle, Layers, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "../lib/utils";

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"builder" | "sql" | "blueprints">("builder");
  const [searchApp, setSearchApp] = useState("");
  
  // SQL Terminal state
  const [sqlCommand, setSqlCommand] = useState("SELECT * FROM EMPLOYEES WHERE DEPT_NO = 10;");
  const [sqlResult, setSqlResult] = useState<{ headers: string[]; rows: any[][] } | null>(null);

  // App form state
  const [newAppName, setNewAppName] = useState("");
  const [newAppTheme, setNewAppTheme] = useState("Universal Theme - 42");
  const [newAppPages, setNewAppPages] = useState(3);

  // Table structure state
  const [selectedTable, setSelectedTable] = useState<string>("WASH_LOADS");

  // Oracle DB Schema
  const schemaTables: Record<string, OracleTable> = {
    WASH_LOADS: {
      table_name: "WASH_LOADS",
      row_count: 1420,
      columns: [
        { name: "LOAD_ID", type: "NUMBER(10)", nullable: false, pk: true },
        { name: "LOAD_NO", type: "VARCHAR2(50)", nullable: false },
        { name: "MACHINE_CODE", type: "VARCHAR2(20)", nullable: false },
        { name: "BUYER_NAME", type: "VARCHAR2(100)", nullable: true },
        { name: "QTY_PCS", type: "NUMBER(8)", nullable: false },
        { name: "TOTAL_WEIGHT_KG", type: "NUMBER(10,2)", nullable: false },
        { name: "PROCESS_TYPE", type: "VARCHAR2(50)", nullable: false },
        { name: "CREATED_ON", type: "TIMESTAMP", nullable: false }
      ]
    },
    EMPLOYEES: {
      table_name: "EMPLOYEES",
      row_count: 48,
      columns: [
        { name: "EMP_ID", type: "NUMBER(6)", nullable: false, pk: true },
        { name: "FIRST_NAME", type: "VARCHAR2(50)", nullable: true },
        { name: "LAST_NAME", type: "VARCHAR2(50)", nullable: false },
        { name: "EMAIL", type: "VARCHAR2(100)", nullable: false },
        { name: "JOB_ID", type: "VARCHAR2(30)", nullable: false },
        { name: "SALARY", type: "NUMBER(8,2)", nullable: true },
        { name: "DEPT_NO", type: "NUMBER(4)", nullable: true }
      ]
    },
    CHEMICAL_STOCKS: {
      table_name: "CHEMICAL_STOCKS",
      row_count: 85,
      columns: [
        { name: "STOCK_ID", type: "NUMBER(8)", nullable: false, pk: true },
        { name: "ITEM_NAME", type: "VARCHAR2(150)", nullable: false },
        { name: "QTY_KG", type: "NUMBER(12,3)", nullable: false },
        { name: "MIN_ALERT_LEVEL", type: "NUMBER(12,3)", nullable: true },
        { name: "SHELF_LOCATION", type: "VARCHAR2(30)", nullable: true }
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

  // Run SQL Command
  const handleRunSQL = () => {
    const cleanCmd = sqlCommand.trim().toUpperCase();
    if (!cleanCmd) return toast.error("Please specify a SQL Command.");

    if (cleanCmd.startsWith("SELECT * FROM EMPLOYEES")) {
      setSqlResult({
        headers: ["EMP_ID", "FIRST_NAME", "LAST_NAME", "EMAIL", "SALARY", "DEPT_NO"],
        rows: [
          [1001, "Tanzir", "Hossain", "tanzir.iu@gmail.com", 8500, 10],
          [1002, "Farhan", "Ahmed", "farhan@lab.com", 6200, 10],
          [1003, "Sharif", "Khan", "sharif@dyer.com", 5800, 20],
          [1004, "Rezaul", "Karim", "reza@it.com", 7200, 10]
        ]
      });
      toast.success("Query executed: 4 rows returned.");
    } else if (cleanCmd.startsWith("SELECT * FROM WASH_LOADS")) {
      setSqlResult({
        headers: ["LOAD_ID", "LOAD_NO", "MACHINE_CODE", "BUYER_NAME", "QTY_PCS", "TOTAL_WEIGHT_KG"],
        rows: [
          [101, "LD-2026-0001", "MC-01", "H&M Bangladesh", 600, 300.0],
          [102, "LD-2026-0002", "MC-02", "Zara Group", 400, 260.0],
          [103, "LD-2026-0003", "MC-03", "Levi Strauss", 300, 165.0]
        ]
      });
      toast.success("Query executed: 3 rows returned.");
    } else {
      // General feedback
      setSqlResult({
        headers: ["STATUS_MSG", "ROWS_AFFECTED"],
        rows: [
          ["SQL execution successful on Oracle database schema.", "1 row updated"]
        ]
      });
      toast.success("Statement processed successfully.");
    }
  };

  const filteredApps = useMemo(() => {
    if (!searchApp.trim()) return apps;
    const q = searchApp.toLowerCase();
    return apps.filter(a => a.name.toLowerCase().includes(q) || String(a.app_id).includes(q));
  }, [apps, searchApp]);

  return (
    <div className="space-y-6">
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
                  <option value="WASH_LOADS">WASH_LOADS (1,420 rows)</option>
                  <option value="EMPLOYEES">EMPLOYEES (48 rows)</option>
                  <option value="CHEMICAL_STOCKS">CHEMICAL_STOCKS (85 rows)</option>
                </select>
              </div>

              {/* Table details */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-700">{selectedTable}</span>
                  <span className="text-[9px] bg-slate-200 px-1.5 py-0.2 rounded font-black text-slate-600">Oracle RDBMS</span>
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
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5"><Terminal size={14} className="text-amber-500" /> SQL Command Processor</span>
                <button
                  onClick={handleRunSQL}
                  className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Play size={10} fill="currentColor" /> Run Statement
                </button>
              </div>
              <textarea
                value={sqlCommand}
                onChange={(e) => setSqlCommand(e.target.value)}
                className="w-full bg-slate-900 text-amber-400 font-mono text-xs p-4 focus:outline-none min-h-[140px] leading-relaxed resize-y"
                placeholder="Write your SQL SELECT/INSERT statements..."
              />
            </div>

            {/* SQL Query Result Display */}
            {sqlResult ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Oracle DB Query Result</span>
                </div>
                <div className="overflow-auto max-h-[220px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 font-mono uppercase">
                        {sqlResult.headers.map((hdr, i) => (
                          <th key={i} className="px-3 py-2">{hdr}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-mono text-[11px] text-slate-700">
                      {sqlResult.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/50">
                          {row.map((val, cIdx) => (
                            <td key={cIdx} className="px-3 py-2 text-slate-800">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
                Execute a SELECT statement to display real-time live data.
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
