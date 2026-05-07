import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldAlert, KeyRound, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Login successful");
        await refreshUser();
        navigate("/", { replace: true });
      } else {
        throw new Error(data.error || "Login failed");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-blue-500/30 font-sans relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        <div className="bg-white rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden p-8 sm:p-14 space-y-10 border border-white/20">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="group relative">
              <div className="absolute inset-0 bg-blue-600 rounded-[32px] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] shadow-2xl flex items-center justify-center text-white transform transition-transform group-hover:scale-105 duration-500">
                <LogIn size={42} strokeWidth={2.5} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter">
                WASH <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">ERP</span>
              </h1>
              <div className="flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-slate-200" />
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] italic">Internal Data Hub</p>
                <div className="h-px w-8 bg-slate-200" />
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-5">
              {/* Username Field */}
              <div className="group space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest transition-colors group-focus-within:text-blue-600">User Identification</label>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 border-r border-slate-100 pr-5 box-content">
                    <User className="text-slate-300 transition-colors group-focus-within:text-blue-500" size={18} />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-[72px] pr-8 py-5 focus:bg-white focus:border-blue-100 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-lg"
                    placeholder="User ID Name"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="group space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest transition-colors group-focus-within:text-blue-600">Secure Token</label>
                </div>
                <div className="relative">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 border-r border-slate-100 pr-5 box-content">
                    <KeyRound className="text-slate-300 transition-colors group-focus-within:text-blue-500" size={18} />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl pl-[72px] pr-8 py-5 focus:bg-white focus:border-blue-100 focus:ring-8 focus:ring-blue-500/5 outline-none transition-all font-bold text-slate-700 placeholder:text-slate-300 text-lg tracking-[0.25em]"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative flex items-center justify-center gap-4 bg-slate-950 hover:bg-black text-white font-black py-5 px-8 rounded-2xl shadow-2xl shadow-slate-900/20 transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              {loading ? (
                <Loader2 size={24} className="animate-spin text-blue-400" />
              ) : (
                <>
                  <span className="text-lg tracking-wide">Enter System</span>
                  <LogIn size={20} className="group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Compliance & Branding */}
          <div className="space-y-8">
            <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 border border-slate-100">
                <ShieldAlert size={16} className="text-blue-600" />
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500 font-bold italic">
                Notice: All activity is monitored. Authorized personnels only. System access logs are maintained as per company audit protocols.
              </p>
            </div>

            <div className="flex flex-col items-center space-y-6 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  Secure Node Primary Terminal
                </p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[12px] font-bold text-slate-400">
                  Built with ❤️ <span className="text-slate-900">Tanzir Ahmed.</span>
                </p>
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Build v2.4.0-ERP</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

