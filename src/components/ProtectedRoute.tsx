import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  role?: "admin" | "editor" | "viewer";
}

export default function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isEditor } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin" && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (role === "editor" && !isEditor) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
