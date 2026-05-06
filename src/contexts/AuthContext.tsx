import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer" | "operator";
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    isAdmin: false, 
    isEditor: false,
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

  const value = {
    user,
    loading,
    isAdmin: user?.role === "admin",
    isEditor: user?.role === "admin" || user?.role === "editor",
    logout,
    refreshUser: fetchUser
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
