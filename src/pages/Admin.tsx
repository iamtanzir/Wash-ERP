import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Users, UserPlus, Shield, UserMinus, ShieldAlert, CheckCircle2, 
  KeyRound, User, Eye, EyeOff, Server, HardDrive, Cloud, Download, 
  Upload, RefreshCw, Cpu, Wifi, Folder, Database, Terminal, 
  Copy, Check, Laptop, Radio, AlertCircle, Globe, Smartphone, 
  QrCode, ExternalLink, Zap, BookOpen, Sparkles, Share2, Layers, 
  Lock, ArrowRight, HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { 
  isPuterAvailable, 
  loadPuterServerless, 
  syncKpisToPuterKv, 
  testPuterServerlessKV, 
  generatePuterDeploySnippet 
} from "../lib/puter";

interface UserRecord {
  id: string;
  username: string;
  role: "admin" | "wash_md" | "wash_manager" | "editor" | "viewer" | "operator" | string;
  status: "active" | "inactive";
  created_at?: any;
}

interface HostInfo {
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  isRaspberryPi: boolean;
  localIps: string[];
  port: number;
  dbMode: string;
  localDbPath: string;
  dbFileExists: boolean;
  dbFileSize: number;
  backupCount: number;
  gdriveSyncPath: string;
  publicOnlineUrl?: string;
}

interface BackupItem {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  type: string;
}

import SiaBackupManager from "../components/SiaBackupManager";
import OfficeCLICommandCenter from "../components/OfficeCLICommandCenter";
import AionSuperAdminControl from "../components/AionSuperAdminControl";

