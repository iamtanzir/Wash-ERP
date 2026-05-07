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
    <div className="min-h-screen bg-slate-50 flex flex-row selection:bg-blue-500/30">
      {/* Left Decoration Panel (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-slate-500 rounded-full blur-[120px]" />
        </div>
        
        <div className="relative z-10 space-y-8 max-w-lg text-center">
          <div className="w-24 h-24 bg-blue-600 rounded-3xl shadow-2xl flex items-center justify-center text-white mx-auto mb-8 animate-pulse">
            <LogIn size={48} />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight leading-tight">
            WASH <span className="text-blue-500">ERP</span>
          </h1>
          <p className="text-xl text-slate-400 font-medium leading-relaxed">
            Enterprise Resource Planning for modern laundry and garment processing industries.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50">
              <p className="text-blue-400 font-black text-2xl">24/7</p>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Availability</p>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700/50">
              <p className="text-blue-400 font-black text-2xl">100%</p>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">Secure</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white lg:bg-slate-50">
        <div className="w-full max-w-[440px] bg-white lg:shadow-2xl lg:shadow-slate-200/50 rounded-[40px] p-8 lg:p-12 space-y-10">
          
          {/* Header Section (Mobile) */}
          <div className="flex flex-col items-center lg:items-start lg:text-left">
            <div className="lg:hidden w-16 h-16 bg-blue-600 rounded-2xl shadow-lg flex items-center justify-center text-white mb-6">
              <LogIn size={32} />
            </div>
            
            <div className="space-y-1.5 w-full">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Login</h2>
              <p className="text-slate-400 font-semibold tracking-wide text-sm">Welcome back to WASH ERP system</p>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-6">
              {/* Username Input */}
              <div className="group space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 transition-colors group-focus-within:text-blue-600">User ID</label>
                <div className="relative">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={20} />
                  <input 
                    required
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-slate-100/50 border-2 border-transparent rounded-[22px] pl-16 pr-6 py-5 focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                    placeholder="Enter your user ID"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="group space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 transition-colors group-focus-within:text-blue-600">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={20} />
                  <input 
                    required
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-100/50 border-2 border-transparent rounded-[22px] pl-16 pr-6 py-5 focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-400 tracking-widest"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-slate-900 hover:bg-black text-white font-black py-5 px-8 rounded-2xl shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98] disabled:opacity-50 group overflow-hidden relative"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <span className="relative z-10 text-[16px]">Sign In to System</span>
                  <LogIn size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            
            {/* Validation Notice Section */}
            <div className="space-y-6">
              <div className="p-5 bg-amber-50/60 border border-amber-100/80 rounded-3xl flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <ShieldAlert size={14} className="text-amber-600" />
                </div>
                <p className="text-[12px] leading-relaxed text-amber-900/70 font-semibold italic">
                  "System activity monitoring and logged in as per company policy required authorized IDs only."
                </p>
              </div>
              
              <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Server Secure</span>
                </div>
                <p className="text-[11px] font-bold text-slate-400">
                  Built with ❤️ Tanzir Ahmed
                </p>
              </div>
            </div>
          </form>

          {/* Footer Version */}
          <div className="text-center">
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-[0.3em]">Build v2.4.0-ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
