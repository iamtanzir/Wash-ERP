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
      // This endpoint is powered by the flexible DatabaseAdapter (Supabase/PocketBase/SQLite)
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-[420px] bg-white rounded-[40px] shadow-2xl p-8 pb-12 space-y-8 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col items-center pt-4">
          <div className="w-20 h-20 bg-blue-600 rounded-[28px] shadow-lg flex items-center justify-center text-white mb-6">
            <LogIn size={38} className="translate-x-0.5" />
          </div>
          
          <div className="text-center space-y-1.5">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">INCTL WASH ERP</h1>
            <p className="text-slate-400 font-bold tracking-[0.15em] text-[10px] uppercase">Internal Resource Management</p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Username</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400/60" size={18} />
                <input 
                  required
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4.5 focus:bg-white focus:ring-2 focus:ring-blue-600/10 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300"
                  placeholder="inctlwash"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400/60" size={18} />
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl pl-14 pr-6 py-4.5 focus:bg-white focus:ring-2 focus:ring-blue-600/10 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 tracking-widest"
                  placeholder="••••••"
                />
              </div>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#0f172a] hover:bg-black text-white font-bold py-5 px-6 rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 group mt-4"
          >
            {loading ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <>
                <LogIn size={20} className="group-hover:translate-x-0.5 transition-transform" />
                <span className="text-[15px]">Secure Access</span>
              </>
            )}
          </button>
          
          {/* Validation Notice Section */}
          <div className="p-5 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-start gap-3.5 mt-8">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
               <ShieldAlert size={14} className="text-amber-600" />
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800 font-semibold opacity-90">
              Verification required. Access is restricted to authorized company IDs only. System activity is monitored and logged in accordance with the IT Audit policy.
            </p>
          </div>
        </form>

        {/* Footer Version */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em]">Version 2.4.0-ERP-PRIME</p>
        </div>
      </div>
    </div>
  );
}
