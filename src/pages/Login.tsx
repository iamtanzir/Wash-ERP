import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldAlert, KeyRound, User, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";

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

      const contentType = res.headers.get("content-type");
      let data: any = {};
      
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else if (!res.ok) {
        const textError = await res.text();
        console.error("Server Error Response:", textError);
        throw new Error(`Server Error (${res.status}). This usually means Turso credentials are not set in Vercel environment variables.`);
      }

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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 selection:bg-blue-500/30 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[500px]"
      >
        <div className="bg-white rounded-[40px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden p-8 sm:p-12 md:p-16 space-y-10">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[24px] shadow-lg flex items-center justify-center text-white">
                <LogIn size={36} strokeWidth={2.5} />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-800 flex items-center justify-center gap-1">
                WASH <span className="text-blue-600">ERP</span>
              </h1>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-10 bg-slate-200" />
                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.4em]">Internal Data Hub</p>
                <div className="h-px w-10 bg-slate-200" />
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-6">
              {/* Username Field */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block px-1">User ID</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2">
                    <User className="text-slate-300" size={20} />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-4 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 text-lg"
                    placeholder="User ID Name"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block px-1">User Pass</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2">
                    <KeyRound className="text-slate-300" size={20} />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-4 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 text-lg"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative flex items-center justify-center gap-3 bg-[#020617] hover:bg-black text-white font-black py-5 px-8 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="text-lg uppercase tracking-wider">Enter ERP</span>
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
            </button>
          </form>

          {/* Compliance & Branding */}
          <div className="space-y-8 mt-10">
            <div className="p-5 bg-blue-50/30 border border-blue-50 rounded-2xl flex items-start gap-4">
              <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-[11px] leading-relaxed text-blue-900/60 font-medium italic">
                Notice: All activity is monitoring by authorized ID only. System access logs are maintained as per company policy.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col items-center space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Automatically Update Database
                </p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-medium text-slate-400">
                  Built with ❤️ <span className="text-slate-800 font-bold">Tanzir Ahmed.</span>
                </p>
                <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.3em]">Build v2.4.0-ERP</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

