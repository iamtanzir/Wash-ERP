import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  CheckCircle2,
  Wrench,
  MessageSquare,
  RefreshCw,
  Download,
  Copy,
  Check,
  ArrowRight,
  Plus,
  Server,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

interface QualityCheck {
  id: string;
  file_no: string;
  buyer: string;
  wash_type: string;
  shade_result: "OK" | "Light" | "Dark" | "Reject";
  shrinkage_pct: string;
  status: "Pass" | "Re-Wash" | "Hold";
  inspector: string;
  remarks: string;
  created_at?: string;
}

interface MaintenanceRequest {
  id: string;
  machine_name: string;
  machine_type: "Front-Load Washer" | "Hydro Extractor" | "Tumble Dryer" | "Laser / Ozone" | "Boiler / Chiller";
  issue: string;
  priority: "Low" | "Normal" | "Urgent";
  status: "New Request" | "In Repair" | "Repaired";
  assigned_to: string;
  created_at?: string;
}

interface ChatterMessage {
  id: string;
  ref_no: string;
  author: string;
  tag: "Note" | "Delay Alert" | "Recipe Update" | "QC Flag";
  message: string;
  created_at?: string;
}

export default function EnterpriseOpsSuite({
  defaultTab = "kanban"
}: {
  defaultTab?: "kanban" | "quality" | "chatter" | "connector";
}) {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<"kanban" | "quality" | "chatter" | "connector">(defaultTab);

  // Live Orders for Kanban
  const { data: orders = [], isLoading: loadingOrders } = useQuery<any[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Quality Checks
  const { data: qualityChecks = [] } = useQuery<QualityCheck[]>({
    queryKey: ["erp_quality_checks"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_quality_checks");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Maintenance Requests
  const { data: maintenanceList = [] } = useQuery<MaintenanceRequest[]>({
    queryKey: ["erp_maintenance"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_maintenance");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Chatter Logs
  const { data: chatterLogs = [] } = useQuery<ChatterMessage[]>({
    queryKey: ["erp_chatter"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_chatter");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Forms State
  const [qcForm, setQcForm] = useState({
    file_no: "",
    buyer: "",
    wash_type: "Enzyme Wash",
    shade_result: "OK" as QualityCheck["shade_result"],
    shrinkage_pct: "1.5%",
    status: "Pass" as QualityCheck["status"],
    remarks: ""
  });

  const [maintForm, setMaintForm] = useState({
    machine_name: "",
    machine_type: "Front-Load Washer" as MaintenanceRequest["machine_type"],
    issue: "",
    priority: "Normal" as MaintenanceRequest["priority"],
    assigned_to: ""
  });

  const [chatterForm, setChatterForm] = useState({
    ref_no: "",
    tag: "Note" as ChatterMessage["tag"],
    message: ""
  });

  // JSON-RPC Connector State
  const [rpcUrl, setRpcUrl] = useState("http://localhost:8069");
  const [rpcDb, setRpcDb] = useState("rmg_wash_erp");
  const [rpcUser, setRpcUser] = useState("admin");
  const [rpcPassword, setRpcPassword] = useState("");
  const [rpcMeta, setRpcMeta] = useState<{
    configured: boolean;
    serverVersion: string | null;
    installedModules: { name: string; shortdesc: string }[];
    lastSyncAt: string | null;
  }>({ configured: false, serverVersion: null, installedModules: [], lastSyncAt: null });
  const [connectingRpc, setConnectingRpc] = useState(false);
  const [syncingRpc, setSyncingRpc] = useState(false);
  const [pullModel, setPullModel] = useState<"res.partner" | "mrp.production" | "purchase.order" | "hr.employee" | "maintenance.equipment">("res.partner");
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/rpc-bridge/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setRpcUrl(data.url || "http://localhost:8069");
          setRpcDb(data.db || "rmg_wash_erp");
          setRpcUser(data.username || "admin");
          setRpcMeta({
            configured: Boolean(data.configured),
            serverVersion: data.serverVersion || null,
            installedModules: data.installedModules || [],
            lastSyncAt: data.lastSyncAt || null
          });
        }
      })
      .catch(() => {});
  }, []);

  const updateOrderStageMutation = useMutation({
    mutationFn: async ({ id, wash_status }: { id: string; wash_status: string }) => {
      const res = await fetch(`/api/db/erp_orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wash_status })
      });
      if (!res.ok) throw new Error("Failed to update order stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Kanban stage updated!");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const addQcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/db/erp_quality_checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...qcForm,
          inspector: user?.username || "operator",
          created_at: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error("Failed to record QC inspection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_quality_checks"] });
      toast.success("Quality Check saved!");
      setQcForm({ ...qcForm, file_no: "", buyer: "", remarks: "" });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const addMaintMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/db/erp_maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...maintForm,
          status: "New Request",
          created_at: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error("Failed to submit maintenance request");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_maintenance"] });
      toast.success("Maintenance ticket logged!");
      setMaintForm({ ...maintForm, machine_name: "", issue: "", assigned_to: "" });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const updateMaintStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MaintenanceRequest["status"] }) => {
      const res = await fetch(`/api/db/erp_maintenance/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update ticket");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_maintenance"] });
      toast.success("Maintenance status updated!");
    }
  });

  const addChatterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/db/erp_chatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...chatterForm,
          author: user?.username || "operator",
          created_at: new Date().toISOString()
        })
      });
      if (!res.ok) throw new Error("Failed to post chatter note");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erp_chatter"] });
      toast.success("Activity posted to Chatter!");
      setChatterForm({ ...chatterForm, ref_no: "", message: "" });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const handleConnectRpc = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectingRpc(true);
    try {
      const res = await fetch("/api/rpc-bridge/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rpcUrl, db: rpcDb, username: rpcUser, password: rpcPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setRpcMeta({
        configured: true,
        serverVersion: data.serverVersion,
        installedModules: data.installedModules || [],
        lastSyncAt: new Date().toISOString()
      });
      toast.success(data.message || "Connected to External ERP JSON-RPC Server!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConnectingRpc(false);
    }
  };

  const handlePushRpc = async () => {
    setSyncingRpc(true);
    try {
      const res = await fetch("/api/rpc-bridge/sync/push", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Push sync failed");
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingRpc(false);
    }
  };

  const handlePullRpc = async () => {
    setSyncingRpc(true);
    try {
      const res = await fetch("/api/rpc-bridge/sync/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: pullModel })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pull sync failed");
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingRpc(false);
    }
  };

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const stageBuckets = [
    { key: "Pending", label: "Pending / Queue", next: "In Wash", badge: "bg-slate-200 text-slate-800" },
    { key: "In Wash", label: "In Wash / Process", next: "Ready", badge: "bg-blue-100 text-blue-800" },
    { key: "Ready", label: "Ready for Delivery", next: "Completed", badge: "bg-amber-100 text-amber-800" },
    { key: "Completed", label: "Completed / Done", next: null, badge: "bg-emerald-100 text-emerald-800" }
  ];

  const getBucketOrders = (stageKey: string) =>
    orders
      .filter((o) => {
        const st = String(o.wash_status || "Pending").toLowerCase();
        if (stageKey === "Pending") return st.includes("pend") || st === "new" || !o.wash_status;
        if (stageKey === "In Wash") return st.includes("wash") || st.includes("run") || st.includes("prog");
        if (stageKey === "Ready") return st.includes("ready") || st.includes("qc");
        return st.includes("comp") || st.includes("deliv") || st.includes("done") || st.includes("clos");
      })
      .slice(0, 15);

  const dockerUpCmd = "docker compose -f docker-compose.rmg-erp.yml up -d";
  const localBuildCmd = "npm install && npm run build && npm start";

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-purple-700 text-white text-[10px] font-black px-2.5 py-1 rounded uppercase tracking-wider">
              Enterprise Operations Suite • Open Source Core
            </span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">
              100% Free Self-Hosted Source Code
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            RMG Wash Operations, Quality, Maintenance & JSON-RPC Bridge
          </h2>
          <p className="text-xs text-slate-500">
            Modular open-source ERP workflows (Kanban MRP, Quality Checks, Machine Maintenance, Activity Chatter) + standard JSON-RPC 2.0 server sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("kanban")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors",
              subTab === "kanban" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Layers size={14} /> Kanban MRP
          </button>
          <button
            type="button"
            onClick={() => setSubTab("quality")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors",
              subTab === "quality" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <Wrench size={14} /> Quality & Maintenance
          </button>
          <button
            type="button"
            onClick={() => setSubTab("chatter")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors",
              subTab === "chatter" ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
          >
            <MessageSquare size={14} /> Chatter ({chatterLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("connector")}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors",
              subTab === "connector" ? "bg-purple-700 text-white border-purple-700" : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
            )}
          >
            <Server size={14} /> Self-Host & JSON-RPC
          </button>
        </div>
      </div>

      {/* SUBTAB 1: KANBAN MRP PIPELINE */}
      {subTab === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stageBuckets.map((bucket) => {
            const items = getBucketOrders(bucket.key);
            return (
              <div key={bucket.key} className="bg-slate-100/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{bucket.label}</span>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", bucket.badge)}>
                    {items.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {loadingOrders ? (
                    <div className="text-xs text-slate-400 py-6 text-center">Loading wash batches...</div>
                  ) : items.length === 0 ? (
                    <div className="bg-white/60 border border-dashed border-slate-300 rounded-xl p-4 text-center text-[11px] text-slate-400">
                      No orders in this stage
                    </div>
                  ) : (
                    items.map((o) => (
                      <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-900">{o.buyer || "Buyer"}</p>
                            <p className="text-[11px] font-mono font-bold text-blue-700">{o.file_no || o.id}</p>
                          </div>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {Number(o.order_qty || 0).toLocaleString()} Pcs
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2">
                          <span>Style: <strong>{o.style_no || "-"}</strong></span>
                          <span>• {o.wash_type || "Standard"}</span>
                        </div>
                        {bucket.next && (
                          <button
                            type="button"
                            onClick={() => updateOrderStageMutation.mutate({ id: o.id, wash_status: bucket.next! })}
                            disabled={updateOrderStageMutation.isPending}
                            className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                          >
                            Move to {bucket.next} <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUBTAB 2: QUALITY CHECKS & MACHINE MAINTENANCE */}
      {subTab === "quality" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quality Control (quality.check) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Quality Checkpoints (quality.check)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">{qualityChecks.length} checks</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!qcForm.file_no || !qcForm.buyer) {
                  toast.error("File No and Buyer are required");
                  return;
                }
                addQcMutation.mutate();
              }}
              className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200"
            >
              <input
                type="text"
                placeholder="File / Job No *"
                value={qcForm.file_no}
                onChange={(e) => setQcForm({ ...qcForm, file_no: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Buyer *"
                value={qcForm.buyer}
                onChange={(e) => setQcForm({ ...qcForm, buyer: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"
              />
              <select
                value={qcForm.shade_result}
                onChange={(e) => setQcForm({ ...qcForm, shade_result: e.target.value as any })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="OK">Shade: OK (Approved)</option>
                <option value="Light">Shade: Too Light</option>
                <option value="Dark">Shade: Too Dark</option>
                <option value="Reject">Shade: Reject</option>
              </select>
              <select
                value={qcForm.status}
                onChange={(e) => setQcForm({ ...qcForm, status: e.target.value as any })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="Pass">Result: PASS</option>
                <option value="Re-Wash">Result: RE-WASH</option>
                <option value="Hold">Result: QC HOLD</option>
              </select>
              <input
                type="text"
                placeholder="Wash Type & Shrinkage %"
                value={qcForm.wash_type}
                onChange={(e) => setQcForm({ ...qcForm, wash_type: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none col-span-2"
              />
              <button
                type="submit"
                disabled={addQcMutation.isPending}
                className="col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Log Quality Check
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {qualityChecks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No quality checks recorded yet.</p>
              ) : (
                qualityChecks.map((qc) => (
                  <div key={qc.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{qc.file_no}</span>{" "}
                      <span className="text-slate-500">({qc.buyer})</span>
                      <div className="text-[11px] text-slate-500">
                        {qc.wash_type} • Shade: <strong>{qc.shade_result}</strong> • By {qc.inspector}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded uppercase",
                        qc.status === "Pass"
                          ? "bg-emerald-100 text-emerald-800"
                          : qc.status === "Re-Wash"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      )}
                    >
                      {qc.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Plant Maintenance (maintenance.request) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Wrench size={18} className="text-amber-600" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Wash Plant Maintenance (maintenance.request)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">{maintenanceList.length} tickets</span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!maintForm.machine_name || !maintForm.issue) {
                  toast.error("Machine Name and Issue are required");
                  return;
                }
                addMaintMutation.mutate();
              }}
              className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200"
            >
              <input
                type="text"
                placeholder="Machine ID / No (e.g. Washer-04) *"
                value={maintForm.machine_name}
                onChange={(e) => setMaintForm({ ...maintForm, machine_name: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-blue-500"
              />
              <select
                value={maintForm.machine_type}
                onChange={(e) => setMaintForm({ ...maintForm, machine_type: e.target.value as any })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="Front-Load Washer">Front-Load Washer</option>
                <option value="Hydro Extractor">Hydro Extractor</option>
                <option value="Tumble Dryer">Tumble Dryer</option>
                <option value="Laser / Ozone">Laser / Ozone</option>
                <option value="Boiler / Chiller">Boiler / Chiller</option>
              </select>
              <input
                type="text"
                placeholder="Issue / Breakdown description *"
                value={maintForm.issue}
                onChange={(e) => setMaintForm({ ...maintForm, issue: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none col-span-2"
              />
              <select
                value={maintForm.priority}
                onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value as any })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
              >
                <option value="Low">Priority: Low</option>
                <option value="Normal">Priority: Normal</option>
                <option value="Urgent">Priority: URGENT</option>
              </select>
              <input
                type="text"
                placeholder="Technician Name"
                value={maintForm.assigned_to}
                onChange={(e) => setMaintForm({ ...maintForm, assigned_to: e.target.value })}
                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
              />
              <button
                type="submit"
                disabled={addMaintMutation.isPending}
                className="col-span-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Create Maintenance Ticket
              </button>
            </form>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {maintenanceList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">All washing machines operating normally.</p>
              ) : (
                maintenanceList.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">
                        {m.machine_name} <span className="text-slate-500 font-normal">({m.machine_type})</span>
                      </div>
                      <div className="text-[11px] text-slate-600">{m.issue}</div>
                    </div>
                    <select
                      value={m.status}
                      onChange={(e) => updateMaintStatusMutation.mutate({ id: m.id, status: e.target.value as any })}
                      className={cn(
                        "text-[10px] font-black px-2 py-1 rounded border outline-none",
                        m.status === "Repaired"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : m.status === "In Repair"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-rose-100 text-rose-800 border-rose-200"
                      )}
                    >
                      <option value="New Request">New Request</option>
                      <option value="In Repair">In Repair</option>
                      <option value="Repaired">Repaired</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: ACTIVITY CHATTER LOG */}
      {subTab === "chatter" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Floor Chatter & Activity Thread (mail.message)</h3>
              <p className="text-xs text-slate-500">Order notes, chemical recipe updates, and buyer delay flags persisted in ERP DB.</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!chatterForm.message.trim()) return;
              addChatterMutation.mutate();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              placeholder="File / Order Ref (e.g. JOB-1042)"
              value={chatterForm.ref_no}
              onChange={(e) => setChatterForm({ ...chatterForm, ref_no: e.target.value })}
              className="sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-blue-500"
            />
            <select
              value={chatterForm.tag}
              onChange={(e) => setChatterForm({ ...chatterForm, tag: e.target.value as any })}
              className="sm:w-40 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
            >
              <option value="Note">Internal Note</option>
              <option value="Recipe Update">Recipe Update</option>
              <option value="Delay Alert">Delay Alert</option>
              <option value="QC Flag">QC Flag</option>
            </select>
            <input
              type="text"
              placeholder="Write activity log or wash floor update..."
              value={chatterForm.message}
              onChange={(e) => setChatterForm({ ...chatterForm, message: e.target.value })}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={addChatterMutation.isPending}
              className="bg-purple-700 hover:bg-purple-800 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Send size={13} /> Post
            </button>
          </form>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {chatterLogs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No chatter messages yet.</p>
            ) : (
              chatterLogs.map((msg) => (
                <div key={msg.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-black text-slate-900">{msg.author}</span>
                      {msg.ref_no && (
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {msg.ref_no}
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded uppercase">
                        {msg.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: SELF-HOSTED SOURCE SETUP + LIVE JSON-RPC BRIDGE */}
      {subTab === "connector" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Free Self-Hosted Source Setup */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">100% Free Self-Hosted Source Setup</h3>
                <p className="text-xs text-slate-500">
                  Zero license fee Docker + PostgreSQL 16 + Parquet stack for Oracle Cloud VM or PC
                </p>
              </div>
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Option A: Self-Hosted Docker Stack (0 Taka)</span>
                <button
                  type="button"
                  onClick={() => copySnippet(dockerUpCmd, "docker")}
                  className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  {copiedCmd === "docker" ? <Check size={12} /> : <Copy size={12} />} Copy
                </button>
              </div>
              <div className="break-all text-emerald-300">{dockerUpCmd}</div>

              <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span>Option B: Run Native Source Code Directly</span>
                <button
                  type="button"
                  onClick={() => copySnippet(localBuildCmd, "local")}
                  className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                >
                  {copiedCmd === "local" ? <Check size={12} /> : <Copy size={12} />} Copy
                </button>
              </div>
              <div className="break-all text-amber-300">{localBuildCmd}</div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <a
                href="/api/rpc-bridge/docker-compose"
                className="inline-flex items-center gap-2 bg-purple-700 hover:bg-purple-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <Download size={14} /> Download docker-compose.rmg-erp.yml
              </a>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-900">
              <strong>Oracle Cloud / PC Hosting:</strong> আপনার ফ্রি Oracle Ubuntu VM বা অফিস PC-তে এই Docker Compose রান করলে কোনো লাইসেন্স ফি ছাড়াই সম্পূর্ণ সিস্টেম চলবে এবং ডান পাশের JSON-RPC ব্রিজ দিয়ে এক্সটার্নাল সার্ভারের সাথে লাইভ ডাটা সিঙ্ক করবে।
            </div>
          </div>

          {/* Right: Live JSON-RPC 2.0 Two-Way Connector */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Live JSON-RPC 2.0 ERP Connector</h3>
                <p className="text-xs text-slate-500">Connect and sync Buyers, MRP Orders & Employees via standard /jsonrpc protocol.</p>
              </div>
              {rpcMeta.configured && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                  {rpcMeta.serverVersion || "Connected"}
                </span>
              )}
            </div>

            <form onSubmit={handleConnectRpc} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">RPC Server URL</label>
                  <input
                    type="text"
                    value={rpcUrl}
                    onChange={(e) => setRpcUrl(e.target.value)}
                    placeholder="http://localhost:8069"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Database Name</label>
                  <input
                    type="text"
                    value={rpcDb}
                    onChange={(e) => setRpcDb(e.target.value)}
                    placeholder="rmg_wash_erp"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Username / Email</label>
                  <input
                    type="text"
                    value={rpcUser}
                    onChange={(e) => setRpcUser(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Password / API Key</label>
                  <input
                    type="password"
                    value={rpcPassword}
                    onChange={(e) => setRpcPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {isAdmin && (
                <button
                  type="submit"
                  disabled={connectingRpc}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {connectingRpc ? "Authenticating via /jsonrpc..." : "Test & Save JSON-RPC Connection"}
                </button>
              )}
            </form>

            {isAdmin && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handlePushRpc}
                    disabled={syncingRpc}
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Push RMG Buyers → External Server (res.partner)
                  </button>
                </div>

                <div className="flex gap-2">
                  <select
                    value={pullModel}
                    onChange={(e) => setPullModel(e.target.value as any)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none"
                  >
                    <option value="res.partner">res.partner (Buyers / Vendors)</option>
                    <option value="mrp.production">mrp.production (Work Orders)</option>
                    <option value="purchase.order">purchase.order (Purchase Orders)</option>
                    <option value="hr.employee">hr.employee (HR Staff)</option>
                    <option value="maintenance.equipment">maintenance.equipment (Machines)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handlePullRpc}
                    disabled={syncingRpc}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={syncingRpc ? "animate-spin" : ""} /> Pull into ERP
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
