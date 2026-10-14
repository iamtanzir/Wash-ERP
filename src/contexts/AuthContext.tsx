import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

export type UserRole = "admin" | "wash_md" | "wash_manager" | "editor" | "viewer" | "operator";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole | string;
  title?: string;
  department?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isEditor: boolean;
  isWashMD: boolean;
  isWashManager: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canViewFinancialMetrics: boolean;
  getRoleDisplayName: () => string;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    isAdmin: false, 
    isSuperAdmin: false,
    isEditor: false,
    isWashMD: false,
    isWashManager: false,
    isOperator: false,
    isViewer: false,
    canViewFinancialMetrics: false,
    getRoleDisplayName: () => "Viewer",
    logout: async () => {},
    refreshUser: async () => {} 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      console.log("Fetching user...");
      const res = await fetch("/api/me", { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        console.log("User fetched successfully:", data.user);
        setUser(data.user);
      } else {
        console.warn("User fetch failed with status:", res.status);
        setUser(null);
      }
    } catch (error) {
      console.error("User fetch error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    toast.success("Logged out");
  };

  const usernameLower = user?.username?.trim().toLowerCase() || "";
  const roleLower = (user?.role || "").trim().toLowerCase();
  const isSuperAdmin = usernameLower === "tanzirerp";

  // Wash MD Role (Managing Director)
  const isWashMD = 
    isSuperAdmin || 
    roleLower === "wash_md" || 
    (roleLower === "admin" && !usernameLower.includes("operator") && !usernameLower.includes("viewer")) ||
    usernameLower.includes("washmd") ||
    usernameLower === "md";

  // Wash Manager Role
  const isWashManager = 
    roleLower === "wash_manager" || 
    usernameLower.includes("manager") || 
    usernameLower.includes("washmanager");

  // Data Entry Operator
  const isOperator = roleLower === "operator" || usernameLower.includes("operator");

  // Normal Viewer / Normal User
  const isViewer = roleLower === "viewer" || usernameLower.includes("viewer");

  // Normal User / Data Entry Operators check
  const isNormalUserOrOperator = isOperator || isViewer || (roleLower === "editor" && !isWashMD && !isWashManager);

  // Financial Metrics access rule:
  // ONLY shown for Wash MD or Wash Manager. Normal users and data entry operators DO NOT have access.
  const canViewFinancialMetrics = !isNormalUserOrOperator && (isWashMD || isWashManager || isSuperAdmin);

  const isAdmin = user?.role === "admin" || isWashMD || isSuperAdmin;
  const isEditor = isAdmin || isWashManager || user?.role === "editor";

  const getRoleDisplayName = () => {
    if (isSuperAdmin) return "Super Admin (Owner)";
    if (roleLower === "wash_md" || usernameLower.includes("washmd") || usernameLower === "md") return "Wash MD (Managing Director)";
    if (roleLower === "wash_manager" || usernameLower.includes("manager")) return "Wash Manager";
    if (roleLower === "admin") return "System Admin";
    if (roleLower === "operator" || usernameLower.includes("operator")) return "Data Entry Operator";
    if (roleLower === "editor") return "Editor (Normal User)";
    return "Viewer (Normal User)";
  };

  const value = {
    user,
    loading,
    isAdmin,
    isSuperAdmin,
    isEditor,
    isWashMD,
    isWashManager,
    isOperator,
    isViewer,
    canViewFinancialMetrics,
    getRoleDisplayName,
    logout,
    refreshUser: fetchUser
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
