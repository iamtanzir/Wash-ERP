import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Lock, 
  Database, 
  PlusCircle, 
  Menu,
  X,
  LogOut, 
  ShieldCheck, 
  User as UserIcon,
  History,
  ClipboardCheck,
  Package,
  FileText,
  WashingMachine,
  PhoneCall,
  Sun,
  Moon,
  Search,
  Sparkles,
  Globe
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { useRealTimeClock, formatDhakaTime } from "../hooks/useRealTime";

const navItems = [
  { name: "WASH DASHBOARD", href: "/", icon: LayoutDashboard, desc: "Overview, charts and live metrics" },
  { name: "NEXT ERP PLAN", href: "/new-plan", icon: PlusCircle, desc: "Import and add new ERP plans" },
  { name: "GARMENTS R&D LOG", href: "/daily-update", icon: ClipboardCheck, desc: "Log daily received and delivered quantities" },
  { name: "CPL FABRIC REPORT", href: "/cpl-report", icon: FileText, desc: "Fabrics status and CPL calculations" },
  { name: "H&M SHIP RISK", href: "/hm-tod", icon: ClipboardCheck, desc: "H&M ship risk & target order delivery" },
  { name: "CLOSE ERP ORDER", href: "/close-order", icon: Lock, desc: "Archive completed ERP orders" },
  { name: "ALL BUYER BANK", href: "/data-bank", icon: Database, desc: "Historic buyer data bank archive" },
  { name: "USER MANAGEMENT", href: "/admin", icon: ShieldCheck, desc: "Manage user roles and permissions" },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isEditor, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSidebarFocused] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark-mode");
  });

  const filteredNavItems = navItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add("dark-mode");
      } else {
        document.documentElement.classList.remove("dark-mode");
      }
      return newMode;
    });
  };

  const currentTime = useRealTimeClock();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/new-plan': return 'NEXT ERP Plan';
      case '/cpl-report': return 'CPL Report (Fabrics)';
      case '/daily-update': return 'Daily Update';
      case '/hm-tod': return 'H&M Target Order Delivery';
      case '/close-order': return 'Close ERP Orders';
      case '/data-bank': return 'All Buyer Data';
      default: return 'Wash ERP';
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={cn(
        "bg-slate-900 flex flex-col shadow-2xl shrink-0 h-screen overflow-hidden transition-all duration-300 ease-in-out z-50",
        isSidebarOpen ? "w-64" : "w-0 md:w-0"
      )}>
        <div className="p-6 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40 shrink-0 overflow-hidden">
                <WashingMachine size={20} className="text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-white font-black text-xl tracking-tighter leading-none">WASH</h1>
              <span className="text-blue-400 font-bold text-[10px] tracking-[0.2em] leading-none mt-1">ERP SYSTEM</span>
            </div>
          </div>
          <button 
            className="md:hidden text-slate-400 hover:text-white"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto min-w-max">
            {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    )}
                  >
                    <item.icon
                      className={cn("flex-shrink-0 h-5 w-5", isActive ? "text-white" : "text-slate-500")}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-sm tracking-wide">{item.name}</span>
                  </Link>
                );
              })}
        </nav>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 min-w-max">
          <div className="flex items-center gap-3 px-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
               <UserIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate uppercase">{user?.username}</p>
              <div className="flex items-center gap-1">
                <ShieldCheck size={12} className={cn(isAdmin ? "text-red-400" : isEditor ? "text-amber-400" : "text-blue-400")} />
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{user?.role || "viewer"}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-red-900/20 rounded-md transition-all group"
          >
            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Log out</span>
          </button>
        </div>
      </aside>

      {/* Sidebar Overlay (Mobile Only) */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-6 right-6 md:hidden z-50 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Menu size={28} />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden w-full">
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 md:gap-4 font-sans focus-within:ring-0 shrink-0">
            <button 
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-base md:text-lg font-semibold text-slate-800 uppercase tracking-wide truncate">{getPageTitle()}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap hidden lg:inline-block">Auto Sync</span>
          </div>

          {/* Frappe/ERPNext Desk Awesome Search Bar */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSidebarFocused(true)}
                onBlur={() => setTimeout(() => setIsSidebarFocused(false), 200)}
                placeholder="Search module, order, buyer, style or press '/'..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 hover:bg-slate-200/80 focus:bg-white text-xs text-slate-800 rounded-lg border border-transparent focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium"
              />
              <kbd className="absolute right-2.5 hidden sm:inline-block text-[10px] bg-white border border-slate-200 text-slate-400 rounded px-1.5 py-0.5 font-mono shadow-xs">
                Ctrl + K
              </kbd>
            </div>

            {/* Awesome Bar Search Dropdown */}
            {isSearchFocused && searchQuery.trim() !== "" && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100">
                <div className="p-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ERP Modules & Actions
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredNavItems.length > 0 ? (
                    filteredNavItems.map(item => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setSearchQuery("")}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition-colors group"
                      >
                        <item.icon size={16} className="text-slate-400 group-hover:text-blue-600 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 truncate">{item.name}</span>
                          <span className="text-[10px] text-slate-400 truncate">{item.desc}</span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No matching modules found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 hidden xl:flex items-center gap-1">
              <Sparkles size={12} /> Open ERP Desk
            </span>
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
              aria-label="Toggle dark mode"
              title="High Contrast Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className="sm:hidden px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 whitespace-nowrap">Auto Sync</span>
            <div className="flex flex-col items-end hidden sm:flex">
              <p className="text-xs text-slate-400">Real Time</p>
              <p className="text-sm font-mono font-medium text-slate-700 text-right">
                {formatDhakaTime(currentTime)}
              </p>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </div>

        {/* Tooltip / Status Footer */}
        <footer className="h-10 bg-slate-200 px-4 md:px-6 flex items-center justify-between text-[10px] md:text-xs text-slate-500 shrink-0">
          <div className="flex gap-2 md:gap-4">
            <span className="hidden sm:inline">System: PocketBase v0.22</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Host: LOCAL-SRV-01</span>
            <span className="hidden sm:inline">|</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Tailscale Connected</span>
          </div>
          <div className="flex gap-2 md:gap-4 italic items-center">
            <span title="সব রিসিভ এবং ডেলিভারি সম্পন্ন হলে ক্লোজ করুন">Hints (hover)</span>
            <span className="font-semibold text-slate-600 uppercase hidden sm:inline">Wash Planning</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
