import React, { useState, useEffect } from "react";
import {
  Globe,
  ExternalLink,
  RefreshCw,
  Server,
  Play,
  Download,
  Copy,
  Check,
  Database,
  Upload,
  ArrowUpRight,
  Layers,
  Terminal,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  BookOpen,
  Lock
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

type HubTab = "apex" | "freesql" | "hands-on" | "odoo" | "erpnext" | "dolibarr" | "docker";

const ERP_COMPARISON = [
  {
    name: "Odoo Community (v18)",
    license: "LGPL-3 (Free CE)",
    protocol: "JSON-RPC 2.0 (/jsonrpc)",
    rmgModules: "MRP, BOM, Quality, Maintenance, Purchase, HR",
    buyerModel: "res.partner",
    orderModel: "mrp.production",
    ram: "2 GB RAM",
  },
  {
    name: "ERPNext / Frappe (v15)",
    license: "GPL-3.0 (100% Free)",
    protocol: "REST API (/api/resource/*)",
    rmgModules: "Manufacturing, Work Order, Job Card, Stock, Payroll",
    buyerModel: "Customer",
    orderModel: "Work Order",
    ram: "4 GB RAM",
  },
  {
    name: "Dolibarr ERP & CRM (v20)",
    license: "GPL-3.0 (Lightweight)",
    protocol: "REST API (/api/index.php/*)",
    rmgModules: "Thirdparties, Products, BOM/MRP, Supplier Orders",
    buyerModel: "thirdparties",
    orderModel: "mos / orders",
    ram: "512 MB RAM",
  },
  {
    name: "Oracle APEX (24.1)",
    license: "Oracle APEX / ORDS",
    protocol: "APEX Portal + ORDS REST",
    rmgModules: "Garments Order Management, Merchandising & Wash Portal",
    buyerModel: "APEX App",
    orderModel: "ORDS / CSV Export",
    ram: "Server Hosted",
  },
];

export default function OpenSourceErpHub() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<HubTab>("apex");
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Oracle APEX State
  const [apexUrl, setApexUrl] = useState("");
  const [apexOrdsUrl, setApexOrdsUrl] = useState("");
  const [apexOrdsAuth, setApexOrdsAuth] = useState("");
  const [apexProbe, setApexProbe] = useState<any>(null);
  const [probingApex, setProbingApex] = useState(false);
  const [fetchingOrds, setFetchingOrds] = useState(false);
  const [ordsRows, setOrdsRows] = useState<Record<string, any>[]>([]);
  const [importingApexRows, setImportingApexRows] = useState(false);

  // Oracle FreeSQL State
  const [freeSqlForm, setFreeSqlForm] = useState({
    user: "",
    password: "",
    connectString: "",
    walletPassword: "",
  });
  const [freeSqlMeta, setFreeSqlMeta] = useState<any>(null);
  const [busyFreeSql, setBusyFreeSql] = useState(false);
  const [freeSqlEditor, setFreeSqlEditor] = useState(
    `SELECT BUYER,\n       COUNT(*) AS ORDERS,\n       SUM(ORDER_QTY) AS TOTAL_PCS\n  FROM WASH_ERP_ORDERS\n GROUP BY BUYER\n ORDER BY TOTAL_PCS DESC`
  );
  const [freeSqlResult, setFreeSqlResult] = useState<{
    columns: string[];
    rows: Record<string, any>[];
    rowsAffected: number;
    dbmsOutput: string[];
    executionMs: number;
    statementKind: string;
  } | null>(null);
  const [quickSqlInput, setQuickSqlInput] = useState(
    `wash_lot_qc\n  lot_no vc50 nn\n  buyer vc100 nn\n  process_type vc80\n  pcs_checked num\n  reject_pcs num\n  qc_date d\n  remarks clob`
  );
  const [quickSqlDdl, setQuickSqlDdl] = useState("");
  const [busyQuickSql, setBusyQuickSql] = useState(false);

  // Hands-On Practice Lab State
  const [labPlatform, setLabPlatform] = useState<"odoo" | "erpnext" | "dolibarr">("odoo");
  const [labAction, setLabAction] = useState<"create_buyer" | "create_work_order" | "create_chemical_po">(
    "create_work_order"
  );
  const [labForm, setLabForm] = useState({
    buyerName: "H&M Bangladesh",
    fileNo: "111-9045",
    styleNo: "8763",
    qty: 1500,
    washType: "Enzyme Stone Wash",
    chemicalName: "Neutral Cellulase Enzyme",
    chemicalKg: 28,
  });
  const [runningLab, setRunningLab] = useState(false);
  const [lastLabResult, setLastLabResult] = useState<any>(null);
  const [labRuns, setLabRuns] = useState<any[]>([]);

  // Odoo State
  const [odooForm, setOdooForm] = useState({
    url: "http://localhost:8069",
    db: "rmg_wash_erp",
    username: "admin",
    password: "",
  });
  const [odooMeta, setOdooMeta] = useState<any>(null);
  const [odooPullModel, setOdooPullModel] = useState("res.partner");
  const [busyOdoo, setBusyOdoo] = useState(false);

  // ERPNext State
  const [erpNextForm, setErpNextForm] = useState({
    url: "http://localhost:8080",
    apiKey: "",
    apiSecret: "",
    company: "INCTL Wash Unit",
  });
  const [erpNextMeta, setErpNextMeta] = useState<any>(null);
  const [erpNextDoctype, setErpNextDoctype] = useState("Customer");
  const [busyErpNext, setBusyErpNext] = useState(false);

  // Dolibarr State
  const [dolibarrForm, setDolibarrForm] = useState({
    url: "http://localhost:8090",
    apiKey: "",
  });
  const [dolibarrMeta, setDolibarrMeta] = useState<any>(null);
  const [dolibarrResource, setDolibarrResource] = useState("thirdparties");
  const [busyDolibarr, setBusyDolibarr] = useState(false);

  // Pulled records preview
  const [pulledPreview, setPulledPreview] = useState<{ source: string; records: Record<string, any>[] } | null>(
    null
  );

  const loadConfigs = async () => {
    setLoadingConfig(true);
    try {
      const cfg = await api.getOpenErpConfigs();
      if (cfg?.apex) {
        setApexUrl(cfg.apex.url || "");
        setApexOrdsUrl(cfg.apex.ordsUrl || "");
        setApexProbe(cfg.apex.lastProbe || null);
      }
      if (cfg?.freesql) {
        setFreeSqlForm((prev) => ({
          ...prev,
          user: cfg.freesql.user || prev.user,
          connectString: cfg.freesql.connectString || prev.connectString,
        }));
        setFreeSqlMeta(cfg.freesql);
      }
      if (cfg?.odoo) {
        setOdooForm((prev) => ({
          ...prev,
          url: cfg.odoo.url || prev.url,
          db: cfg.odoo.db || prev.db,
          username: cfg.odoo.username || prev.username,
        }));
        setOdooMeta(cfg.odoo);
      }
      if (cfg?.erpnext) {
        setErpNextForm((prev) => ({
          ...prev,
          url: cfg.erpnext.url || prev.url,
          company: cfg.erpnext.company || prev.company,
        }));
        setErpNextMeta(cfg.erpnext);
      }
      if (cfg?.dolibarr) {
        setDolibarrForm((prev) => ({
          ...prev,
          url: cfg.dolibarr.url || prev.url,
        }));
        setDolibarrMeta(cfg.dolibarr);
      }
      if (Array.isArray(cfg?.labRuns)) {
        setLabRuns(cfg.labRuns);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to load ERP Hub settings");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadConfigs();
    } else {
      setLoadingConfig(false);
    }
  }, [isSuperAdmin]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Oracle APEX Handlers
  const handleProbeApex = async () => {
    if (!apexUrl.trim()) return toast.error("Enter your Oracle APEX URL first");
    setProbingApex(true);
    try {
      const result = await api.probeOracleApex({ url: apexUrl.trim(), ordsUrl: apexOrdsUrl.trim() });
      setApexProbe(result);
      if (result.reachable) {
        toast.success(
          `Oracle APEX reachable (${result.statusCode}) in ${result.latencyMs}ms — ${result.title || "Oracle APEX"}`
        );
      } else {
        toast.error(result.error || "Oracle APEX server did not respond");
      }
    } catch (err: any) {
      toast.error(err?.message || "Probe failed");
    } finally {
      setProbingApex(false);
    }
  };

  const handleFetchOrds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apexOrdsUrl.trim()) return toast.error("Enter an Oracle ORDS REST JSON URL");
    setFetchingOrds(true);
    try {
      const res = await api.fetchApexOrds({
        ordsUrl: apexOrdsUrl.trim(),
        authHeader: apexOrdsAuth.trim() || undefined,
      });
      setOrdsRows(res.items || []);
      toast.success(`Fetched ${res.count} rows from Oracle ORDS REST API`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch ORDS endpoint");
    } finally {
      setFetchingOrds(false);
    }
  };

  const handleApexFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
        if (rows.length === 0) {
          toast.error("No data rows found in uploaded file");
          return;
        }
        setOrdsRows(rows.slice(0, 200));
        toast.success(`Loaded ${rows.length} rows from ${file.name}. Review and click Import.`);
      } catch {
        toast.error("Could not parse Excel/CSV file");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImportApexRows = async () => {
    if (ordsRows.length === 0) return;
    setImportingApexRows(true);
    try {
      const res = await api.importApexRows(ordsRows);
      toast.success(res.message || `Imported ${res.importedCount} orders`);
      setOrdsRows([]);
    } catch (err: any) {
      toast.error(err?.message || "Import failed");
    } finally {
      setImportingApexRows(false);
    }
  };

  // Hands-On Lab Execution
  const handleRunSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunningLab(true);
    try {
      const res = await api.executeOpenErpSandbox({
        platform: labPlatform,
        action: labAction,
        ...labForm,
      });
      setLastLabResult(res);
      if (res.run) {
        setLabRuns((prev) => [res.run, ...prev].slice(0, 25));
      }
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message || "Sandbox execution failed");
    } finally {
      setRunningLab(false);
    }
  };

  // Odoo Handlers
  const handleConnectOdoo = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyOdoo(true);
    try {
      const res = await api.connectOdooRpc(odooForm);
      toast.success(res.message || "Connected to Odoo");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "Odoo connection failed");
    } finally {
      setBusyOdoo(false);
    }
  };

  const handlePushOdoo = async () => {
    setBusyOdoo(true);
    try {
      const res = await api.pushOdooBuyers();
      toast.success(res.message || "Buyers pushed to Odoo");
    } catch (err: any) {
      toast.error(err?.message || "Odoo push failed");
    } finally {
      setBusyOdoo(false);
    }
  };

  const handlePullOdoo = async () => {
    setBusyOdoo(true);
    try {
      const res = await api.pullOdooModel(odooPullModel);
      toast.success(res.message);
      setPulledPreview({ source: `Odoo · ${odooPullModel}`, records: res.records || [] });
    } catch (err: any) {
      toast.error(err?.message || "Odoo pull failed");
    } finally {
      setBusyOdoo(false);
    }
  };

  // ERPNext Handlers
  const handleConnectErpNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyErpNext(true);
    try {
      const res = await api.connectErpNext(erpNextForm);
      toast.success(res.message || "Connected to ERPNext");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "ERPNext connection failed");
    } finally {
      setBusyErpNext(false);
    }
  };

  const handlePushErpNext = async () => {
    setBusyErpNext(true);
    try {
      const res = await api.pushErpNextBuyers();
      toast.success(res.message || "Buyers pushed to ERPNext");
    } catch (err: any) {
      toast.error(err?.message || "ERPNext push failed");
    } finally {
      setBusyErpNext(false);
    }
  };

  const handlePullErpNext = async () => {
    setBusyErpNext(true);
    try {
      const res = await api.pullErpNextDoctype(erpNextDoctype);
      toast.success(res.message);
      setPulledPreview({ source: `ERPNext · ${erpNextDoctype}`, records: res.records || [] });
    } catch (err: any) {
      toast.error(err?.message || "ERPNext pull failed");
    } finally {
      setBusyErpNext(false);
    }
  };

  // Dolibarr Handlers
  const handleConnectDolibarr = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyDolibarr(true);
    try {
      const res = await api.connectDolibarr(dolibarrForm);
      toast.success(res.message || "Connected to Dolibarr");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "Dolibarr connection failed");
    } finally {
      setBusyDolibarr(false);
    }
  };

  const handlePushDolibarr = async () => {
    setBusyDolibarr(true);
    try {
      const res = await api.pushDolibarrBuyers();
      toast.success(res.message || "Buyers pushed to Dolibarr");
    } catch (err: any) {
      toast.error(err?.message || "Dolibarr push failed");
    } finally {
      setBusyDolibarr(false);
    }
  };

  const handlePullDolibarr = async () => {
    setBusyDolibarr(true);
    try {
      const res = await api.pullDolibarrResource(dolibarrResource);
      toast.success(res.message);
      setPulledPreview({ source: `Dolibarr · ${dolibarrResource}`, records: res.records || [] });
    } catch (err: any) {
      toast.error(err?.message || "Dolibarr pull failed");
    } finally {
      setBusyDolibarr(false);
    }
  };

  // Oracle FreeSQL Handlers
  const handleConnectFreeSql = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeSqlForm.user.trim() || !freeSqlForm.connectString.trim()) {
      return toast.error("Enter your Oracle FreeSQL Schema User and SQL*Net Connect String.");
    }
    if (!freeSqlForm.password && !freeSqlMeta?.hasPassword) {
      return toast.error("Enter your Oracle FreeSQL Schema Password.");
    }
    setBusyFreeSql(true);
    try {
      const res = await api.connectOracleFreeSql({
        user: freeSqlForm.user.trim(),
        ...(freeSqlForm.password ? { password: freeSqlForm.password } : {}),
        connectString: freeSqlForm.connectString.trim(),
        ...(freeSqlForm.walletPassword ? { walletPassword: freeSqlForm.walletPassword } : {}),
      });
      toast.success(res.message || "Connected to Oracle FreeSQL");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "Oracle FreeSQL connection failed");
    } finally {
      setBusyFreeSql(false);
    }
  };

  const handleRunFreeSql = async (overrideSql?: string) => {
    const sqlText = (overrideSql ?? freeSqlEditor).trim();
    if (!sqlText) return toast.error("Enter SQL or PL/SQL to execute.");
    if (overrideSql) setFreeSqlEditor(overrideSql);
    setBusyFreeSql(true);
    try {
      const res = await api.executeOracleFreeSql({ sql: sqlText, maxRows: 200 });
      setFreeSqlResult(res);
      toast.success(
        `${res.statementKind} completed in ${res.executionMs}ms (${res.rows?.length || 0} rows returned)`
      );
    } catch (err: any) {
      toast.error(err?.message || "Oracle FreeSQL query failed");
    } finally {
      setBusyFreeSql(false);
    }
  };

  const handleProvisionFreeSql = async () => {
    setBusyFreeSql(true);
    try {
      const res = await api.provisionOracleWashSchema();
      toast.success(res.message || "Wash ERP schema provisioned in Oracle FreeSQL.");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to provision tables");
    } finally {
      setBusyFreeSql(false);
    }
  };

  const handleSyncFreeSql = async () => {
    setBusyFreeSql(true);
    try {
      const res = await api.syncOracleFreeSql();
      toast.success(res.message || "Wash ERP mirrored to Oracle FreeSQL.");
      loadConfigs();
    } catch (err: any) {
      toast.error(err?.message || "FreeSQL mirror sync failed");
    } finally {
      setBusyFreeSql(false);
    }
  };

  const handleConvertQuickSql = async (runAfter = false) => {
    setBusyQuickSql(true);
    try {
      const res = await api.convertQuickSql(quickSqlInput);
      setQuickSqlDdl(res.ddl);
      toast.success("Converted QuickSQL shorthand to Oracle 23ai/26ai DDL");
      if (runAfter && res.ddl && !res.ddl.startsWith("--")) {
        setFreeSqlEditor(res.ddl);
      }
    } catch (err: any) {
      toast.error(err?.message || "QuickSQL conversion failed");
    } finally {
      setBusyQuickSql(false);
    }
  };

  const handleExportFreeSqlExcel = () => {
    if (!freeSqlResult?.rows?.length) return toast.error("No result rows to export.");
    const ws = XLSX.utils.json_to_sheet(freeSqlResult.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FreeSQL_Result");
    XLSX.writeFile(wb, `Oracle_FreeSQL_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exported Oracle FreeSQL result set to Excel.");
  };

  const navTabs: { id: HubTab; label: string; sub: string }[] = [
    { id: "apex", label: "Oracle APEX", sub: "APEX & ORDS Bridge" },
    { id: "freesql", label: "Oracle FreeSQL", sub: "SQL*Net · PL/SQL · QuickSQL" },
    { id: "hands-on", label: "Hands-On ERP Lab", sub: "Odoo · ERPNext · Dolibarr" },
    { id: "odoo", label: "Odoo Connector", sub: "JSON-RPC 2.0" },
    { id: "erpnext", label: "ERPNext Connector", sub: "Frappe REST" },
    { id: "dolibarr", label: "Dolibarr Connector", sub: "DOLAPIKEY REST" },
    { id: "docker", label: "Self-Host Docker", sub: "Local Practice Stacks" },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock size={36} />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider rounded-full border border-rose-300">
              Restricted Access
            </span>
            <h2 className="text-2xl font-black text-slate-900">Super User Only</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>ERP HUB</strong> (Odoo, ERPNext, Dolibarr &amp; Oracle APEX Bridge) is strictly reserved for the <strong>Super User (super_admin)</strong> account.
            </p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500 font-medium">
              <span>Current User:</span>
              <span className="font-mono font-bold text-slate-800 uppercase">{currentUser?.username || "Guest"}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-medium">
              <span>Current Role:</span>
              <span className="font-bold text-rose-600 uppercase">{currentUser?.role || "viewer"}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500 font-medium border-t border-slate-200 pt-2">
              <span>Authorized Role:</span>
              <span className="font-mono font-bold text-emerald-600">super_admin</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            ERP Integration &amp; Hands-On Workbench
          </p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
            ERP Hub &amp; Oracle APEX Bridge
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Connect live Odoo, ERPNext, Dolibarr, and your Oracle APEX server, or practice real multi-ERP API workflows directly against your factory database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {apexUrl.trim() && (
            <a
              href={apexUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <Globe size={14} />
              <span>Open Oracle APEX</span>
              <ExternalLink size={13} />
            </a>
          )}
          <button
            type="button"
            onClick={loadConfigs}
            disabled={loadingConfig}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={loadingConfig ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Interactive Segmented Tab Bar */}
      <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1">
        {navTabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer",
                active
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              )}
            >
              <div className="text-xs font-bold truncate">{t.label}</div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{t.sub}</div>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ORACLE APEX BRIDGE */}
      {activeTab === "apex" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Live Endpoint Configuration & Server Probe */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Oracle APEX Live Server Bridge
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Server-side probe checks live availability, APEX runtime version, App/Page ID, and iframe security headers without browser CORS restrictions.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Oracle APEX Portal URL
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={apexUrl}
                    onChange={(e) => setApexUrl(e.target.value)}
                    placeholder="http://your-apex-server:8080/apex/..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleProbeApex}
                    disabled={probingApex}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} className={probingApex ? "animate-spin" : ""} />
                    <span>{probingApex ? "Probing..." : "Test Live Connection"}</span>
                  </button>
                </div>
              </div>

              {/* Probe Result Readout */}
              {apexProbe ? (
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {apexProbe.reachable ? (
                        <CheckCircle2 size={15} className="text-emerald-600" />
                      ) : (
                        <XCircle size={15} className="text-rose-600" />
                      )}
                      <span>
                        {apexProbe.reachable
                          ? `Reachable · HTTP ${apexProbe.statusCode} ${apexProbe.statusText}`
                          : `Unreachable · ${apexProbe.error || "Connection Error"}`}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {apexProbe.latencyMs} ms · Checked {new Date(apexProbe.checkedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-3 text-xs">
                    <div>
                      <div className="text-slate-500">Page Title</div>
                      <div className="font-semibold text-slate-900 mt-0.5 truncate">
                        {apexProbe.title || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">APEX Runtime</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">
                        {apexProbe.apexVersion ? `v${apexProbe.apexVersion}` : "Oracle APEX"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">App / Page</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">
                        {apexProbe.appId ? `App ${apexProbe.appId} · Page ${apexProbe.pageId || "1"}` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Workspace</div>
                      <div className="font-mono font-semibold text-slate-900 mt-0.5">
                        {apexProbe.workspace || "—"}
                      </div>
                    </div>
                  </div>

                  {apexProbe.iframeBlocked && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                      <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold">
                          Direct iframe embedding blocked by Oracle APEX ({apexProbe.xFrameOptions || "X-Frame-Options: DENY"})
                        </p>
                        <p className="text-amber-800 leading-relaxed">
                          Your Oracle APEX server enforces <code className="font-mono">X-Frame-Options: DENY</code> for login security. Launch the portal directly in a dedicated browser tab, or pull order tables via ORDS REST / CSV export on the right.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                  Enter your Oracle APEX URL above and click <strong>Test Live Connection</strong> to verify HTTP reachability, latency, and APEX runtime metadata.
                </div>
              )}

              {apexUrl.trim() && (
                <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-3">
                  <a
                    href={apexUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <span>Launch Login</span>
                    <ArrowUpRight size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(apexUrl.trim(), "apexUrl")}
                    className="inline-flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer"
                  >
                    {copiedKey === "apexUrl" ? <Check size={13} /> : <Copy size={13} />}
                    <span>Copy Portal URL</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right: ORDS REST Pull & Oracle APEX CSV/Excel Importer */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Sync Data into Wash ERP
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Pull live JSON from an Oracle APEX ORDS REST endpoint or upload an exported Excel/CSV report to create active Wash ERP orders.
                </p>
              </div>

              <form onSubmit={handleFetchOrds} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Oracle ORDS REST Endpoint (Optional)
                  </label>
                  <input
                    type="text"
                    value={apexOrdsUrl}
                    onChange={(e) => setApexOrdsUrl(e.target.value)}
                    placeholder="https://your-apex-server/ords/workspace/wash/orders"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorization Header (Optional)
                  </label>
                  <input
                    type="password"
                    value={apexOrdsAuth}
                    onChange={(e) => setApexOrdsAuth(e.target.value)}
                    placeholder="Bearer <token> or Basic <base64>"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={fetchingOrds}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  {fetchingOrds ? "Fetching ORDS JSON..." : "Fetch ORDS REST Data"}
                </button>
              </form>

              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Or Import Exported Excel / CSV
                </label>
                <p className="text-[11px] text-slate-500">
                  Supports columns: <code className="font-mono text-slate-700">FILE_NO / ERP_NO</code>, <code className="font-mono text-slate-700">BUYER</code>, <code className="font-mono text-slate-700">STYLE_NO</code>, <code className="font-mono text-slate-700">COLOR</code>, <code className="font-mono text-slate-700">ORDER_QTY</code>, <code className="font-mono text-slate-700">WASH_TYPE</code>.
                </p>
                <label className="w-full flex items-center justify-center gap-2 border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/40 rounded-lg py-3 px-4 text-xs font-semibold text-slate-700 cursor-pointer transition-colors">
                  <Upload size={14} className="text-blue-600" />
                  <span>Select .xlsx or .csv Export</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleApexFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Preview & Confirm Import Table */}
          {ordsRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Staged Records ({ordsRows.length} rows)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review before importing into active Wash ERP orders.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOrdsRows([])}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleImportApexRows}
                    disabled={importingApexRows}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg cursor-pointer"
                  >
                    {importingApexRows ? "Importing..." : `Import ${ordsRows.length} Orders into Wash ERP`}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      {Object.keys(ordsRows[0]).slice(0, 8).map((k) => (
                        <th key={k} className="px-3.5 py-2.5 font-mono whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {ordsRows.slice(0, 15).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {Object.keys(ordsRows[0]).slice(0, 8).map((k) => (
                          <td key={k} className="px-3.5 py-2 whitespace-nowrap text-slate-700">
                            {String(row[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ORACLE FREESQL & ORACLE DATABASE FREE BRIDGE */}
      {activeTab === "freesql" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Direct Thin-Mode SQL*Net Connection */}
            <form
              onSubmit={handleConnectFreeSql}
              className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Oracle AI Database Free &amp; FreeSQL (Thin Mode)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Connect to your <strong>freesql.com</strong> cloud schema or self-hosted <strong>Oracle AI Database 26ai Free</strong> container (up to 2 CPUs · 2 GB RAM · 12 GB storage).
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                  {freeSqlMeta?.configured
                    ? `Ready · ${freeSqlMeta.lastCheck?.schemaUser || freeSqlForm.user}`
                    : "Not Connected"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFreeSqlForm((prev) => ({
                      ...prev,
                      user: "SYSTEM",
                      connectString: "localhost:1521/FREEPDB1",
                    }));
                    toast.success("Loaded Local Oracle Free Docker preset (localhost:1521/FREEPDB1).");
                  }}
                  className="text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  Preset: Local Docker Free (localhost:1521/FREEPDB1)
                </button>
                <a
                  href="https://www.oracle.com/database/free/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg"
                >
                  <span>Oracle DB Free (2 CPU / 2GB / 12GB)</span>
                  <ExternalLink size={11} />
                </a>
                <a
                  href="https://container-registry.oracle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg"
                >
                  <span>Container Registry</span>
                  <ExternalLink size={11} />
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Oracle Schema User *
                  </label>
                  <input
                    type="text"
                    required
                    value={freeSqlForm.user}
                    onChange={(e) => setFreeSqlForm({ ...freeSqlForm, user: e.target.value })}
                    placeholder="WKSP_WASH_SANDBOX or SYSTEM"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Schema Password {freeSqlMeta?.hasPassword ? "(saved — leave blank to keep)" : "*"}
                  </label>
                  <input
                    type="password"
                    value={freeSqlForm.password}
                    onChange={(e) => setFreeSqlForm({ ...freeSqlForm, password: e.target.value })}
                    placeholder={freeSqlMeta?.hasPassword ? "•••••••• (saved)" : "Enter schema password"}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SQL*Net Connect String / Easy Connect / TNS Descriptor *
                  </label>
                  <input
                    type="text"
                    required
                    value={freeSqlForm.connectString}
                    onChange={(e) => setFreeSqlForm({ ...freeSqlForm, connectString: e.target.value })}
                    placeholder="(description=(retry_count=20)(address=(protocol=tcps)(port=1522)(host=adb.us-ashburn-1.oraclecloud.com))...) or localhost:1521/FREEPDB1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wallet Password (Optional — only for mTLS wallets)
                  </label>
                  <input
                    type="password"
                    value={freeSqlForm.walletPassword}
                    onChange={(e) => setFreeSqlForm({ ...freeSqlForm, walletPassword: e.target.value })}
                    placeholder="Optional wallet passphrase"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={busyFreeSql}
                  className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
                >
                  <RefreshCw size={13} className={busyFreeSql ? "animate-spin" : ""} />
                  <span>{busyFreeSql ? "Connecting..." : "Test & Save FreeSQL Connection"}</span>
                </button>
                <a
                  href="https://freesql.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-lg"
                >
                  <span>Open FreeSQL.com</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {freeSqlMeta?.lastCheck && (
                <div className="border-t border-slate-200 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-slate-500">Schema User</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5 truncate">
                      {freeSqlMeta.lastCheck.schemaUser}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Latency</div>
                    <div className="font-mono font-bold text-emerald-700 mt-0.5">
                      {freeSqlMeta.lastCheck.latencyMs} ms
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tables in Schema</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {freeSqlMeta.lastCheck.tableCount} tables
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Oracle Engine</div>
                    <div className="font-semibold text-slate-900 mt-0.5 truncate" title={freeSqlMeta.lastCheck.databaseVersion}>
                      {freeSqlMeta.lastCheck.databaseVersion}
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Right: 1-Click Wash ERP Oracle Schema & Mirror Sync */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <h2 className="text-base font-bold text-slate-900">
                  1-Click Wash ERP → Oracle FreeSQL Sync
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Provision enterprise Oracle relational tables (<code className="font-mono">WASH_ERP_ORDERS</code>, <code className="font-mono">WASH_ERP_REJECTIONS</code>, <code className="font-mono">WASH_ERP_LOADS</code>) and upsert live factory data using atomic <code className="font-mono">MERGE INTO</code> batches.
                </p>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleProvisionFreeSql}
                    disabled={busyFreeSql || !freeSqlMeta?.configured}
                    className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
                  >
                    <Layers size={14} />
                    <span>1. Provision Wash ERP Oracle Schema</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncFreeSql}
                    disabled={busyFreeSql || !freeSqlMeta?.configured}
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
                  >
                    <Database size={14} />
                    <span>2. Mirror Live Orders, Loads &amp; Rejections</span>
                  </button>
                </div>
              </div>

              {freeSqlMeta?.lastSync && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                  <div className="font-semibold text-slate-900">Last Oracle FreeSQL Mirror</div>
                  <div className="text-slate-600 font-mono">
                    Orders: {freeSqlMeta.lastSync.ordersSynced} · Rejections: {freeSqlMeta.lastSync.rejectionsSynced} · Loads: {freeSqlMeta.lastSync.loadsSynced}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Synced {new Date(freeSqlMeta.lastSync.syncedAt).toLocaleString()} ({freeSqlMeta.lastSync.latencyMs}ms)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live SQL / PL-SQL Worksheet & QuickSQL Converter */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Oracle SQL / PL-SQL Worksheet */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-950 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <Terminal size={14} className="text-amber-400" />
                  <span>Oracle FreeSQL &amp; PL/SQL Live Worksheet</span>
                </div>
                <div className="flex items-center gap-2">
                  {freeSqlResult?.rows && freeSqlResult.rows.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportFreeSqlExcel}
                      className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      <Download size={12} />
                      <span>Export Excel</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRunFreeSql()}
                    disabled={busyFreeSql || !freeSqlMeta?.configured}
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{busyFreeSql ? "Running..." : "Execute SQL / PL/SQL"}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={freeSqlEditor}
                onChange={(e) => setFreeSqlEditor(e.target.value)}
                rows={7}
                className="w-full bg-slate-900 text-amber-300 font-mono text-xs p-4 focus:outline-none resize-y"
                placeholder="Write Oracle SQL or anonymous PL/SQL blocks (SELECT, CREATE TABLE, MERGE, BEGIN ... END;)..."
              />

              {/* RMG Wash Presets */}
              <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800 flex flex-wrap gap-1.5">
                {[
                  {
                    label: "USER_TABLES",
                    sql: `SELECT TABLE_NAME, NUM_ROWS FROM USER_TABLES ORDER BY TABLE_NAME`,
                  },
                  {
                    label: "Buyer Order Totals",
                    sql: `SELECT BUYER, COUNT(*) AS ORDERS, SUM(ORDER_QTY) AS TOTAL_PCS\n  FROM WASH_ERP_ORDERS\n GROUP BY BUYER\n ORDER BY TOTAL_PCS DESC`,
                  },
                  {
                    label: "Buyer Rejection %",
                    sql: `SELECT o.BUYER,\n       SUM(o.ORDER_QTY) AS ORDER_QTY,\n       NVL(SUM(r.TTL_QTY), 0) AS REJECT_PCS,\n       ROUND(NVL(SUM(r.TTL_QTY), 0) * 100 / NULLIF(SUM(o.ORDER_QTY), 0), 2) AS REJ_PCT\n  FROM WASH_ERP_ORDERS o\n  LEFT JOIN WASH_ERP_REJECTIONS r ON UPPER(o.BUYER) = UPPER(r.BUYER)\n GROUP BY o.BUYER\n ORDER BY REJ_PCT DESC`,
                  },
                  {
                    label: "M/C Weight Kg",
                    sql: `SELECT MC_NUMBER, COUNT(*) AS LOADS, SUM(PCS_QTY) AS TOTAL_PCS, SUM(TOTAL_WEIGHT_KG) AS TOTAL_KG\n  FROM WASH_ERP_LOADS\n GROUP BY MC_NUMBER\n ORDER BY TOTAL_KG DESC`,
                  },
                  {
                    label: "12 GB Storage Quota",
                    sql: `SELECT NVL(ROUND(SUM(BYTES) / 1024 / 1024, 2), 0) AS USED_MB,\n       12288 AS FREE_LIMIT_MB,\n       ROUND(NVL(SUM(BYTES) / 1024 / 1024, 0) * 100 / 12288, 2) AS PCT_USED\n  FROM USER_SEGMENTS`,
                  },
                  {
                    label: "PL/SQL Audit Block",
                    sql: `DECLARE\n  v_count NUMBER := 0;\nBEGIN\n  FOR rec IN (\n    SELECT BUYER, SUM(TTL_QTY) AS REJ_QTY\n      FROM WASH_ERP_REJECTIONS\n     GROUP BY BUYER\n  ) LOOP\n    DBMS_OUTPUT.PUT_LINE('Buyer ' || rec.BUYER || ' -> Rejected Pcs: ' || rec.REJ_QTY);\n    v_count := v_count + 1;\n  END LOOP;\n  DBMS_OUTPUT.PUT_LINE('Audited buyers: ' || v_count);\nEND;`,
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setFreeSqlEditor(preset.sql)}
                    className="text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded border border-slate-700 cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Execution Result */}
              {freeSqlResult && (
                <div className="border-t border-slate-200 bg-white">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">
                      {freeSqlResult.statementKind} · {freeSqlResult.rows.length} rows · Affected: {freeSqlResult.rowsAffected}
                    </span>
                    <span className="font-mono">{freeSqlResult.executionMs} ms</span>
                  </div>

                  {freeSqlResult.dbmsOutput.length > 0 && (
                    <div className="px-4 py-2.5 bg-slate-900 text-emerald-300 font-mono text-[11px] border-b border-slate-800 whitespace-pre-wrap">
                      {freeSqlResult.dbmsOutput.join("\n")}
                    </div>
                  )}

                  {freeSqlResult.columns.length > 0 && (
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 font-mono">
                          <tr>
                            {freeSqlResult.columns.map((c) => (
                              <th key={c} className="px-3.5 py-2 whitespace-nowrap">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                          {freeSqlResult.rows.map((r, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50">
                              {freeSqlResult.columns.map((c) => (
                                <td key={c} className="px-3.5 py-2 whitespace-nowrap text-slate-800">
                                  {String(r[c] ?? "")}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: QuickSQL Shorthand -> Oracle DDL Generator */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">QuickSQL → Oracle DDL Builder</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Design new RMG Wash tables in indentation shorthand and generate Oracle <code className="font-mono">CREATE TABLE</code> DDL (<code className="font-mono">vcN</code>, <code className="font-mono">num</code>, <code className="font-mono">d</code>, <code className="font-mono">ts</code>, <code className="font-mono">clob</code>, <code className="font-mono">nn</code>).
                  </p>
                </div>

                <textarea
                  value={quickSqlInput}
                  onChange={(e) => setQuickSqlInput(e.target.value)}
                  rows={7}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-600"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleConvertQuickSql(false)}
                    disabled={busyQuickSql}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Generate DDL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConvertQuickSql(true)}
                    disabled={busyQuickSql}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Send to Worksheet
                  </button>
                </div>

                {quickSqlDdl && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Generated Oracle DDL</span>
                      <button
                        type="button"
                        onClick={() => copyText(quickSqlDdl, "quicksql")}
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        {copiedKey === "quicksql" ? <Check size={12} /> : <Copy size={12} />}
                        <span>Copy</span>
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-lg p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {quickSqlDdl}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HANDS-ON OPEN-SOURCE ERP PRACTICE LAB */}
      {activeTab === "hands-on" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Interactive Practice Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Interactive Multi-ERP Workflow Lab
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Run real garment wash operations modeled after Odoo, ERPNext, or Dolibarr. Each execution writes to your live Wash ERP database and generates the exact external API payload for hands-on learning.
                </p>
              </div>

              {/* Platform Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  1. Choose Open-Source ERP Architecture
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "odoo", label: "Odoo 18", proto: "JSON-RPC 2.0" },
                      { id: "erpnext", label: "ERPNext v15", proto: "Frappe REST" },
                      { id: "dolibarr", label: "Dolibarr 20", proto: "REST DOLAPIKEY" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLabPlatform(p.id)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-colors cursor-pointer",
                        labPlatform === p.id
                          ? "border-blue-600 bg-blue-50 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <div className="text-xs font-bold">{p.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.proto}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Workflow Action Switcher */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  2. Select Garment Wash ERP Transaction
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "create_buyer", label: "Create Buyer" },
                      { id: "create_work_order", label: "Wash Work Order" },
                      { id: "create_chemical_po", label: "Chemical PO" },
                    ] as const
                  ).map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setLabAction(act.id)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                        labAction === act.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Fields */}
              <form onSubmit={handleRunSandbox} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer Name</label>
                    <input
                      type="text"
                      value={labForm.buyerName}
                      onChange={(e) => setLabForm({ ...labForm, buyerName: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ERP File / Job No</label>
                    <input
                      type="text"
                      value={labForm.fileNo}
                      onChange={(e) => setLabForm({ ...labForm, fileNo: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {labAction === "create_work_order" && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Style No</label>
                        <input
                          type="text"
                          value={labForm.styleNo}
                          onChange={(e) => setLabForm({ ...labForm, styleNo: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Order Qty (pcs)</label>
                        <input
                          type="number"
                          min={1}
                          value={labForm.qty}
                          onChange={(e) => setLabForm({ ...labForm, qty: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Wash Recipe / Type</label>
                        <input
                          type="text"
                          value={labForm.washType}
                          onChange={(e) => setLabForm({ ...labForm, washType: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </>
                  )}

                  {labAction === "create_chemical_po" && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Chemical Item</label>
                        <input
                          type="text"
                          value={labForm.chemicalName}
                          onChange={(e) => setLabForm({ ...labForm, chemicalName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Order Qty (Kg)</label>
                        <input
                          type="number"
                          min={1}
                          value={labForm.chemicalKg}
                          onChange={(e) => setLabForm({ ...labForm, chemicalKg: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={runningLab}
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Play size={13} fill="currentColor" />
                  <span>
                    {runningLab
                      ? "Executing Transaction..."
                      : `Execute ${labPlatform.toUpperCase()} Transaction & Inspect Wire Payload`}
                  </span>
                </button>
              </form>
            </div>

            {/* Right: Live Wire Payload Inspector & Execution History */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Terminal size={15} className="text-slate-700" />
                    <span>Live API Wire Inspector</span>
                  </h2>
                  {lastLabResult?.requestPreview && (
                    <span className="text-xs font-mono text-slate-500">
                      {lastLabResult.requestPreview.protocol} · {lastLabResult.requestPreview.endpoint}
                    </span>
                  )}
                </div>

                {lastLabResult?.requestPreview ? (
                  <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-[11px] overflow-auto max-h-72 space-y-2">
                    <div className="text-emerald-400">
                      {lastLabResult.requestPreview.endpoint} ({lastLabResult.requestPreview.method})
                    </div>
                    <pre className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(
                        {
                          headers: lastLabResult.requestPreview.headers,
                          body: lastLabResult.requestPreview.body,
                          savedToCollection: lastLabResult.run?.targetCollection,
                          recordId: lastLabResult.run?.createdDocId,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-500">
                    Run any transaction on the left to persist a real record into Wash ERP and inspect the exact Odoo JSON-RPC, ERPNext Frappe REST, or Dolibarr REST payload.
                  </div>
                )}
              </div>

              {/* Recent Hands-On Runs */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  Recent Hands-On Runs ({labRuns.length})
                </div>
                {labRuns.length === 0 ? (
                  <p className="text-xs text-slate-400">No hands-on transactions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto text-xs">
                    {labRuns.slice(0, 6).map((r) => (
                      <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-mono font-bold uppercase text-slate-900">
                            {r.platform}
                          </span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span className="text-slate-700 truncate">{r.summary}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {r.targetCollection}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Comparison Reference Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen size={15} className="text-slate-700" />
                  <span>ERP Connectors &amp; Oracle APEX Reference Matrix</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Side-by-side mapping of API protocols, buyer/work-order objects, and hosting footprints.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Platform</th>
                    <th className="px-4 py-3">License</th>
                    <th className="px-4 py-3">API Protocol</th>
                    <th className="px-4 py-3">Buyer / Partner Model</th>
                    <th className="px-4 py-3">Production Model</th>
                    <th className="px-4 py-3">Key RMG / Wash Modules</th>
                    <th className="px-4 py-3">Min Hosting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {ERP_COMPARISON.map((row) => (
                    <tr key={row.name} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-bold text-slate-900 whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.license}</td>
                      <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">{row.protocol}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{row.buyerModel}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{row.orderModel}</td>
                      <td className="px-4 py-3">{row.rmgModules}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap">{row.ram}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ODOO COMMUNITY CONNECTOR */}
      {activeTab === "odoo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleConnectOdoo} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Odoo Community JSON-RPC 2.0</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect to Odoo 16/17/18 via standard <code className="font-mono">/jsonrpc</code> endpoint.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {odooMeta?.configured ? `Connected · ${odooMeta.serverVersion || "Odoo"}` : "Not connected"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Server URL</label>
                <input
                  type="text"
                  required
                  value={odooForm.url}
                  onChange={(e) => setOdooForm({ ...odooForm, url: e.target.value })}
                  placeholder="http://localhost:8069"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Database Name</label>
                <input
                  type="text"
                  required
                  value={odooForm.db}
                  onChange={(e) => setOdooForm({ ...odooForm, db: e.target.value })}
                  placeholder="rmg_wash_erp"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username / Email</label>
                <input
                  type="text"
                  required
                  value={odooForm.username}
                  onChange={(e) => setOdooForm({ ...odooForm, username: e.target.value })}
                  placeholder="admin"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password / API Key</label>
                <input
                  type="password"
                  required
                  value={odooForm.password}
                  onChange={(e) => setOdooForm({ ...odooForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyOdoo}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              {busyOdoo ? "Testing JSON-RPC..." : "Test & Save Odoo Connection"}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Two-Way Odoo Data Sync</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Push RMG buyers to <code className="font-mono">res.partner</code> or pull Odoo records into Wash ERP collections.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePushOdoo}
              disabled={busyOdoo}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              Push Wash ERP Buyers → Odoo (res.partner)
            </button>

            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <label className="block text-xs font-semibold text-slate-700">Pull Odoo Model into Wash ERP</label>
              <div className="flex gap-2">
                <select
                  value={odooPullModel}
                  onChange={(e) => setOdooPullModel(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="res.partner">res.partner (Buyers &amp; Suppliers)</option>
                  <option value="mrp.production">mrp.production (Manufacturing Orders)</option>
                  <option value="purchase.order">purchase.order (Chemical POs)</option>
                  <option value="hr.employee">hr.employee (Factory Staff)</option>
                  <option value="maintenance.equipment">maintenance.equipment (Wash Machines)</option>
                </select>
                <button
                  type="button"
                  onClick={handlePullOdoo}
                  disabled={busyOdoo}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Pull Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ERPNEXT / FRAPPE CONNECTOR */}
      {activeTab === "erpnext" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleConnectErpNext} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">ERPNext / Frappe REST API</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uses Frappe token auth (<code className="font-mono">Authorization: token key:secret</code>).
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {erpNextMeta?.configured ? `Connected · ${erpNextMeta.loggedUser || "ERPNext"}` : "Not connected"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ERPNext Site URL</label>
                <input
                  type="text"
                  required
                  value={erpNextForm.url}
                  onChange={(e) => setErpNextForm({ ...erpNextForm, url: e.target.value })}
                  placeholder="http://localhost:8080"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={erpNextForm.company}
                  onChange={(e) => setErpNextForm({ ...erpNextForm, company: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frappe API Key</label>
                <input
                  type="text"
                  required
                  value={erpNextForm.apiKey}
                  onChange={(e) => setErpNextForm({ ...erpNextForm, apiKey: e.target.value })}
                  placeholder="e.g. a8f91c2b..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frappe API Secret</label>
                <input
                  type="password"
                  required
                  value={erpNextForm.apiSecret}
                  onChange={(e) => setErpNextForm({ ...erpNextForm, apiSecret: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyErpNext}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              {busyErpNext ? "Testing ERPNext Token..." : "Test & Save ERPNext Connection"}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">ERPNext DocType Sync</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sync Customers, Work Orders, Items, Purchase Orders, and Employees via <code className="font-mono">/api/resource/*</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePushErpNext}
              disabled={busyErpNext}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              Push Wash ERP Buyers → ERPNext (Customer DocType)
            </button>

            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <label className="block text-xs font-semibold text-slate-700">Pull ERPNext DocType</label>
              <div className="flex gap-2">
                <select
                  value={erpNextDoctype}
                  onChange={(e) => setErpNextDoctype(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="Customer">Customer (Buyers)</option>
                  <option value="Work Order">Work Order (Production)</option>
                  <option value="Item">Item (Garments / Chemicals)</option>
                  <option value="Purchase Order">Purchase Order (Procurement)</option>
                  <option value="Employee">Employee (HR Roster)</option>
                </select>
                <button
                  type="button"
                  onClick={handlePullErpNext}
                  disabled={busyErpNext}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Pull DocType
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DOLIBARR REST CONNECTOR */}
      {activeTab === "dolibarr" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleConnectDolibarr} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Dolibarr ERP &amp; CRM REST API</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connects via <code className="font-mono">/api/index.php/*</code> using your <code className="font-mono">DOLAPIKEY</code>.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {dolibarrMeta?.configured ? `Connected · ${dolibarrMeta.dolibarrVersion || "Dolibarr"}` : "Not connected"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dolibarr Base URL</label>
                <input
                  type="text"
                  required
                  value={dolibarrForm.url}
                  onChange={(e) => setDolibarrForm({ ...dolibarrForm, url: e.target.value })}
                  placeholder="http://localhost:8090"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">DOLAPIKEY</label>
                <input
                  type="password"
                  required
                  value={dolibarrForm.apiKey}
                  onChange={(e) => setDolibarrForm({ ...dolibarrForm, apiKey: e.target.value })}
                  placeholder="User Card -> API Key in Dolibarr"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyDolibarr}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              {busyDolibarr ? "Testing Dolibarr REST..." : "Test & Save Dolibarr Connection"}
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Dolibarr Resource Sync</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Push RMG buyers as Thirdparties or pull Products, Orders, and Supplier Orders into Wash ERP.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePushDolibarr}
              disabled={busyDolibarr}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold py-2.5 rounded-lg cursor-pointer"
            >
              Push Wash ERP Buyers → Dolibarr (/thirdparties)
            </button>

            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <label className="block text-xs font-semibold text-slate-700">Pull Dolibarr Endpoint</label>
              <div className="flex gap-2">
                <select
                  value={dolibarrResource}
                  onChange={(e) => setDolibarrResource(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="thirdparties">thirdparties (Buyers / Vendors)</option>
                  <option value="products">products (Items &amp; Chemicals)</option>
                  <option value="orders">orders (Customer Orders)</option>
                  <option value="supplierorders">supplierorders (Purchase Orders)</option>
                  <option value="users">users (Staff Accounts)</option>
                </select>
                <button
                  type="button"
                  onClick={handlePullDolibarr}
                  disabled={busyDolibarr}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Pull Records
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SELF-HOSTED DOCKER HANDS-ON STACKS */}
      {activeTab === "docker" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(
            [
              {
                stack: "oracle-free",
                title: "Oracle AI Database 26ai Free",
                port: "container-registry.oracle.com/database/free:latest · Port 1521/FREEPDB1",
                cmd: "docker compose -f docker-compose.oracle-free.yml up -d",
                note: "Official Oracle Container Registry image (Free Tier: 2 CPUs, 2 GB RAM, 12 GB storage). Connects directly in the Oracle FreeSQL tab.",
              },
              {
                stack: "odoo",
                title: "Odoo 18 Community",
                port: "http://localhost:8069",
                cmd: "docker compose -f docker-compose.odoo.yml up -d",
                note: "PostgreSQL 16 + Odoo 18 CE. Install Manufacturing (mrp), Purchase, and Quality modules after setup.",
              },
              {
                stack: "erpnext",
                title: "ERPNext v15 (Frappe)",
                port: "http://localhost:8080",
                cmd: "docker compose -f docker-compose.erpnext.yml up -d",
                note: "MariaDB 10.6 + Redis + Frappe ERPNext v15. Generate API Key/Secret under User Settings -> API Access.",
              },
              {
                stack: "dolibarr",
                title: "Dolibarr 20 ERP & CRM",
                port: "http://localhost:8090",
                cmd: "docker compose -f docker-compose.dolibarr.yml up -d",
                note: "Lightweight MariaDB + Dolibarr 20 with MRP & REST API modules pre-enabled (admin / admin123).",
              },
            ] as const
          ).map((item) => (
            <div key={item.stack} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  <Server size={15} className="text-slate-400" />
                </div>
                <p className="text-xs font-mono text-blue-700 break-all">{item.port}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{item.note}</p>
              </div>

              <div className="space-y-2.5">
                <div className="bg-slate-900 text-emerald-300 font-mono text-[11px] rounded-lg p-3 flex items-center justify-between gap-2">
                  <span className="truncate">{item.cmd}</span>
                  <button
                    type="button"
                    onClick={() => copyText(item.cmd, item.stack)}
                    className="text-slate-300 hover:text-white shrink-0 cursor-pointer"
                    title="Copy command"
                  >
                    {copiedKey === item.stack ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/open-erp/docker-compose?stack=${item.stack}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition-colors"
                  >
                    <Download size={13} />
                    <span>Download docker-compose.{item.stack}.yml</span>
                  </a>
                  {item.stack === "oracle-free" && (
                    <button
                      type="button"
                      onClick={() => {
                        setFreeSqlForm((prev) => ({
                          ...prev,
                          user: "SYSTEM",
                          connectString: "localhost:1521/FREEPDB1",
                        }));
                        setActiveTab("freesql");
                        toast.success("Switched to Oracle FreeSQL tab with container preset.");
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg cursor-pointer"
                    >
                      <span>Open Connector</span>
                      <ArrowUpRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pulled Records Preview (Shared across Odoo / ERPNext / Dolibarr) */}
      {pulledPreview && pulledPreview.records.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Database size={14} className="text-emerald-600" />
              <span>
                Pulled Records · {pulledPreview.source} ({pulledPreview.records.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPulledPreview(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  {Object.keys(pulledPreview.records[0]).slice(0, 6).map((k) => (
                    <th key={k} className="px-3.5 py-2 font-mono whitespace-nowrap">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {pulledPreview.records.slice(0, 12).map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(pulledPreview.records[0]).slice(0, 6).map((k) => (
                      <td key={k} className="px-3.5 py-2 whitespace-nowrap text-slate-700">
                        {typeof row[k] === "object" ? JSON.stringify(row[k]) : String(row[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
