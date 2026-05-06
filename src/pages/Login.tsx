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
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Login successful");
        // Force state update immediately after successful login
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
        <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 rotate-3">
                <LogIn size={40} />
            </div>
            
            <div className="text-center space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">INCTL Wash ERP</h1>
                <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">Internal Resource Management</p>
            </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                        required
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase())}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-800"
                        placeholder="admin"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative group">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                        required
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 focus:bg-white focus:border-blue-600 outline-none transition-all font-bold text-slate-800"
                        placeholder="••••••••"
                    />
                </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-black text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 group"
          >
            {loading ? <Loader2 size={24} className="animate-spin" /> : <LogIn size={24} className="group-hover:translate-x-1 transition-transform" />}
            Secure Access
          </button>
          
          <div className="flex items-start gap-3 p-5 bg-amber-50/50 border-2 border-amber-100 rounded-2xl text-amber-800 text-[11px] leading-relaxed font-medium transition-all group hover:bg-amber-50">
            <ShieldAlert size={20} className="shrink-0 text-amber-600 group-hover:scale-110 transition-transform" />
            <p>Verification required. Access is restricted to authorized company IDs only. System activity is monitored and logged in accordance with the IT Audit policy.</p>
          </div>
        </form>

        <div className="text-center pt-4">
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Version 2.4.0-ERP-PRIME</span>
        </div>
      </div>
    </div>
  );
}
