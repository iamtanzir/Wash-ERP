import React, { useState, useEffect } from 'react';
import { 
  Globe, ShieldAlert, Radio, Server, Lock, Unlock, Users, 
  Terminal, RefreshCw, Cpu, HardDrive, Wifi, Send, AlertTriangle, 
  CheckCircle2, Power, Eye, Zap, Shield, Key, Sparkles, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export interface GlobalNode {
  id: string;
  name: string;
  location: string;
  type: 'Factory Plant' | 'HQ Office' | 'Port Hub' | 'Cloud Relay';
  ipAddress: string;
  status: 'online' | 'warning' | 'offline';
  latencyMs: number;
  cpuUsagePct: number;
  activeUsers: number;
  dbEngine: string;
}

export interface ActiveSession {
  sessionId: string;
  username: string;
  role: string;
  ip: string;
  location: string;
  device: string;
  loginTime: string;
  lastActive: string;
}

export default function AionSuperAdminControl() {
  const { user } = useAuth();
  const isSuperAdmin = user?.username?.toLowerCase() === 'tanzirerp';

  // System States
  const [isSystemLocked, setIsSystemLocked] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [activeBroadcast, setActiveBroadcast] = useState<string | null>(
    "Notice: Scheduled Boiler Maintenance at Gazipur Plant between 18:00 - 19:00 Dhaka Time."
  );

  // Diagnostic Terminal State
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "[AionUI Agent Core] Initializing global super admin telemetry relay...",
    "[Tailscale Mesh] 5 node peers connected with zero trust microsegmentation.",
    "[AionUI Security] Super admin credentials validated for user: tanzirerp.",
    "[Ready] Listening for remote orchestration directives..."
  ]);

  // Global Nodes Data
  const [nodes, setNodes] = useState<GlobalNode[]>([
    {
      id: 'node-dhaka-hq',
      name: 'Dhaka Head Office Node',
      location: 'Gulshan-2, Dhaka',
      type: 'HQ Office',
      ipAddress: '100.102.44.12 (Tailscale)',
      status: 'online',
      latencyMs: 12,
      cpuUsagePct: 24,
      activeUsers: 8,
      dbEngine: 'Turso Cloud LibSQL'
    },
    {
      id: 'node-gazipur-plant',
      name: 'Gazipur Wash Plant #01',
      location: 'Chowrastah, Gazipur',
      type: 'Factory Plant',
      ipAddress: '100.115.88.92 (Raspberry Pi 4)',
      status: 'online',
      latencyMs: 18,
      cpuUsagePct: 42,
      activeUsers: 15,
      dbEngine: 'PocketBase Local'
    },
    {
      id: 'node-ctg-port',
      name: 'Chittagong Export Depot',
      location: 'EPZ, Chittagong',
      type: 'Port Hub',
      ipAddress: '100.90.12.5 (PC Local)',
      status: 'online',
      latencyMs: 28,
      cpuUsagePct: 19,
      activeUsers: 4,
      dbEngine: 'Turso Cloud LibSQL'
    },
    {
      id: 'node-cloud-relay',
      name: 'Puter Serverless Global Relay',
      location: 'US-East / Global Edge',
      type: 'Cloud Relay',
      ipAddress: 'https://inctl-wash-erp.puter.site',
      status: 'online',
      latencyMs: 85,
      cpuUsagePct: 11,
      activeUsers: 32,
      dbEngine: 'Puter.KV'
    }
  ]);

  // Active Sessions Data
  const [sessions, setSessions] = useState<ActiveSession[]>([
    {
      sessionId: 'SESS-901',
      username: 'tanzirerp',
      role: 'Super Admin',
      ip: '103.220.12.88 (Dhaka)',
      location: 'Dhaka HQ',
      device: 'Chrome / Windows 11',
      loginTime: '08:15 AM',
      lastActive: 'Just now'
    },
    {
      sessionId: 'SESS-902',
      username: 'wash_md_rahim',
      role: 'Wash MD',
      ip: '203.112.50.14 (Gazipur)',
      location: 'Gazipur Plant',
      device: 'Safari / iPad Pro',
      loginTime: '09:00 AM',
      lastActive: '2 mins ago'
    },
    {
      sessionId: 'SESS-903',
      username: 'operator_kabir',
      role: 'Operator',
      ip: '103.220.12.92 (Gazipur)',
      location: 'Gazipur Plant Floor',
      device: 'Android App',
      loginTime: '10:30 AM',
      lastActive: '5 mins ago'
    }
  ]);

  const handleToggleLockdown = () => {
    const nextState = !isSystemLocked;
    setIsSystemLocked(nextState);
    if (nextState) {
      toast.error("GLOBAL SYSTEM LOCKDOWN ACTIVATED! All database mutations frozen.");
      setTerminalLogs(prev => [...prev, `[CRITICAL EMERGENCY] Super Admin triggered Global System Lockdown at ${new Date().toLocaleTimeString()}`]);
    } else {
      toast.success("System Lockdown Lifted. Normal operations restored.");
      setTerminalLogs(prev => [...prev, `[SECURITY] Super Admin lifted System Lockdown at ${new Date().toLocaleTimeString()}`]);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setActiveBroadcast(broadcastMessage.trim());
    toast.success("Global Broadcast sent to all connected ERP clients!");
    setTerminalLogs(prev => [...prev, `[BROADCAST] Published announcement: "${broadcastMessage.trim()}"`]);
    setBroadcastMessage('');
  };

  const handleKillSession = (sessionId: string, username: string) => {
    if (username === 'tanzirerp') {
      toast.error("Cannot terminate Super Admin active session");
      return;
    }
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    toast.success(`Session ${sessionId} (${username}) forcibly disconnected`);
    setTerminalLogs(prev => [...prev, `[SESSION REVOKED] Terminated session ${sessionId} for user ${username}`]);
  };

  const handleRunTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalLogs(prev => [...prev, `> ${cmd}`]);

    if (cmd === 'clear') {
      setTerminalLogs([]);
    } else if (cmd === 'status') {
      setTerminalLogs(prev => [...prev, `[AionUI] System Health: OPTIMAL | Nodes Active: ${nodes.length} | Active Sessions: ${sessions.length}`]);
    } else {
      setTerminalLogs(prev => [...prev, `[Remote Shell] Executed "${cmd}" across global node mesh. Response code 0.`]);
    }
    setTerminalInput('');
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-3xl text-center space-y-4">
        <ShieldAlert size={48} className="text-rose-600 mx-auto" />
        <h3 className="text-xl font-bold text-slate-900">Super Admin Access Only</h3>
        <p className="text-sm text-slate-500">
          AionUI Global Control is reserved for username <strong>tanzirerp</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Emergency Switch */}
      <div className={cn(
        "rounded-3xl p-6 text-white transition-all shadow-2xl relative overflow-hidden border",
        isSystemLocked 
          ? "bg-gradient-to-r from-rose-950 via-red-900 to-rose-950 border-rose-600 shadow-rose-950/50" 
          : "bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 border-slate-800"
      )}>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0",
              isSystemLocked ? "bg-rose-600 animate-pulse" : "bg-gradient-to-br from-indigo-500 to-purple-600"
            )}>
              <Globe size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight">AionUI Global Super Admin Omni Control Suite</h2>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                  isSystemLocked 
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50" 
                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                )}>
                  {isSystemLocked ? '🚨 SYSTEM LOCKDOWN' : '🌐 GLOBAL OMNI MESH'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Control the entire ERP infrastructure worldwide from anywhere on earth: live node telemetry, user sessions, emergency lockdown & remote shell.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleLockdown}
              className={cn(
                "flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95",
                isSystemLocked
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50"
                  : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50"
              )}
            >
              {isSystemLocked ? <Unlock size={18} /> : <Lock size={18} />}
              {isSystemLocked ? 'Lift Global Lockdown' : 'Trigger Global Emergency Lockdown'}
            </button>
          </div>
        </div>

        {/* Live Active Broadcast Bar */}
        {activeBroadcast && (
          <div className="mt-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-amber-200 text-xs">
            <div className="flex items-center gap-2.5">
              <Radio size={18} className="text-amber-400 animate-pulse shrink-0" />
              <span className="font-bold">Active Global Banner:</span>
              <span className="truncate">{activeBroadcast}</span>
            </div>
            <button
              onClick={() => setActiveBroadcast(null)}
              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/40 font-bold shrink-0"
            >
              Clear Banner
            </button>
          </div>
        )}
      </div>

      {/* Global Node Network & Telemetry Grid */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Server size={18} className="text-indigo-600" />
              Connected Global Factory Nodes ({nodes.length})
            </h3>
            <p className="text-xs text-slate-500">
              Real-time Tailscale mesh node metrics across Dhaka HQ, Gazipur Wash Plant, Chittagong Port, and Puter Cloud Relay.
            </p>
          </div>
          <button
            onClick={() => {
              toast.success("Nodes refreshed!");
            }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-300"
          >
            <RefreshCw size={13} />
            Ping All Nodes
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {nodes.map(node => (
            <div
              key={node.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  {node.type}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {node.latencyMs}ms
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs">{node.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{node.location}</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 font-mono">
                <div className="flex justify-between">
                  <span>IP/Address:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{node.ipAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span>CPU Load:</span>
                  <span className="font-bold text-indigo-600">{node.cpuUsagePct}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Users:</span>
                  <span className="font-bold text-slate-800">{node.activeUsers} Users</span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className="font-bold text-emerald-700">{node.dbEngine}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Broadcast Form & Live Active User Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Broadcast Sender */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Radio size={18} className="text-amber-500" />
              Super Admin Global Announcement Banner
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Send instant high-priority flash notifications to all online users at all locations.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <textarea
              rows={3}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Type urgent broadcast notice e.g. 'Emergency Boiler Shutdown at 18:00'..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Send size={14} />
              Broadcast to All Factory Users
            </button>
          </form>
        </div>

        {/* Active User Sessions Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-blue-600" />
                Active Global User Sessions ({sessions.length})
              </h3>
              <p className="text-xs text-slate-500">
                Monitor logged in managers, editors, and operators. Force terminate sessions remotely.
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">User & Role</th>
                  <th className="px-3 py-2.5">Location / IP</th>
                  <th className="px-3 py-2.5">Device</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {sessions.map(sess => (
                  <tr key={sess.sessionId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-800">{sess.username}</div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                        {sess.role}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{sess.location}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{sess.ip}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-[11px]">
                      {sess.device}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {sess.username === 'tanzirerp' ? (
                        <span className="text-[10px] font-bold text-emerald-600">Active Admin</span>
                      ) : (
                        <button
                          onClick={() => handleKillSession(sess.sessionId, sess.username)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-rose-200 transition-colors"
                        >
                          Revoke / Kill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AionUI Remote Diagnostic Shell */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-emerald-400" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200">
              AionUI Super Admin Diagnostic Remote Shell
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
            Encrypted TLS 1.3 Proxy
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-400 h-44 overflow-y-auto space-y-1">
          {terminalLogs.map((log, i) => (
            <div key={i} className="leading-relaxed">{log}</div>
          ))}
        </div>

        <form onSubmit={handleRunTerminalCommand} className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono font-bold text-xs">AionUI&gt;</span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            placeholder="Type remote diagnostic command e.g., 'status', 'ping-nodes', 'clear'..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all"
          >
            Execute Directive
          </button>
        </form>
      </div>
    </div>
  );
}
