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
  FileText
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

const navItems = [
  { name: "WASH DASHBOARD", href: "/", icon: LayoutDashboard },
  { name: "NEXT ERP PLAN", href: "/new-plan", icon: PlusCircle },
  { name: "GARMENTS R&D LOG", href: "/daily-update", icon: ClipboardCheck },
  { name: "CPL FABRIC REPORT", href: "/cpl-report", icon: FileText },
  { name: "CLOSE ERP ORDER", href: "/close-order", icon: Lock },
  { name: "ALL BUYER BANK", href: "/data-bank", icon: Database },
  { name: "USER MANAGEMENT", href: "/admin", icon: ShieldCheck },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isEditor, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">I</span>
            </div>
            <h1 className="text-white font-bold text-lg tracking-tight uppercase">WASH ERP</h1>
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 md:gap-4 font-sans focus-within:ring-0">
            <button 
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-base md:text-lg font-semibold text-slate-800 uppercase tracking-wide truncate">{getPageTitle()}</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap hidden sm:inline-block">Auto Sync</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="sm:hidden px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 whitespace-nowrap">Auto Sync</span>
            <div className="flex flex-col items-end hidden sm:flex">
              <p className="text-xs text-slate-400">Real Time</p>
              <p className="text-sm font-mono font-medium text-slate-700 text-right">
                {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute:'2-digit', hour12: true }).toUpperCase().replace(',', ' |')}
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
