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
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 selection:bg-blue-500/30 font-sans overflow-y-auto py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px]"
      >
        <div className="overflow-hidden px-8 pt-5 pb-8 sm:px-10 sm:pt-7 sm:pb-10 space-y-7 transition-all">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[20px] shadow-lg flex items-center justify-center text-white">
                <LogIn size={32} strokeWidth={2.5} />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-1">
                WASH <span className="text-blue-500">ERP</span>
              </h1>
              <div className="flex items-center justify-center gap-3 opacity-60">
                <div className="h-px w-8 bg-slate-700" />
                <p className="text-slate-100 font-bold text-[9px] uppercase tracking-[0.4em]">Internal Data Hub</p>
                <div className="h-px w-8 bg-slate-700" />
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
              {/* Username Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">USER ID</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2">
                    <User className="text-slate-300" size={18} />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="User ID Name"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">USER PASS</label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2">
                    <KeyRound className="text-slate-300" size={18} />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-8 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              <span className="text-base uppercase tracking-wider">Enter ERP</span>
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
            </button>
          </form>

          {/* Compliance & Branding */}
          <div className="space-y-6 pt-2">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3 backdrop-blur-sm">
              <Shield size={18} className="text-blue-400 shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-[10px] leading-relaxed text-blue-100/40 font-medium italic">
                Notice: All activity is monitoring by authorized ID only. System access logs are maintained as per company policy.
              </p>
            </div>

            <div className="pt-5 border-t border-slate-800 flex flex-col items-center space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  AUTOMATICALLY UPDATE DATABASE
                </p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-medium text-slate-500">
                  Built with ❤️ <span className="text-slate-300 font-bold">Tanzir Ahmed.</span>
                </p>
                <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.3em]">BUILD V2.4.0-ERP</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

