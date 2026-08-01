import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ShieldAlert, KeyRound, User, Loader2, Shield, WashingMachine, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "motion/react";
import SupportWidget from "../components/SupportWidget";

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
    <>
      <SupportWidget />
      <div className="fixed inset-0 bg-[#0f172a] flex items-center justify-center p-2 sm:p-4 selection:bg-blue-500/30 font-sans overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[400px] flex flex-col justify-center my-auto min-h-min"
      >
        <div className="px-4 py-4 sm:px-8 space-y-4 sm:space-y-5 transition-all">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[16px] shadow-lg flex items-center justify-center text-white overflow-hidden">
                <WashingMachine size={24} strokeWidth={2.5} className="text-white" />
              </div>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1">
                WASH <span className="text-blue-500">ERP</span>
              </h1>
              <div className="flex items-center justify-center gap-2 opacity-60">
                <div className="h-px w-6 bg-slate-700" />
                <p className="text-slate-100 font-bold text-[8px] uppercase tracking-[0.4em]">Internal Data Hub</p>
                <div className="h-px w-6 bg-slate-700" />
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              {/* Username Field */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">USER ID</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <User className="text-slate-300" size={16} />
                  </div>
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 text-sm"
                    placeholder="User ID Name"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">USER PASS</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <KeyRound className="text-slate-300" size={16} />
                  </div>
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:bg-white focus:border-blue-400 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-300 text-sm"
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              <span className="text-sm uppercase tracking-wider">Enter ERP</span>
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
            </button>
          </form>

          {/* Legal Notice & Copyright */}
          <div className="border border-red-500/30 bg-red-950/30 rounded-xl overflow-hidden text-left p-0">
            <div className="bg-red-500/20 px-3 py-1.5 border-b border-red-500/20 flex items-center gap-1.5 text-red-300 font-bold text-[10px]">
              <ShieldAlert size={14} className="shrink-0 text-red-400" />
              <span>আইনগত সতর্কবার্তা ও কপিরাইট অধিকার (Legal Notice)</span>
            </div>
            <div className="p-2.5 space-y-1 text-[10px] text-slate-200 leading-relaxed">
              <div className="font-bold text-amber-300 text-[10px]">
                Developer & Owner: <span className="text-white">Tanzir Ahmed</span>
              </div>
              <p className="text-slate-200 text-[10px] leading-normal font-medium">
                এই সাইট, ডিজাইন ও কন্ট্রোল সিস্টেমের কোনো অংশ অনুমতি ছাড়া ক্লোন বা নকল করা সম্পূর্ণ বেআইনি। পাইরেসি করা হলে সাইবার সুরক্ষা আইন ও কপিরাইট আইনের অধীনে আইনি ব্যবস্থা নেয়া হবে।
              </p>
              <p className="text-slate-400 text-[9px] italic leading-tight pt-1 border-t border-slate-800/80">
                Unauthorized cloning or replication will face direct legal action under Cyber Security & Copyright Laws of BD.
              </p>
            </div>
          </div>

          {/* Compliance & Branding */}
          <div className="space-y-3 pt-1">
            <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-start gap-3 backdrop-blur-sm">
              <Shield size={16} className="text-blue-400 shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-[9px] leading-relaxed text-blue-100/40 font-medium italic">
                Notice: All activity is monitoring by authorized ID only. System access logs are maintained as per company policy.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-col items-center space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  AUTOMATICALLY UPDATE DATABASE
                </p>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[9px] font-medium text-slate-500">
                  Built with ❤️ <span className="text-slate-300 font-bold">Tanzir Ahmed.</span>
                </p>
                <p className="text-[7px] text-slate-600 font-black uppercase tracking-[0.3em]">BUILD V2.4.0-ERP</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </>
  );
}

