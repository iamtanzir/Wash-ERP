import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { WashingMachine, User, KeyRound, LogIn, ShieldAlert, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both ID and Password");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else if (!res.ok) {
        const textError = await res.text();
        throw new Error(`Server Error (${res.status})`);
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
    <div className="fixed inset-0 bg-[#0A0F1D] overflow-y-auto flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-[380px] flex flex-col items-center my-auto py-8">
        
        {/* Top Logo Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="w-14 h-14 bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] rounded-2xl flex items-center justify-center text-white shadow-[0_8px_25px_rgba(29,78,216,0.4)] mb-4"
        >
          <WashingMachine size={28} strokeWidth={2.2} className="text-white" />
        </motion.div>

        {/* Title */}
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-1">
          WASH<span className="text-[#3B82F6]">ERP</span>
        </h1>

        {/* Divider / Subtitle */}
        <div className="flex items-center justify-center gap-3 w-48 mt-1.5 mb-6">
          <div className="h-[1px] bg-slate-700/70 flex-1" />
          <span className="text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase">
            INTERNAL DATA HUB
          </span>
          <div className="h-[1px] bg-slate-700/70 flex-1" />
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="w-full space-y-4">
          {/* User ID Field */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">
              USER ID
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="User ID Name"
                className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">
              USER PASS
            </label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#1E6BFF] hover:bg-blue-600 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(30,107,255,0.35)] transition-all active:scale-[0.99] disabled:opacity-50 text-sm uppercase tracking-wider"
          >
            <span>{loading ? 'AUTHENTICATING...' : 'ENTER ERP'}</span>
            {!loading && <span className="text-lg leading-none font-bold">→</span>}
          </button>
        </form>

        {/* Legal Notice */}
        <div className="w-full mt-5 border border-red-500/25 bg-[#180E14] rounded-xl overflow-hidden text-left shadow-lg">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 font-bold text-[11px]">
            <ShieldAlert size={15} className="shrink-0 text-red-400" />
            <span>আইনগত সতর্কবার্তা ও কপিরাইট অধিকার (Legal Notice)</span>
          </div>

          <div className="p-3.5 space-y-2 text-[10px] leading-relaxed">
            <div className="font-bold text-amber-400">
              Developer & Owner: <span className="text-white">Tanzir Ahmed</span>
            </div>
            
            <p className="text-slate-200 leading-normal font-medium">
              এই সাইট, ডিজাইন ও কন্ট্রোল সিস্টেমের কোনো অংশ অনুমতি ছাড়া ক্লোন বা নকল করা সম্পূর্ণ বেআইনি। পাইরেসি করা হলে সাইবার সুরক্ষা আইন ও কপিরাইট আইনের অধীনে আইনি ব্যবস্থা নেয়া হবে।
            </p>
            
            <p className="text-slate-400 text-[9px] italic leading-tight pt-1.5 border-t border-slate-800">
              Unauthorized cloning or replication will face direct legal action under Cyber Security & Copyright Laws of BD.
            </p>
          </div>
        </div>

        {/* Support Developer Button with Exact Requested Neon Pink Style */}
        <div className="mt-5 flex justify-center w-full">
          <a
            href="https://www.supportkori.com/pay/tanzirahmed"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center border-2 border-[#E11D48] bg-[#170C1B] hover:bg-[#23102A] transition-all px-7 py-2 rounded-full shadow-[0_0_15px_rgba(225,29,72,0.35)] active:scale-95 group"
          >
            <span className="text-[#FF2D78] font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,45,120,0.6)]">
              SUPPORT
            </span>
            <span className="mx-1.5 text-sm drop-shadow-[0_0_6px_rgba(255,45,120,0.8)]">
              💖
            </span>
            <span className="text-[#FF2D78] font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,45,120,0.6)]">
              DEVELOPER
            </span>
          </a>
        </div>

      </div>

      {/* Floating Bottom-Right Support Contact */}
      <div className="fixed bottom-4 right-4 z-40">
        <a
          href="tel:01710110490"
          className="flex items-center gap-2 bg-[#1E6BFF] hover:bg-blue-600 text-white font-bold px-4 py-2 rounded-full text-xs shadow-lg transition-all active:scale-95"
        >
          <Phone size={13} className="fill-white" />
          <span>Support: 01710-110490</span>
        </a>
      </div>
    </div>
  );
}