export default function Admin() {
  const { user: currentUser, isAdmin } = useAuth();
  const isSuperAdmin = currentUser?.username?.toLowerCase() === "tanzirerp";
  
  // Navigation Tabs: 'online' | 'users' | 'hosting' | 'gdrive' | 'database' | 'sia' | 'cli' | 'aion'
  const [activeTab, setActiveTab] = useState<"online" | "users" | "hosting" | "gdrive" | "database" | "sia" | "cli" | "aion">("online");

  // Users State
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" as const });
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  // Host Info State
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [loadingHost, setLoadingHost] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Online Anywhere & Free Cloud State
  const [publicOnlineUrl, setPublicOnlineUrl] = useState<string>("");
  const [inputPublicUrl, setInputPublicUrl] = useState<string>("");
  const [savingPublicUrl, setSavingPublicUrl] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [guideLang, setGuideLang] = useState<"bn" | "en">("bn");
  const [activeOnlineGuide, setActiveOnlineGuide] = useState<"tunnel" | "puter" | "turso" | "vercel" | "gdrive" | "mobile">("puter");
  const [checkingOnline, setCheckingOnline] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState<{ checked: boolean; isOnline: boolean; isTurso: boolean } | null>(null);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);

  // Puter.com Serverless Technology State
  const [puterSyncingKv, setPuterSyncingKv] = useState(false);
  const [puterTestingKv, setPuterTestingKv] = useState(false);
  const [puterKvTestResult, setPuterKvTestResult] = useState<{ status: string; latencyMs: number; success: boolean } | null>(null);
  const [copiedPuterDeploy, setCopiedPuterDeploy] = useState(false);

  // Google Drive & Backup State
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [syncingGdrive, setSyncingGdrive] = useState(false);
  const [restoringFile, setRestoringFile] = useState(false);
  const [gdriveSyncFolder, setGdriveSyncFolder] = useState("");
  const [savingGdriveFolder, setSavingGdriveFolder] = useState(false);

  // Database Mode Switcher State
  const [selectedDbMode, setSelectedDbMode] = useState<string>("local");
  const [customDbPath, setCustomDbPath] = useState("");
  const [savingDbMode, setSavingDbMode] = useState(false);
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [showTursoToken, setShowTursoToken] = useState(false);
  const [savingTurso, setSavingTurso] = useState(false);

  const generateQr = async (url: string) => {
    if (!url || !url.trim()) {
      setQrCodeDataUrl("");
      return;
    }
    try {
      const QRCode = (await import('qrcode')).default;
      const data = await QRCode.toDataURL(url.trim(), { width: 260, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
      setQrCodeDataUrl(data);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  };

  const handlePuterSyncKv = async () => {
    setPuterSyncingKv(true);
    try {
      const res = await syncKpisToPuterKv({
        factory: "INCTL Wash ERP",
        orders: hostInfo?.totalOrders || 0,
        syncTime: new Date().toISOString(),
        status: "Active & Synced"
      });
      if (res.success) {
        toast.success(`Live KPIs saved to Puter Serverless KV store (${res.latencyMs}ms)!`);
      } else {
        toast.error("Could not write to Puter Serverless KV store");
      }
    } catch (err: any) {
      toast.error(`Puter KV sync failed: ${err?.message || err}`);
    } finally {
      setPuterSyncingKv(false);
    }
  };

  const handleTestPuterKv = async () => {
    setPuterTestingKv(true);
    try {
      const res = await testPuterServerlessKV();
      setPuterKvTestResult(res);
      if (res.success) {
        toast.success(res.status);
      } else {
        toast.error(res.status);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err?.message || err}`);
    } finally {
      setPuterTestingKv(false);
    }
  };

  const handleCopyPuterDeploy = () => {
    const snippet = generatePuterDeploySnippet("inctl-wash-erp");
    navigator.clipboard.writeText(snippet);
    setCopiedPuterDeploy(true);
    toast.success("Puter serverless hosting deployment script copied!");
    setTimeout(() => setCopiedPuterDeploy(false), 2000);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
       toast.error("Failed to fetch users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchHostInfo = async () => {
    setLoadingHost(true);
    try {
      const res = await fetch("/api/system/host-info");
      if (res.ok) {
        const data = await res.json();
        setHostInfo(data);
        setSelectedDbMode(data.dbMode || "local");
        setCustomDbPath(data.localDbPath || "");
        setGdriveSyncFolder(data.gdriveSyncPath || "");
        if (data.publicOnlineUrl) {
          setPublicOnlineUrl(data.publicOnlineUrl);
          setInputPublicUrl(data.publicOnlineUrl);
          generateQr(data.publicOnlineUrl);
        }
      }
    } catch (e) {
      console.error("Failed to fetch host info:", e);
    } finally {
      setLoadingHost(false);
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/backup/list");
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error("Failed to fetch backups:", e);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
      fetchHostInfo();
      fetchBackups();
    }
  }, [isSuperAdmin]);

  const handleSavePublicUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPublicUrl(true);
    try {
      const cleanUrl = inputPublicUrl.trim();
      const res = await fetch("/api/system/public-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl: cleanUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save public URL");
      setPublicOnlineUrl(cleanUrl);
      generateQr(cleanUrl);
      toast.success("Public Online URL saved & QR Code updated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPublicUrl(false);
    }
  };

  const handleTestOnline = async () => {
    setCheckingOnline(true);
    try {
      const res = await fetch("/api/system/check-online");
      const data = await res.json();
      setOnlineStatus({
        checked: true,
        isOnline: data.online,
        isTurso: data.isTursoCloud
      });
      if (data.online) {
        toast.success("System is connected and online!");
      } else {
        toast.warning("Server is currently in offline / local-only mode.");
      }
    } catch (e: any) {
      setOnlineStatus({ checked: true, isOnline: false, isTurso: false });
      toast.error("Online test failed: " + e.message);
    } finally {
      setCheckingOnline(false);
    }
  };

  const handleCopyPublic = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPublicUrl(true);
    toast.success("Public Online URL copied to clipboard!");
    setTimeout(() => setCopiedPublicUrl(false), 3000);
  };

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    toast.success("LAN URL copied to clipboard!");
    setTimeout(() => setCopiedIp(null), 3000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;

    try {
      const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      toast.success("User whitelisted successfully");
      setShowAddModal(false);
      setNewUser({ username: "", password: "", role: "viewer" });
      setShowNewUserPassword(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update role");
      }
      toast.success("Role updated");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      try {
          const res = await fetch(`/api/admin/users/${userId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Update failed");
          }
          toast.success(`User set to ${newStatus}`);
          fetchUsers();
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
      try {
          const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Deletion failed");
          }
          toast.success("User deleted");
          fetchUsers();
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  // Export Full Database Snapshot (JSON)
  const handleExportBackup = () => {
    toast.info("Preparing complete database snapshot...");
    window.location.href = "/api/backup/export";
  };

  // Restore Database from Snapshot
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Are you sure you want to restore the database from "${file.name}"? Existing orders and logs will be merged and updated.`)) {
      e.target.value = "";
      return;
    }

    setRestoringFile(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restore database");

      toast.success(data.message || "Database restored successfully!");
      fetchHostInfo();
      fetchBackups();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRestoringFile(false);
      e.target.value = "";
    }
  };

  // Trigger Google Drive Cloud Snapshot Sync
  const handleTriggerGdriveSync = async () => {
    setSyncingGdrive(true);
    try {
      const res = await fetch("/api/backup/gdrive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFolder: gdriveSyncFolder })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      toast.success(data.message || "Cloud snapshot successfully created!");
      fetchBackups();
      fetchHostInfo();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingGdrive(false);
    }
  };

  // Save Database Engine Switch
  const handleSwitchDbMode = async (mode: string, pathOverride?: string) => {
    setSavingDbMode(true);
    try {
      const res = await fetch("/api/admin/config/db-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, localPath: pathOverride || customDbPath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to switch mode");

      toast.success(data.message || `Switched to ${mode.toUpperCase()}`);
      setSelectedDbMode(mode);
      fetchHostInfo();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingDbMode(false);
    }
  };

  // Save Turso Cloud Credentials
  const handleSaveTurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tursoUrl || !tursoToken) {
      toast.error("Both URL and Token are required.");
      return;
    }
    setSavingTurso(true);
    try {
      const res = await fetch("/api/admin/config/turso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tursoUrl, token: tursoToken })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Failed to save configuration");
      toast.success(data.message || "Database configuration saved securely");
      setTursoUrl("");
      setTursoToken("");
      fetchHostInfo();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingTurso(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-rose-50 border-2 border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock size={36} />
          </div>
          
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-[11px] font-black uppercase tracking-wider rounded-full border border-rose-300">
              Restricted Access
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Super Admin Only</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong>HOST & CLOUD ADMIN</strong> (Local PC, Raspberry Pi hosting & Free Cloud Database control) is strictly reserved for the Super Admin (<strong>tanzirerp</strong>).
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
              <span>Authorized Super Admin:</span>
              <span className="font-mono font-bold text-emerald-600">tanzirerp</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full bg-slate-900 text-white font-bold text-xs uppercase px-6 py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System & Deployment Control</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-300">
              v2.5 Production Ready
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Host locally on PC or Raspberry Pi (RPi), and leverage 15 GB Free Google Drive Cloud Database Storage.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportBackup}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-300 active:scale-95"
              title="Download entire ERP snapshot"
            >
              <Download size={16} />
              Export Backup
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
            >
              <UserPlus size={16} />
              Whitelist User
            </button>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("online")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "online" 
              ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-md shadow-emerald-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Globe size={16} />
          🌐 24/7 Online Anywhere & Free Cloud (A-Z)
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "users" 
              ? "bg-slate-900 text-white shadow-md" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Users size={16} />
          User Directory ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("hosting")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "hosting" 
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Server size={16} />
          🖥️ Local PC & 🍓 Raspberry Pi Hosting
        </button>

        <button
          onClick={() => setActiveTab("gdrive")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "gdrive" 
              ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Cloud size={16} />
          ☁️ Google Drive 15GB Cloud DB & Backup
        </button>

        <button
          onClick={() => setActiveTab("database")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "database" 
              ? "bg-emerald-700 text-white shadow-md shadow-emerald-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Database size={16} />
          🔌 Database Mode ({selectedDbMode.toUpperCase()})
        </button>

        <button
          onClick={() => setActiveTab("sia")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "sia" 
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Cloud size={16} />
          ⚡ Sia Cloud & Self-Hosted
        </button>

        <button
          onClick={() => setActiveTab("cli")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "cli" 
              ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Terminal size={16} />
          🤖 iOfficeAI / OfficeCLI Suite
        </button>

        <button
          onClick={() => setActiveTab("aion")}
          className={cn(
            "flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all",
            activeTab === "aion" 
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <Globe size={16} />
          🌐 AionUI Global Omni Control
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: 24/7 GLOBAL ONLINE ACCESS & 100% FREE CLOUD ARCHITECTURE (A TO Z)   */}
      {/* ========================================================================= */}
      {activeTab === "online" && (
        <div className="space-y-8">
          {/* Top Hero Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 rounded-2xl p-6 lg:p-8 text-white border border-emerald-900/50 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/30">
                    <Globe size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-black tracking-tight">24/7 Global Online Access & Free Cloud Architecture</h2>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/40">
                        100% Free Tier ($0/mo)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enter daily orders, fabrics, garments wash stages & monitor factory KPIs from anywhere in the world on mobile, tablet & laptop.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="bg-slate-800 text-slate-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5">
                    <Database size={13} className="text-emerald-400" />
                    Active Engine: <strong className="text-emerald-400">{selectedDbMode.toUpperCase()}</strong>
                  </span>
                  <span className="bg-slate-800 text-slate-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5">
                    <Cloud size={13} className="text-blue-400" />
                    Cloud Vault: <strong>Google Drive 15 GB Free</strong>
                  </span>
                  <span className="bg-slate-800 text-slate-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1.5">
                    <Lock size={13} className="text-cyan-400" />
                    Encrypted SSL: <strong>HTTPS Enabled</strong>
                  </span>
                </div>
              </div>

              {/* Ping Test & Language Toggle */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                <button
                  onClick={handleTestOnline}
                  disabled={checkingOnline}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-slate-700 active:scale-95 disabled:opacity-50"
                  title="Check live connectivity"
                >
                  <RefreshCw size={14} className={checkingOnline ? "animate-spin text-emerald-400" : ""} />
                  {checkingOnline ? "Testing Connection..." : "Ping Online Status"}
                </button>

                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 w-full sm:w-auto justify-center">
                  <button
                    onClick={() => setGuideLang("bn")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      guideLang === "bn" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                    )}
                  >
                    🇧🇩 বাংলা গাইড
                  </button>
                  <button
                    onClick={() => setGuideLang("en")}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      guideLang === "en" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
                    )}
                  >
                    🇬🇧 English Guide
                  </button>
                </div>
              </div>
            </div>

            {/* Public URL & Mobile QR Code Center */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left 8 Cols: Public URL Box & Settings */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-slate-900/90 border border-emerald-900/40 p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Public Global Online Link
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Accessible 24/7 on Mobile, Tablet & Remote PC
                    </span>
                  </div>

                  {publicOnlineUrl ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe size={18} className="text-emerald-400 shrink-0" />
                        <span className="text-emerald-300 font-mono text-sm font-bold truncate selection:bg-emerald-500 selection:text-slate-950">
                          {publicOnlineUrl}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyPublic(publicOnlineUrl)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 shadow"
                        >
                          {copiedPublicUrl ? <Check size={14} /> : <Copy size={14} />}
                          {copiedPublicUrl ? "Copied!" : "Copy Link"}
                        </button>
                        <a
                          href={publicOnlineUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-700"
                        >
                          <ExternalLink size={14} />
                          Open
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-200 text-xs">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle size={15} />
                        No Public Online URL configured yet.
                      </p>
                      <p className="text-[11px] text-amber-300/80 mt-1">
                        Run <strong>start-online-tunnel.bat</strong> (Windows) or <strong>./start-online-tunnel.sh</strong> (RPi/Linux) to generate a free public link, then paste it below!
                      </p>
                    </div>
                  )}

                  {/* Public URL input form */}
                  <form onSubmit={handleSavePublicUrl} className="mt-3 flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="url"
                      value={inputPublicUrl}
                      onChange={e => setInputPublicUrl(e.target.value)}
                      placeholder="Paste your Cloudflare Tunnel or Vercel URL (e.g. https://your-erp.trycloudflare.com)"
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={savingPublicUrl}
                      className="w-full sm:w-auto shrink-0 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-600 disabled:opacity-50"
                    >
                      {savingPublicUrl ? "Saving..." : "Save & Generate QR"}
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Software Cost</p>
                    <p className="text-emerald-400 font-black text-sm">৳০ / $0 Free</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Cloud DB Capacity</p>
                    <p className="text-blue-400 font-black text-sm">15 GB + 9 GB</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Concurrent Users</p>
                    <p className="text-purple-400 font-black text-sm">Unlimited</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px] font-bold uppercase">Remote Access</p>
                    <p className="text-teal-400 font-black text-sm">Global 24/7</p>
                  </div>
                </div>
              </div>

              {/* Right 4 Cols: Mobile QR Code Box */}
              <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl flex flex-col items-center text-center">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smartphone size={15} className="text-emerald-400" />
                  Mobile & Tablet Quick Scan
                </span>

                {qrCodeDataUrl ? (
                  <div className="bg-white p-3 rounded-xl shadow-lg border border-slate-300 my-2">
                    <img src={qrCodeDataUrl} alt="ERP Mobile Access QR Code" className="w-40 h-40 object-contain" />
                  </div>
                ) : (
                  <div className="w-40 h-40 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center text-slate-500 my-2 p-3">
                    <QrCode size={36} className="text-slate-600 mb-1" />
                    <p className="text-[10px] text-slate-400 leading-tight">Enter public URL to generate QR code</p>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 mt-1">
                  Point smartphone camera at QR code to open ERP on floor for data entry.
                </p>
                {qrCodeDataUrl && (
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = qrCodeDataUrl;
                      a.download = "inctl_wash_erp_mobile_qr.png";
                      a.click();
                      toast.success("QR Code downloaded!");
                    }}
                    className="mt-3 text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                  >
                    <Download size={13} />
                    Download QR Image (Print for Factory)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 5 Zero-Cost Deployment Models Cards */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-600" />
                ৫টি সম্পূর্ণ ফ্রি ক্লাউড ও হোস্টিং পদ্ধতি (Choose Your 100% Free Cloud Setup)
              </h3>
              <p className="text-xs text-slate-500">
                আপনার ফ্যাক্টরির সুবিধানুযায়ী যেকোনো একটি বা একাধিক পদ্ধতি বিনামূল্যে ব্যবহার করুন। কোনোটাতে ১ টাকাও খরচ হবে না।
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {/* Card 0: Puter.com 100% Free Cloud OS */}
              <div 
                onClick={() => setActiveOnlineGuide("puter")}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between",
                  activeOnlineGuide === "puter" 
                    ? "border-amber-500 shadow-md ring-2 ring-amber-500/20" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">⚡</span>
                    <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Pure Serverless
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Puter Serverless</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    developer.puter.com - ১০০% ফ্রি সার্ভারলেস Key-Value ডাটাবেজ (puter.kv) ও গ্লোবাল এজ স্ট্যাটিক হোস্টিং।
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
                  <span>Live Tools & Guide</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Card 1: Cloudflare Tunnel */}
              <div 
                onClick={() => setActiveOnlineGuide("tunnel")}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between",
                  activeOnlineGuide === "tunnel" 
                    ? "border-emerald-600 shadow-md ring-2 ring-emerald-500/20" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">⚡</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      1-Click Free
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Cloudflare Free Tunnel</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    পিসি বা Raspberry Pi-কে ১-ক্লিকে ফ্রি পাবলিক HTTPS লিংকে রূপান্তর করুন। নো পোর্ট ফরওয়ার্ডিং।
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
                  <span>View Step-by-Step</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Card 2: Turso Cloud DB */}
              <div 
                onClick={() => setActiveOnlineGuide("turso")}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between",
                  activeOnlineGuide === "turso" 
                    ? "border-indigo-600 shadow-md ring-2 ring-indigo-500/20" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">☁️</span>
                    <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      9 GB Free LibSQL
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Turso Cloud Database</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    সেন্ট্রালাইজড ফ্রি ক্লাউড ডাটাবেজ। ঢাকা অফিস ও ফ্যাক্টরি একসাথে একই লাইভ ডাটাতে এন্ট্রি দিতে পারবে।
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                  <span>View Step-by-Step</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Card 3: 24/7 Vercel Web */}
              <div 
                onClick={() => setActiveOnlineGuide("vercel")}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between",
                  activeOnlineGuide === "vercel" 
                    ? "border-cyan-600 shadow-md ring-2 ring-cyan-500/20" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">🚀</span>
                    <span className="bg-cyan-100 text-cyan-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      24/7 Zero Hardware
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Vercel Free Web Host</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ফ্যাক্টরির পিসি বন্ধ থাকলেও ২৪ ঘণ্টা সফটওয়্যার চালু থাকবে ফ্রি সার্ভারলেস হোস্টিংয়ের মাধ্যমে।
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-cyan-700">
                  <span>View Step-by-Step</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* Card 4: Google Drive 15GB */}
              <div 
                onClick={() => setActiveOnlineGuide("gdrive")}
                className={cn(
                  "p-5 rounded-2xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between",
                  activeOnlineGuide === "gdrive" 
                    ? "border-blue-600 shadow-md ring-2 ring-blue-500/20" 
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">📁</span>
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      15 GB Free Vault
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Google Drive 15GB Sync</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    প্রতিদিনের সমস্ত অর্ডার ও ওয়াশ হিস্ট্রি গুগল ড্রাইভের ফ্রি ক্লাউডে স্ন্যাপশট হিসেবে স্বয়ংক্রিয় সেভ।
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
                  <span>View Step-by-Step</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive A-to-Z Setup Guide Box */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <BookOpen size={20} className="text-emerald-600" />
                  {guideLang === "bn" ? "এ টু জেড ক্লাউড সেটআপ গাইডলাইন" : "A-to-Z Free Cloud Setup Guide"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {guideLang === "bn" 
                    ? "নিচের যেকোনো অপশন নির্বাচন করে লাইভ টুলস ও কমান্ড ব্যবহার করুন।"
                    : "Select a guide module below to view live cloud tools, exact commands, and steps."}
                </p>
              </div>

              {/* Guide Selector Sub-tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setActiveOnlineGuide("puter")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    activeOnlineGuide === "puter" ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <span>⚡</span> Puter Serverless (KV & Host)
                </button>
                <button
                  onClick={() => setActiveOnlineGuide("tunnel")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeOnlineGuide === "tunnel" ? "bg-white text-emerald-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ⚡ Cloudflare Tunnel
                </button>
                <button
                  onClick={() => setActiveOnlineGuide("turso")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeOnlineGuide === "turso" ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  ☁️ Turso Cloud DB
                </button>
                <button
                  onClick={() => setActiveOnlineGuide("vercel")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeOnlineGuide === "vercel" ? "bg-white text-cyan-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  🚀 24/7 Vercel Web
                </button>
                <button
                  onClick={() => setActiveOnlineGuide("gdrive")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeOnlineGuide === "gdrive" ? "bg-white text-blue-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  📁 Google Drive Sync
                </button>
                <button
                  onClick={() => setActiveOnlineGuide("mobile")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeOnlineGuide === "mobile" ? "bg-white text-purple-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  📱 Mobile Data Entry
                </button>
              </div>
            </div>

            {/* Guide 0: Puter Serverless Technology (Zero Server / Pure Serverless) */}
            {activeOnlineGuide === "puter" && (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                        <Globe size={18} className="text-amber-600" />
                        {guideLang === "bn" 
                          ? "Puter Serverless Technology: ১০০% ফ্রি সার্ভারলেস ক্লাউড ও এজ ডাটাবেজ"
                          : "Puter Serverless Technology: 100% Free Serverless Cloud & Edge KV"}
                      </h4>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        {guideLang === "bn"
                          ? "https://developer.puter.com/ - কোনো প্রকার ক্রেডিট কার্ড, ব্যাকএন্ড সার্ভার বা ক্লাউড ফি ছাড়া সম্পূর্ণ সার্ভারলেস Key-Value ডাটাবেজ (puter.kv) এবং গ্লোবাল এজ স্ট্যাটিক হোস্টিং (puter.hosting)।"
                          : "Serverless key-value persistence (puter.kv) and global edge static hosting (puter.hosting) with zero backend setup."}
                      </p>
                    </div>

                    <a 
                      href="https://developer.puter.com/" 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                    >
                      <span>Visit developer.puter.com</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>

                {/* Live Puter Serverless Control Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-black text-slate-950 text-lg shadow">
                        ⚡
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-sm tracking-wide text-white">Puter Serverless Architecture</h5>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Pure Serverless Engine
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Zero-backend clientless edge computing powered by Puter Serverless Technology
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestPuterKv}
                        disabled={puterTestingKv}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all flex items-center gap-2"
                      >
                        {puterTestingKv ? <RefreshCw size={13} className="animate-spin text-amber-400" /> : <Zap size={13} className="text-amber-400" />}
                        {puterTestingKv ? "Testing Latency..." : "Test Serverless KV Ping"}
                      </button>
                      <button
                        onClick={handleCopyPuterDeploy}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                      >
                        {copiedPuterDeploy ? <Check size={13} /> : <Copy size={13} />}
                        {copiedPuterDeploy ? "Copied Script!" : "Copy Hosting Script"}
                      </button>
                    </div>
                  </div>

                  {/* 2 Focused Serverless Technology Modules */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Module 1: Serverless Key-Value (puter.kv) */}
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-emerald-400">
                          <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <Database size={15} /> Serverless Key-Value DB
                          </span>
                          <span className="text-[10px] font-mono bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 px-2 py-0.5 rounded">
                            puter.kv
                          </span>
                        </div>
                        <h6 className="font-bold text-sm text-slate-100">Zero-Config Serverless Storage</h6>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          ডাটাবেজ কানেকশন স্ট্রিং, ইউজার পাসওয়ার্ড বা ক্লাউড বিল ছাড়াই সরাসরি ব্রাউজার থেকে সুরক্ষিত Key-Value পেয়ার স্টোর ও রিট্রিভ করুন।
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 space-y-1">
                          <div className="text-slate-400 text-[11px] font-sans flex items-center justify-between">
                            <span>KV Status:</span>
                            <span className="text-emerald-400 font-bold">Active / Serverless</span>
                          </div>
                          <div className="text-amber-300/90 truncate">
                            // puter.kv.set('inctl_serverless_kpi', payload)
                          </div>
                          {puterKvTestResult && (
                            <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300">
                              <span className="text-slate-400">Response: </span>
                              <span className={puterKvTestResult.success ? "text-emerald-400" : "text-rose-400"}>
                                {puterKvTestResult.status} ({puterKvTestResult.latencyMs}ms)
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handlePuterSyncKv}
                            disabled={puterSyncingKv}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow"
                          >
                            {puterSyncingKv ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                            {puterSyncingKv ? "Syncing..." : "Sync Live KPIs to Serverless KV"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Module 2: Serverless Static Edge Hosting (puter.hosting) */}
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-cyan-400">
                          <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={15} /> Serverless Edge Hosting
                          </span>
                          <span className="text-[10px] font-mono bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 px-2 py-0.5 rounded">
                            *.puter.site
                          </span>
                        </div>
                        <h6 className="font-bold text-sm text-slate-100">Global Edge CDN Deployment</h6>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Rollup দ্বারা অপটিমাইজ করা লাইটওয়েট ফ্রন্টএন্ড বান্ডেল কোনো মাসিক হোস্টিং ফি ছাড়া সরাসরি Puter গ্লোবাল এজ নেটওয়ার্কে হোস্ট করুন।
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <pre className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                          puter.hosting.create("inctl-wash-erp", "dist/")
                        </pre>

                        <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-700 text-xs text-slate-300">
                          <span className="text-slate-400">Free Subdomain:</span>
                          <span className="font-mono text-cyan-400 font-bold">inctl-wash-erp.puter.site</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step-by-Step Architecture Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card A: Serverless Technology Benefits */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Layers size={16} className="text-amber-600" />
                      {guideLang === "bn" ? "Puter Serverless প্রযুক্তির সুবিধা" : "Puter Serverless Technology Benefits"}
                    </h5>
                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                      <li><strong>Zero Infrastructure Cost:</strong> কোনো ক্লাউড সার্ভার বা মাসিক বিল ছাড়া ১০০% সার্ভারলেস সমাধান।</li>
                      <li><strong>No Credentials Exposure:</strong> কোনো ডাটাবেজ সিক্রেট কি বা পাসওয়ার্ড ফ্রন্টএন্ডে এক্সপোজ হয় না।</li>
                      <li><strong>Serverless Key-Value (puter.kv):</strong> লাইটওয়েট স্টেট ও মেট্রিক্স সরাসরি ব্রাউজার থেকে এজ স্টোরেজে সিঙ্ক।</li>
                      <li><strong>On-Demand Dynamic Loading:</strong> অপটিমাইজড Rollup আর্কিটেকচার দ্বারা পুটার SDK শুধুমাত্র প্রয়োজনের সময় অন-ডিমান্ড লোড হয়, মূল অ্যাপের গতি অক্ষুণ্ণ রাখে।</li>
                    </ol>
                  </div>

                  {/* Card B: Build & Deploy CLI Snippet */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Terminal size={16} className="text-slate-800" />
                        {guideLang === "bn" ? "সার্ভারলেস ডেপ্লয়মেন্ট কমান্ড" : "Serverless Deployment CLI"}
                      </h5>
                      <button
                        onClick={handleCopyPuterDeploy}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                      >
                        {copiedPuterDeploy ? <Check size={12} /> : <Copy size={12} />}
                        {copiedPuterDeploy ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-amber-300 p-3 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed">
# 1. Build ultra-light Rollup bundle
npm run build

# 2. Deploy to Puter Serverless Edge CDN
puter.hosting.create("inctl-wash-erp", "dist/")
                    </pre>
                    <p className="text-[11px] text-slate-500">
                      আপনার অ্যাপটি গ্লোবাল এজ নেটওয়ার্ক থেকে কয়েক মিলি-সেকেন্ডে লোড হবে।
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Guide 1: Cloudflare Tunnel */}
            {activeOnlineGuide === "tunnel" && (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                    <Zap size={16} className="text-emerald-600" />
                    {guideLang === "bn" 
                      ? "পদ্ধতি ১: Cloudflare Free Tunnel (পিসি বা Raspberry Pi থেকে ১-ক্লিকে অনলাইন)"
                      : "Method 1: 1-Click Free Cloudflare Tunnel (Windows PC & Raspberry Pi)"}
                  </h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    {guideLang === "bn"
                      ? "আপনার ফ্যাক্টরির পিসি বা Raspberry Pi-কে সরাসরি পাবলিক ইন্টারনেটে ফ্রি লাইভ করুন। রাউটারে পোর্ট ফরওয়ার্ডিং বা কোনো মাসিক ফি ছাড়া সম্পূর্ণ ফ্রিতে HTTPS লিঙ্ক প্রদান করবে।"
                      : "Turn your local factory PC or Raspberry Pi into a globally accessible web server with zero port-forwarding and zero cost."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Windows Guide */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Laptop size={16} className="text-blue-600" />
                        Windows 1-Click Launcher
                      </h5>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">.BAT Script</span>
                    </div>

                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
                      <li>প্রজেক্ট রুট ফোল্ডারে থাকা <strong>start-online-tunnel.bat</strong> ফাইলে ডাবল-ক্লিক করুন।</li>
                      <li>স্ক্রিপ্টটি স্বয়ংক্রিয়ভাবে লোকাল ইআরপি রান করবে এবং ফ্রি ক্লাউডফ্লেয়ার টানেল চালু করবে।</li>
                      <li>টার্মিনাল উইন্ডোতে একটি ফ্রি লিঙ্ক দেখতে পাবেন: <code className="text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">https://xxxx.trycloudflare.com</code></li>
                      <li>এই লিঙ্কটি উপরের <strong>Public Global Online Link</strong> বক্সে পেস্ট করে সেভ করুন।</li>
                    </ol>

                    <button
                      onClick={() => {
                        fetch("/start-online-tunnel.bat")
                          .then(r => r.text())
                          .then(txt => downloadTextFile("start-online-tunnel.bat", txt))
                          .catch(() => downloadTextFile("start-online-tunnel.bat", "@echo off\ncall npm run dev\n"));
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow"
                    >
                      <Download size={14} />
                      Download start-online-tunnel.bat
                    </button>
                  </div>

                  {/* Raspberry Pi / Linux Guide */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Server size={16} className="text-rose-600" />
                        Raspberry Pi & Linux (24/7 Hosting)
                      </h5>
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded">.SH Script</span>
                    </div>

                    <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
                      <li>টার্মিনাল ওপেন করে নিচের কমান্ডটি পেস্ট করুন:</li>
                      <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg text-[11px] font-mono overflow-x-auto">
chmod +x start-online-tunnel.sh
./start-online-tunnel.sh
                      </pre>
                      <li>ক্লাউডফ্লেয়ার কয়েক সেকেন্ডের মধ্যে আপনার রাস্পবেরি পাই-এর জন্য একটি ফ্রি পাবলিক লিঙ্ক জেনারেট করবে।</li>
                      <li>এখন পাই-টি ফ্যাক্টরিতে ২৪ ঘণ্টা চালু রাখুন, ঢাকা বা যেকোনো স্থান থেকে যেকেউ ডাটা এন্ট্রি করতে পারবে!</li>
                    </ol>

                    <button
                      onClick={() => {
                        fetch("/start-online-tunnel.sh")
                          .then(r => r.text())
                          .then(txt => downloadTextFile("start-online-tunnel.sh", txt))
                          .catch(() => downloadTextFile("start-online-tunnel.sh", "#!/bin/bash\ncloudflared tunnel --url http://localhost:3000\n"));
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow"
                    >
                      <Download size={14} />
                      Download start-online-tunnel.sh
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Guide 2: Turso Cloud DB */}
            {activeOnlineGuide === "turso" && (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <h4 className="font-bold text-indigo-950 text-sm flex items-center gap-2">
                    <Database size={16} className="text-indigo-600" />
                    {guideLang === "bn" 
                      ? "পদ্ধতি ২: Turso ১০০% ফ্রি ডিস্ট্রিবিউটেড ক্লাউড ডাটাবেজ (9 GB LibSQL)"
                      : "Method 2: Turso 100% Free Distributed Cloud Database (9 GB LibSQL)"}
                  </h4>
                  <p className="text-xs text-indigo-800 mt-1">
                    {guideLang === "bn"
                      ? "টারসো (Turso) হলো ৯ জিবি ফ্রি ক্লাউড ডাটাবেজ। আপনার ফ্যাক্টরির পিসি বন্ধ থাকলেও ঢাকা হেড অফিস, সাব-কন্ট্রাক্ট কারখানা কিংবা বায়ারের লোক একই ডাটাবেজে রিয়েলটাইম ডাটা দেখতে ও এন্ট্রি করতে পারবে।"
                      : "Turso gives 9 GB storage and 1 Billion reads/month for $0. Multiple factories, merchandising teams, and remote users write to the exact same cloud database concurrently."}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                      <h5 className="font-bold text-slate-900 text-xs uppercase">বিনামূল্যে সাইনআপ</h5>
                      <p className="text-xs text-slate-500">
                        <a href="https://turso.tech" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-bold">turso.tech</a> এ যান এবং GitHub দিয়ে ১-ক্লিকে ফ্রি অ্যাকাউন্ট করুন। কোনো ক্রেডিট কার্ড লাগবে না।
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                      <h5 className="font-bold text-slate-900 text-xs uppercase">ডাটাবেজ তৈরি করুন</h5>
                      <p className="text-xs text-slate-500">
                        ড্যাশবোর্ডে <strong>Create Database</strong> চাপুন অথবা CLI-তে লিখুন:
                      </p>
                      <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[11px] font-mono">
turso db create inctl-wash-erp
                      </pre>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                      <h5 className="font-bold text-slate-900 text-xs uppercase">টোকেন তৈরি করুন</h5>
                      <p className="text-xs text-slate-500">
                        অথেন্টিকেশন টোকেন পেতে কমান্ড চালান:
                      </p>
                      <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[11px] font-mono">
turso db tokens create inctl-wash-erp
                      </pre>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        ইআরপিতে কানেক্ট করার নিয়ম:
                      </span>
                      <button 
                        onClick={() => setActiveTab("database")}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1 rounded-lg font-bold"
                      >
                        Go to Database Tab
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">
                      ইআরপির <strong>Database Mode</strong> ট্যাবে গিয়ে <strong>Turso Cloud LibSQL</strong> সিলেক্ট করে আপনার Database URL (<code className="text-emerald-400">libsql://inctl-wash-erp-xxx.turso.io</code>) ও Auth Token পেস্ট করে দিন। সম্পূর্ণ ডাটাবেজ এখন ক্লাউডে লাইভ!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Guide 3: Vercel Web Deployment */}
            {activeOnlineGuide === "vercel" && (
              <div className="space-y-6">
                <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                  <h4 className="font-bold text-cyan-950 text-sm flex items-center gap-2">
                    <Globe size={16} className="text-cyan-600" />
                    {guideLang === "bn" 
                      ? "পদ্ধতি ৩: Vercel-এ ২৪/৭ ফ্রি ক্লাউড ওয়েব হোস্টিং ($0 Cost)"
                      : "Method 3: 24/7 Free Cloud Web Hosting on Vercel ($0 Cost)"}
                  </h4>
                  <p className="text-xs text-cyan-800 mt-1">
                    {guideLang === "bn"
                      ? "আপনার ফ্যাক্টরির পিসি বা ল্যাপটপ বন্ধ থাকলেও ইআরপি সফটওয়্যারটি ২৪ ঘণ্টা অনলাইনে চলবে। Vercel সার্ভারলেস ও Turso ক্লাউড ডাটাবেজ একত্রে ব্যবহার করলে এটি ১০০% ফ্রি ও আল্ট্রা-ফাস্ট কাজ করে।"
                      : "Deploy to Vercel in 2 minutes for zero server maintenance. The app is live 24/7 with 99.99% uptime."}
                  </p>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="bg-cyan-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
                    <div>
                      <strong className="text-slate-900 block">GitHub-এ কোড পুশ করুন:</strong>
                      প্রজেক্টের গিট রিপোজিটরিটি আপনার GitHub অ্যাকাউন্টে পুশ করে দিন।
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="bg-cyan-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
                    <div>
                      <strong className="text-slate-900 block">Vercel-এ ইমপোর্ট করুন:</strong>
                      <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-cyan-700 underline font-bold">vercel.com</a> এ গিয়ে <strong>Add New Project</strong> ক্লিক করে আপনার গিটহাব রিপোজিটরিটি সিলেক্ট করুন।
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="bg-cyan-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
                    <div className="w-full">
                      <strong className="text-slate-900 block">Environment Variables যুক্ত করুন:</strong>
                      Vercel-এর সেটিংস এ নিচের ভেরিয়েবলগুলো পেস্ট করুন:
                      <div className="mt-2 bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] space-y-1">
                        <div>DATABASE_MODE=turso</div>
                        <div>TURSO_DATABASE_URL=libsql://your-db.turso.io</div>
                        <div>TURSO_AUTH_TOKEN=your-token-here</div>
                        <div>JWT_SECRET=your-secret-key</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="bg-cyan-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
                    <div>
                      <strong className="text-slate-900 block">Deploy বাটনে ক্লিক করুন:</strong>
                      ২ মিনিটের মধ্যে Vercel আপনাকে একটি লাইভ পাবলিক লিঙ্ক দিবে: <code className="text-cyan-700 bg-cyan-100 px-1 py-0.5 rounded">https://inctl-wash-erp.vercel.app</code>। এখন মোবাইল, ট্যাব বা ল্যাপটপে এই লিংকে যেকেউ কাজ করতে পারবে!
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Guide 4: Google Drive Sync */}
            {activeOnlineGuide === "gdrive" && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <h4 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                    <Cloud size={16} className="text-blue-600" />
                    {guideLang === "bn" 
                      ? "পদ্ধতি ৪: গুগল ড্রাইভ (Google Drive) ১৫ জিবি ফ্রি অটো-ব্যাকআপ ও ক্লাউড ডাটাবেজ"
                      : "Method 4: Google Drive 15 GB Free Auto-Backup & Cloud Vault"}
                  </h4>
                  <p className="text-xs text-blue-800 mt-1">
                    {guideLang === "bn"
                      ? "প্রতিটি জিমেইল অ্যাকাউন্টে থাকা ১৫ জিবি ফ্রি গুগল ড্রাইভ স্টোরেজে আপনার ইআরপির সমস্ত ডাটাবেজ প্যাকেজ (Orders, Logs, Fabrics, Buyers) স্বয়ংক্রিয়ভাবে ব্যাকআপ রাখুন।"
                      : "Leverage 15 GB free Google Drive storage for automated daily snapshots, rollback preservation, and disaster recovery."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                      <Download size={14} className="text-blue-600" />
                      ১-ক্লিকে ম্যানুয়াল এক্সপোর্ট
                    </h5>
                    <p className="text-xs text-slate-600">
                      যেকোনো সময় উপরের <strong>Export Backup</strong> বাটন বা <strong>Google Drive</strong> ট্যাব থেকে সম্পূর্ণ ডাটাবেজ JSON ফাইলে ডাউনলোড করে গুগল ড্রাইভে সংরক্ষণ করতে পারেন।
                    </p>
                    <button
                      onClick={handleExportBackup}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 transition-all shadow"
                    >
                      <Download size={14} />
                      Export Database Package Now
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-1.5">
                      <RefreshCw size={14} className="text-emerald-600" />
                      rclone দিয়ে অটোমেটিক ব্যাকআপ
                    </h5>
                    <p className="text-xs text-slate-600">
                      উইন্ডোজ বা রাস্পবেরি পাই-তে rclone কনফিগার করে প্রতিদিন রাত ১২টায় অটো-সিঙ্ক করতে পারেন:
                    </p>
                    <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono overflow-x-auto">
rclone sync ./data/gdrive_backups gdrive:INCTL_ERP_Backups -v
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Guide 5: Factory Floor Mobile Data Entry */}
            {activeOnlineGuide === "mobile" && (
              <div className="space-y-6">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <h4 className="font-bold text-purple-950 text-sm flex items-center gap-2">
                    <Smartphone size={16} className="text-purple-600" />
                    {guideLang === "bn" 
                      ? "পদ্ধতি ৫: ফ্যাক্টরি ফ্লোর মোবাইল ও ট্যাবলেট লাইভ ডাটা এন্ট্রি নির্দেশিকা"
                      : "Method 5: Factory Floor Mobile & Tablet Live Data Entry Workflow"}
                  </h4>
                  <p className="text-xs text-purple-800 mt-1">
                    {guideLang === "bn"
                      ? "ফ্যাক্টরির ওয়াশ প্ল্যান্ট, ড্রাই প্রসেস, ওয়েট প্রসেস, ফেব্রিক সিপিল স্টোর কিংবা কোয়ালিটি টেবিলে অপারেটররা স্মার্টফোন দিয়ে কিভাবে দ্রুত ডাটা ইনপুট করবেন:"
                      : "Guide for operators and QC supervisors on how to log daily wash stages, fabric challans, and track deliveries using mobile devices."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">১</span>
                    <h5 className="font-bold text-slate-900 text-xs uppercase">মোবাইলে ওপেন করুন</h5>
                    <p className="text-xs text-slate-600">
                      স্মার্টফোনের ক্যামেরা দিয়ে উপরের <strong>QR Code</strong> স্ক্যান করুন অথবা Chrome/Safari ব্রাউজারে অনলাইন লিঙ্কটি প্রবেশ করিয়ে হোমস্ক্রিনে Add to Home Screen (PWA) করে রাখুন।
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">২</span>
                    <h5 className="font-bold text-slate-900 text-xs uppercase">অপারেটর লগইন</h5>
                    <p className="text-xs text-slate-600">
                      অ্যাডমিন প্যানেল থেকে দেওয়া ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন করুন (Operator বা Editor রোল)।
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">৩</span>
                    <h5 className="font-bold text-slate-900 text-xs uppercase">তাৎক্ষণিক এন্ট্রি ও সেভ</h5>
                    <p className="text-xs text-slate-600">
                      ফেব্রিক রিসিভ/ডেলিভারি চালান, ডেইলি ওয়াশ ফ্লোর প্রগ্রেস (Dry/Wet/Hydro/Dryer/QC) সাথে সাথে এন্ট্রি দিন। সাথে সাথে বায়ার ড্যাশবোর্ডে ফ্যাক্টরি KPI আপডেট হয়ে যাবে!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Complete Setup Guide File Download Box */}
            <div className="p-5 bg-slate-900 text-white rounded-xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">
                    {guideLang === "bn" ? "সম্পূর্ণ ফ্রি ক্লাউড ডকুমেন্টেশন গাইড (A to Z Markdown)" : "Complete Free Cloud Documentation Guide (A-to-Z Markdown)"}
                  </h4>
                  <p className="text-xs text-slate-400">
                    ফ্যাক্টরির আইটি টিম বা টেকনিশিয়ানের জন্য সম্পূর্ণ বাংলা ও ইংরেজি গাইডলাইন ডকুমেন্ট।
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  fetch("/docs/FREE_CLOUD_ONLINE_SETUP_A_TO_Z.md")
                    .then(r => r.text())
                    .then(txt => downloadTextFile("FREE_CLOUD_ONLINE_SETUP_A_TO_Z.md", txt))
                    .catch(() => toast.error("File download failed"));
                }}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow shrink-0 flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Download Complete Guide (.MD)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: USER MANAGEMENT                                                    */}
      {/* ========================================================================= */}
      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                <Users size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
                <p className="text-2xl font-black text-slate-900">{users.length}</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admins</p>
                <p className="text-2xl font-black text-slate-900">{users.filter(u => u.role === 'admin').length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
                <p className="text-2xl font-black text-emerald-700">{users.filter(u => u.status === 'active').length} Active</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Registered System Users</span>
              <span className="text-xs text-slate-500 font-medium">Super Admin: <strong>tanzirerp</strong> (Protected)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">User Details</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Access Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Loading directory...</td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">No users registered yet</td>
                    </tr>
                  ) : (
                    users.map(user => {
                      const isRowSuperAdmin = user.username.toLowerCase() === "tanzirerp";
                      const canModifyRow = isAdmin && !isRowSuperAdmin && (isSuperAdmin || user.role !== "admin");
                      
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center font-bold uppercase",
                                isRowSuperAdmin ? "bg-amber-100 text-amber-800 border-2 border-amber-300" : "bg-slate-200 text-slate-600"
                              )}>
                                {user.username.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-bold text-slate-900 uppercase tracking-tight">{user.username}</p>
                                  {isRowSuperAdmin && (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border border-amber-200">
                                      Super Admin 👑
                                    </span>
                                  )}
                                  {user.username.toLowerCase() === "admin" && (
                                    <span className="bg-slate-100 text-slate-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border border-slate-200">
                                      System Admin
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono">UID: {user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {canModifyRow ? (
                              <select 
                                value={user.role}
                                onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                className={cn(
                                  "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border-2 transition-all cursor-pointer hover:shadow-sm",
                                  user.role === 'wash_md' ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                  user.role === 'wash_manager' ? "bg-teal-50 text-teal-700 border-teal-300" :
                                  user.role === 'admin' ? "bg-red-50 text-red-700 border-red-200" :
                                  user.role === 'editor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  user.role === 'operator' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                  "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                {isSuperAdmin && <option value="admin">System Admin</option>}
                                {user.role === 'admin' && !isSuperAdmin && <option value="admin">System Admin</option>}
                                <option value="wash_md">Wash MD (Financial Access)</option>
                                <option value="wash_manager">Wash Manager (Financial Access)</option>
                                <option value="editor">Editor (Normal User)</option>
                                <option value="operator">Data Entry Operator</option>
                                <option value="viewer">Viewer (Normal User)</option>
                              </select>
                            ) : (
                              <span className={cn(
                                "text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border-2 inline-block opacity-80",
                                user.role === 'wash_md' ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                user.role === 'wash_manager' ? "bg-teal-50 text-teal-700 border-teal-300" :
                                user.role === 'admin' ? "bg-red-50 text-red-700 border-red-200" :
                                user.role === 'editor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                user.role === 'operator' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                "bg-blue-50 text-blue-700 border-blue-200"
                              )}>
                                {user.role === 'wash_md' ? 'WASH MD' :
                                 user.role === 'wash_manager' ? 'WASH MANAGER' :
                                 user.role === 'operator' ? 'DATA ENTRY OPERATOR' :
                                 user.role}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {canModifyRow ? (
                              <button 
                                  onClick={() => handleToggleStatus(user.id, user.status)}
                                  className="flex items-center group cursor-pointer"
                              >
                                  <span className={cn(
                                      "w-2.5 h-2.5 rounded-full inline-block mr-2 group-hover:scale-125 transition-transform",
                                      user.status === 'active' ? "bg-green-500 shadow-sm shadow-green-300" : "bg-slate-300"
                                  )} />
                                  <span className="text-xs font-bold text-slate-600 uppercase group-hover:text-slate-900">{user.status}</span>
                              </button>
                            ) : (
                              <div className="flex items-center opacity-80">
                                  <span className={cn(
                                      "w-2.5 h-2.5 rounded-full inline-block mr-2",
                                      user.status === 'active' ? "bg-green-500" : "bg-slate-300"
                                  )} />
                                  <span className="text-xs font-bold text-slate-600 uppercase">{user.status}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canModifyRow && (
                              <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-slate-300 hover:text-red-600 transition-colors p-2"
                                title="Remove User"
                              >
                                <UserMinus size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LOCAL PC & RASPBERRY PI HOSTING GUIDE                              */}
      {/* ========================================================================= */}
      {activeTab === "hosting" && (
        <div className="space-y-8">
          {/* Real-time Host Machine Card */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white border border-slate-700 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                    <Cpu size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Active Host Environment</h2>
                    <p className="text-xs text-slate-400">Automatic detection of your Local Machine or Raspberry Pi hardware</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-indigo-500/30">
                    OS: {hostInfo?.platform || "linux"} ({hostInfo?.arch || "x64"})
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-emerald-500/30">
                    Node: {hostInfo?.nodeVersion || process.version}
                  </span>
                  <span className="bg-blue-500/20 text-blue-300 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-blue-500/30">
                    Port: {hostInfo?.port || 3000}
                  </span>
                  {hostInfo?.isRaspberryPi && (
                    <span className="bg-rose-500/20 text-rose-300 text-xs font-bold px-3 py-1 rounded-lg border border-rose-500/30 flex items-center gap-1.5">
                      🍓 Raspberry Pi Hardware Detected
                    </span>
                  )}
                </div>
              </div>

              {/* Local Factory Network IPs */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl w-full lg:w-auto min-w-[320px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi size={14} className="text-emerald-400 animate-pulse" />
                    Factory LAN Access URL
                  </span>
                  <button 
                    onClick={fetchHostInfo}
                    className="text-slate-400 hover:text-white text-xs p-1 rounded"
                    title="Refresh Network Status"
                  >
                    <RefreshCw size={13} className={loadingHost ? "animate-spin" : ""} />
                  </button>
                </div>

                {hostInfo?.localIps && hostInfo.localIps.length > 0 ? (
                  <div className="space-y-1.5">
                    {hostInfo.localIps.map((ip) => {
                      const fullUrl = `http://${ip}:${hostInfo.port || 3000}`;
                      return (
                        <div key={ip} className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                          <code className="text-emerald-400 text-xs font-mono font-bold">{fullUrl}</code>
                          <button
                            onClick={() => handleCopy(fullUrl)}
                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 ml-2 transition-colors"
                            title="Copy LAN Link"
                          >
                            {copiedIp === fullUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      );
                    })}
                    <p className="text-[10px] text-slate-400 pt-1">
                      💡 Any device connected to factory Wi-Fi can open these URLs without internet!
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                    <code className="text-emerald-400 text-xs font-mono font-bold">http://localhost:3000</code>
                    <button
                      onClick={() => handleCopy("http://localhost:3000")}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 ml-2"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 1-Click Launchers Downloads */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
                  <Laptop size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Windows Local PC Launcher</h3>
                <p className="text-xs text-slate-500 mt-1">
                  1-Click batch file for Windows desktops/laptops. Starts server and opens browser automatically.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100">
                <a
                  href="/start-local.bat"
                  download="start-local.bat"
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Download size={14} />
                  Download start-local.bat
                </a>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-3">
                  <Cpu size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Raspberry Pi 24/7 Setup</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Automated bash script for RPi 3/4/5. Installs Node.js, configures PM2 daemon to auto-reboot on power outage.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100">
                <a
                  href="/setup-rpi.sh"
                  download="setup-rpi.sh"
                  className="w-full inline-flex items-center justify-center gap-2 bg-rose-600 text-white hover:bg-rose-500 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Download size={14} />
                  Download setup-rpi.sh
                </a>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
                  <Terminal size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900">Linux / Mac Shell Starter</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Portable launcher for Ubuntu, Debian, CentOS, or macOS servers with local SQLite persistence.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100">
                <a
                  href="/start-local.sh"
                  download="start-local.sh"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 text-white hover:bg-emerald-600 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  <Download size={14} />
                  Download start-local.sh
                </a>
              </div>
            </div>
          </div>

          {/* Step-by-Step Guides (Bengali & English) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                <Terminal size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  কীভাবে Raspberry Pi অথবা Local PC-তে হোস্ট করবেন (Step-by-Step Guide)
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed instructions in Bengali & English for deploying in factory premises
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Raspberry Pi Guide */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <span>🍓</span>
                  <span>Raspberry Pi (RPi 3/4/5) Factory Setup</span>
                </div>
                <ol className="text-xs text-slate-700 space-y-2.5 list-decimal pl-4">
                  <li>
                    <strong>Raspberry Pi OS ইনস্টল করুন:</strong> Raspberry Pi Imager দিয়ে 64-bit OS ফ্ল্যাশ করুন।
                  </li>
                  <li>
                    <strong>টার্মিনালে কমান্ডটি চালান:</strong>
                    <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] mt-1 overflow-x-auto">
                      chmod +x setup-rpi.sh && ./setup-rpi.sh
                    </div>
                  </li>
                  <li>
                    <strong>PM2 অটো-স্টার্ট সক্রিয় হবে:</strong> ফ্যাক্টরিতে বিদ্যুৎ চলে গেলেও বা RPi রিবুট হলেও স্বয়ংক্রিয়ভাবে ERP চালু থাকবে।
                  </li>
                  <li>
                    <strong>ফ্যাক্টরি Wi-Fi কানেকশন:</strong> রাউটার থেকে RPi-এর লোকাল আইপি (যেমন <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold">http://192.168.1.150:3000</code>) দিয়ে যেকোনো মোবাইল, ট্যাবলেট ও পিসি থেকে অফলাইনে কাজ করা যাবে!
                  </li>
                </ol>
              </div>

              {/* Local PC Guide */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                  <span>🖥️</span>
                  <span>Local Windows / Mac PC Hosting</span>
                </div>
                <ol className="text-xs text-slate-700 space-y-2.5 list-decimal pl-4">
                  <li>
                    <strong>Node.js ইনস্টল করুন:</strong> <a href="https://nodejs.org" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">nodejs.org</a> থেকে Node.js LTS ইনস্টল করে নিন।
                  </li>
                  <li>
                    <strong>এক ক্লিকে চালু করুন:</strong> ডাউনলোড করা <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold">start-local.bat</code> ফাইলে ডাবল-ক্লিক করুন।
                  </li>
                  <li>
                    <strong>স্বয়ংক্রিয় ব্রাউজার ওপেন:</strong> সার্ভার স্বয়ংক্রিয়ভাবে <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold">http://localhost:3000</code> ওপেন করবে।
                  </li>
                  <li>
                    <strong>ফ্যাক্টরির অন্য কম্পিউটার থেকে এক্সেস:</strong> একই Wi-Fi বা LAN কেবলে থাকা যেকোনো কম্পিউটার থেকে আপনার পিসির লোকাল আইপি দিয়ে লগইন করতে পারবে।
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GOOGLE DRIVE 15 GB FREE CLOUD STORAGE & BACKUP                     */}
      {/* ========================================================================= */}
      {activeTab === "gdrive" && (
        <div className="space-y-8">
          {/* 15 GB Free Storage Status Card */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white border border-blue-800 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                    <Cloud size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Google Drive 15 GB Free Cloud Database</h2>
                    <p className="text-xs text-blue-200">
                      Use Google Drive's 100% free 15 GB cloud storage quota to store and sync your Wash ERP database.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-blue-200 mb-1 font-mono">
                    <span>Active ERP Database Size: {((hostInfo?.dbFileSize || 1048576) / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>15,000 MB Free Quota (99.9% Available)</span>
                  </div>
                  <div className="w-full bg-slate-950/60 rounded-full h-3 p-0.5 border border-blue-500/30">
                    <div 
                      className="bg-emerald-400 h-2 rounded-full transition-all duration-500" 
                      style={{ width: "0.2%" }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={handleTriggerGdriveSync}
                  disabled={syncingGdrive}
                  className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-slate-950 px-5 py-3 rounded-xl font-bold text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={syncingGdrive ? "animate-spin" : ""} />
                  {syncingGdrive ? "Creating Snapshot..." : "Trigger Cloud Sync"}
                </button>

                <button
                  onClick={handleExportBackup}
                  className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl font-bold text-xs transition-all border border-white/20 active:scale-95"
                >
                  <Download size={16} />
                  Download Backup File
                </button>
              </div>
            </div>
          </div>

          {/* Two Ways to Use Google Drive */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Method 1: Google Drive Live SQLite Sync Folder */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Folder size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    পদ্ধতি ১: Google Drive ফোল্ডারে লাইভ ডাটাবেজ রাখা
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live SQLite DB inside Google Drive for Desktop or RPi rclone
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                আপনার পিসিতে <strong>Google Drive for Desktop</strong> ইনস্টল থাকলে এটি <code className="bg-slate-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">G:\My Drive</code> হিসেবে মাউন্ট হয়। ডাটাবেজ ফাইলটি সেখানে সেট করলে প্রতিটি অর্ডার এবং এন্ট্রি স্বয়ংক্রিয়ভাবে Google ক্লাউডে সিঙ্ক হয়ে যাবে!
              </p>

              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                  Google Drive Database File Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gdriveSyncFolder}
                    onChange={(e) => setGdriveSyncFolder(e.target.value)}
                    placeholder="e.g. G:\My Drive\INCTL_Wash_ERP\erp_database.sqlite"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleSwitchDbMode("gdrive", gdriveSyncFolder)}
                    disabled={savingDbMode || !gdriveSyncFolder}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Set Path
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-xl text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-blue-600" />
                <span>
                  <strong>Raspberry Pi ব্যবহারকারীদের জন্য:</strong> RPi-তে <code className="bg-blue-100 px-1 py-0.5 rounded">sudo apt install rclone</code> দিয়ে Google Drive মাউন্ট করে একই নিয়মে 15 GB ক্লাউড ডাটাবেজ ব্যবহার করতে পারবেন।
                </span>
              </div>
            </div>

            {/* Method 2: Instant Snapshot Export & Restore */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <HardDrive size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    পদ্ধতি ২: স্ন্যাপশট ব্যাকআপ এবং রিস্টোর
                  </h3>
                  <p className="text-xs text-slate-500">
                    One-click JSON snapshot download & instant database restore
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                আপনার সম্পূর্ণ ERP-র সকল অর্ডার, ডেইলিলগ এবং বায়ার ডাটাবেজ এক ক্লিকে ব্যাকআপ ফাইল হিসেবে ডাউনলোড করুন এবং যেকোনো সময় রিস্টোর করুন।
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleExportBackup}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all group"
                >
                  <Download size={24} className="text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-900">ডাউনলোড ব্যাকআপ</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">.json format</span>
                </button>

                <label className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl transition-all cursor-pointer group">
                  <Upload size={24} className={cn("text-emerald-600 mb-2 group-hover:scale-110 transition-transform", restoringFile && "animate-bounce")} />
                  <span className="text-xs font-bold text-slate-900">
                    {restoringFile ? "রিস্টোর হচ্ছে..." : "রিস্টোর ফাইল আপলোড"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Select .json backup</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFile}
                    disabled={restoringFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl text-[11px] text-emerald-800 leading-relaxed flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                <span>রিস্টোর করার সময় সুপার এডমিন (<strong>tanzirerp</strong>) অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে সুরক্ষিত থাকে।</span>
              </div>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Google Drive & Local Snapshot History ({backups.length})
              </span>
              <button 
                onClick={fetchBackups}
                className="text-slate-500 hover:text-slate-900 text-xs font-bold flex items-center gap-1"
              >
                <RefreshCw size={12} className={loadingBackups ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-100/70 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Snapshot Filename</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Created Timestamp</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingBackups ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading snapshots...</td>
                    </tr>
                  ) : backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400 italic">
                        No snapshots generated yet. Click "Trigger Cloud Sync" above to create one.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-50/50">
                        <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-800">
                          {b.filename}
                        </td>
                        <td className="px-6 py-3.5 text-xs font-mono text-slate-600">
                          {(b.sizeBytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-500">
                          {new Date(b.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={handleExportBackup}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Download size={13} />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DATABASE ENGINE SWITCHER                                           */}
      {/* ========================================================================= */}
      {activeTab === "database" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Active Database Engine Selection</h2>
              <p className="text-xs text-slate-500 mt-1">
                Choose how INCTL Wash ERP stores data. Switch between Local SQLite (PC/RPi), Google Drive Sync Folder, or Turso Cloud.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Local SQLite */}
              <button
                type="button"
                onClick={() => handleSwitchDbMode("local", "./data/erp_database.sqlite")}
                disabled={savingDbMode}
                className={cn(
                  "p-5 rounded-2xl border-2 text-left transition-all relative",
                  selectedDbMode === "local" || selectedDbMode === "sqlite"
                    ? "border-emerald-600 bg-emerald-50/40 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">💾</span>
                  {(selectedDbMode === "local" || selectedDbMode === "sqlite") && (
                    <span className="bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Local SQLite (PC / RPi)</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Stored directly on local storage at <code className="font-mono text-emerald-800 font-bold">./data/erp_database.sqlite</code>. Zero cloud dependency.
                </p>
              </button>

              {/* Google Drive Synced SQLite */}
              <button
                type="button"
                onClick={() => handleSwitchDbMode("gdrive")}
                disabled={savingDbMode}
                className={cn(
                  "p-5 rounded-2xl border-2 text-left transition-all relative",
                  selectedDbMode === "gdrive"
                    ? "border-blue-600 bg-blue-50/40 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">☁️</span>
                  {selectedDbMode === "gdrive" && (
                    <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Google Drive Synced SQLite</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pointed to your local Google Drive sync folder. Changes automatically sync to 15 GB free cloud.
                </p>
              </button>

              {/* Turso Cloud LibSQL */}
              <button
                type="button"
                onClick={() => handleSwitchDbMode("turso")}
                disabled={savingDbMode}
                className={cn(
                  "p-5 rounded-2xl border-2 text-left transition-all relative",
                  selectedDbMode === "turso"
                    ? "border-indigo-600 bg-indigo-50/40 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🌐</span>
                  {selectedDbMode === "turso" && (
                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Turso Cloud LibSQL</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Remote distributed database instance via libsql:// protocol for multi-region clustering.
                </p>
              </button>
            </div>
          </div>

          {/* Turso Cloud Config Form (If Turso is selected or Super Admin override) */}
          {isSuperAdmin && (
            <div className="bg-slate-900 rounded-2xl p-8 shadow-lg relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
                <div className="max-w-xl text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center">
                      <KeyRound size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Turso Cloud Credentials Injection</h2>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    As a Super Admin (<strong>tanzirerp</strong>), you can manually update Turso cloud credentials anytime. The credentials are encrypted and applied immediately.
                  </p>
                </div>
                
                <form onSubmit={handleSaveTurso} className="w-full md:w-auto flex-1 max-w-lg bg-slate-800/50 p-5 rounded-xl border border-slate-700/50 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Turso URL</label>
                    <input 
                      type="text"
                      value={tursoUrl}
                      onChange={e => setTursoUrl(e.target.value)}
                      placeholder="libsql://..."
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Turso Auth Token</label>
                    <div className="relative">
                      <input 
                        type={showTursoToken ? "text" : "password"}
                        value={tursoToken}
                        onChange={e => setTursoToken(e.target.value)}
                        placeholder="eyJhbG..."
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTursoToken(!showTursoToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none p-1 rounded transition-colors"
                        title={showTursoToken ? "Hide token" : "Show token"}
                      >
                        {showTursoToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={savingTurso}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2.5 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {savingTurso ? "Saving Configuration..." : "Inject Credentials"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SIA DECENTRALIZED CLOUD & AWESOME-SELFHOSTED INTEGRATION          */}
      {/* ========================================================================= */}
      {activeTab === "sia" && (
        <SiaBackupManager />
      )}

      {/* ========================================================================= */}
      {/* TAB 6: iOfficeAI / OfficeCLI AUTOMATION CENTER                             */}
      {/* ========================================================================= */}
      {activeTab === "cli" && (
        <OfficeCLICommandCenter />
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AionUI GLOBAL SUPER ADMIN OMNI CONTROL SUITE                      */}
      {/* ========================================================================= */}
      {activeTab === "aion" && (
        <AionSuperAdminControl />
      )}

      {/* Whitelist User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 space-y-6 my-8">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Whitelist New User</h2>
            
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type="text"
                      value={newUser.username}
                      onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase()})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      placeholder="e.g. wash_operator"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Temporary Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      required
                      type={showNewUserPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={e => setNewUser({...newUser, password: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors"
                      title={showNewUserPassword ? "Hide password" : "Show password"}
                    >
                      {showNewUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Role</label>
                  <select 
                    value={newUser.role}
                    onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    {isSuperAdmin && <option value="admin">Administrator (Full Access)</option>}
                    <option value="wash_md">Wash MD (Managing Director - Financial Metrics Access)</option>
                    <option value="wash_manager">Wash Manager (Operations & Financial Access)</option>
                    <option value="editor">Editor (Normal User - No Financial Access)</option>
                    <option value="operator">Data Entry Operator (Daily Logs - No Financial Access)</option>
                    <option value="viewer">Viewer (Normal User - Read Only)</option>
                  </select>
                  {!isSuperAdmin && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      * Only the Super Admin (<strong>tanzirerp</strong>) can whitelist another Administrator.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-[10px] text-blue-700 font-medium italic">
                  <ShieldAlert size={14} className="shrink-0" />
                  User will be whitelisted immediately on the active database engine.
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowNewUserPassword(false);
                    }}
                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
