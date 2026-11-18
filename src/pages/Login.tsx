import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { WashingMachine, User, KeyRound, LogIn, ShieldAlert, PhoneCall, Eye, EyeOff, ShieldCheck, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { SPRING_TACTILE } from '../components/SpringMotion';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/auth/setup-status', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setNeedsSetup(Boolean(data.needsSetup));
          }
        }
      } catch {
        // Ignore transient network errors and default to standard login
      } finally {
        if (active) {
          setCheckingSetup(false);
        }
      }
    };
    checkSetup();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
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
        credentials: "include",
        body: JSON.stringify({ username, password })
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else if (!res.ok) {
        await res.text();
        throw new Error(`Server Error (${res.status})`);
      }

      if (res.ok) {
        if (data.token) {
          localStorage.setItem("erp_token", data.token);
        }
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

  const handleSetupSuperUser = async (e: FormEvent) => {
    e.preventDefault();
    const cleanId = username.trim().toLowerCase();
    if (!cleanId || !/^[a-z0-9._-]{3,32}$/.test(cleanId)) {
      toast.error("Super User ID must be 3-32 characters (letters, numbers, ., _, -)");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup-super-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: cleanId, password })
      });

      let data: any = {};
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else if (!res.ok) {
        await res.text();
        throw new Error(`Server Error (${res.status})`);
      }

      if (res.ok) {
        if (data.token) {
          localStorage.setItem("erp_token", data.token);
        }
        toast.success("Super User registered and locked in database!");
        await refreshUser();
        navigate("/", { replace: true });
      } else {
        if (res.status === 403) {
          setNeedsSetup(false);
        }
        throw new Error(data.error || "Super User setup failed");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0F1D] overflow-y-auto flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-[390px] flex flex-col items-center my-auto py-8">

        {/* Top Logo Brand */}
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_TACTILE}
          className="mb-4 flex flex-col items-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-500 flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.45)] mb-3">
            <WashingMachine size={30} className="text-white" strokeWidth={2.2} />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">WASH</h1>
            <span className="text-[#4da2ff] font-bold text-[10px] tracking-[0.25em] leading-none mt-1.5">ERP SYSTEM</span>
          </div>
        </motion.div>

        {/* Divider / Subtitle */}
        <div className="flex items-center justify-center gap-3 w-56 mt-1 mb-5">
          <div className="h-[1px] bg-slate-700/70 flex-1" />
          <span className="text-[9px] font-bold tracking-[0.22em] text-slate-400 uppercase whitespace-nowrap">
            {needsSetup ? "FIRST-TIME SUPER USER SETUP" : "INTERNAL DATA HUB"}
          </span>
          <div className="h-[1px] bg-slate-700/70 flex-1" />
        </div>

        {checkingSetup ? (
          <div className="w-full py-10 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Checking system security state...
            </span>
          </div>
        ) : needsSetup ? (
          <form onSubmit={handleSetupSuperUser} className="w-full space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-left space-y-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-black text-[11px] uppercase tracking-wider">
                <Crown size={14} className="text-amber-400 shrink-0" />
                <span>Initialize Permanent Super User</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                This database currently has <strong className="text-white">0 users</strong>. Create the master <strong className="text-amber-300">Super User</strong> account now. Once saved, setup locks automatically and only this Super User can create additional users.
              </p>
            </div>

            {/* Super User ID */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">
                SUPER USER ID
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. owner or superadmin"
                  className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">
                MASTER PASSWORD (MIN 6 CHARS)
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create strong password"
                  className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-12 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block pl-0.5">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-12 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 btn-neon-glass btn-neon-glass--dark btn-neon-glass--emerald font-black py-3.5 px-4 rounded-xl gap-2 text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>CREATE SUPER USER &amp; ENTER ERP</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Standard Login Form */
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-white text-slate-800 placeholder:text-slate-300 rounded-xl pl-11 pr-12 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 btn-neon-glass btn-neon-glass--dark btn-neon-glass--blue font-black py-3.5 px-4 rounded-xl gap-2 text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  <span>LOGIN / প্রবেশ করুন</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Legal Notice */}
        <div className="w-full mt-5 border border-red-500/25 bg-[#180E14] rounded-xl overflow-hidden text-left shadow-lg">
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 font-bold text-[11px]">
            <ShieldAlert size={15} className="shrink-0 text-red-400" />
            <span>আইনগত সতর্কবার্তা ও কপিরাইট অধিকার (Legal Notice)</span>
          </div>

          <div className="p-3.5 space-y-2 text-[10px] leading-relaxed">
            <div className="font-bold text-amber-400">
              Developer &amp; Owner: <span className="text-white">Tanzir Ahmed</span>
            </div>

            <p className="text-slate-200 leading-normal font-medium">
              এই সাইট, ডিজাইন ও কন্ট্রোল সিস্টেমের কোনো অংশ অনুমতি ছাড়া ক্লোন বা নকল করা সম্পূর্ণ বেআইনি। পাইরেসি করা হলে সাইবার সুরক্ষা আইন ও কপিরাইট আইনের অধীনে আইনি ব্যবস্থা নেয়া হবে।
            </p>

            <p className="text-slate-400 text-[9px] italic leading-tight pt-1.5 border-t border-slate-800">
              Unauthorized cloning or replication will face direct legal action under Cyber Security &amp; Copyright Laws of BD.
            </p>
          </div>
        </div>

        {/* Support Developer Button with Glowing Neon Glassmorphism */}
        <div className="mt-5 flex justify-center w-full">
          <a
            href="https://www.supportkori.com/pay/tanzirahmed"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neon-glass btn-neon-glass--dark btn-neon-glass--rose px-7 py-2 rounded-full group"
          >
            <span className="text-[#FF4D8D] font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,45,120,0.65)]">
              SUPPORT
            </span>
            <span className="mx-1.5 text-sm drop-shadow-[0_0_6px_rgba(255,45,120,0.8)]">
              💖
            </span>
            <span className="text-[#FF4D8D] font-black text-xs tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,45,120,0.65)]">
              DEVELOPER
            </span>
          </a>
        </div>

      </div>

      {/* Floating Bottom-Right Support Contact */}
      <div className="fixed bottom-5 right-5 z-40">
        <a
          href="tel:01710110490"
          className="btn-neon-glass btn-neon-glass--dark btn-neon-glass--cyan gap-2.5 px-5 py-2.5 rounded-full cursor-pointer"
        >
          <PhoneCall size={17} className="text-[#FFDE21] stroke-[2.5] shrink-0 drop-shadow-[0_0_4px_rgba(255,222,33,0.5)]" />
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-extrabold text-white text-[13px] tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              Support:
            </span>
            <span className="font-extrabold text-[#FFE63B] text-[13px] tracking-wide font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              01710-110490
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}
