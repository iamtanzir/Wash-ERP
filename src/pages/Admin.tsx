import React, { useState, useEffect } from "react";
import { Users, UserPlus, Shield, UserMinus, ShieldAlert, CheckCircle2, KeyRound, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface UserRecord {
  id: string;
  username: string;
  role: "admin" | "editor" | "viewer" | "operator";
  status: "active" | "inactive";
  created_at?: any;
}

export default function Admin() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" as const });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
       toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;

    try {
      const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      toast.success("User whitelisted successfully");
      setShowAddModal(false);
      setNewUser({ username: "", password: "", role: "viewer" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update role");
      }
      toast.success("Role updated");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      try {
          const res = await fetch(`/api/admin/users/${userId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Update failed");
          }
          toast.success(`User set to ${newStatus}`);
          fetchUsers();
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  const handleDeleteUser = async (userId: string) => {
      if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
      try {
          const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Deletion failed");
          }
          toast.success("User deleted");
          fetchUsers();
      } catch (error: any) {
          toast.error(error.message);
      }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 italic">Configure roles and access permissions</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          <UserPlus size={20} />
          Whitelist User
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics Cards */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Users</p>
            <p className="text-2xl font-black text-slate-900">{users.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Admins</p>
            <p className="text-2xl font-black text-slate-900">{users.filter(u => u.role === 'admin').length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Sessions</p>
            <p className="text-2xl font-black text-slate-900">Encrypted</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">User Details</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Access Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Added Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">Loading directory...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">No users registered yet</td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold uppercase">
                          {user.username.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 uppercase tracking-tight">{user.username}</p>
                          <p className="text-[10px] text-slate-400 font-bold">UID: {user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        className={cn(
                          "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border-2 transition-all",
                          user.role === 'admin' ? "bg-red-50 text-red-700 border-red-200" :
                          user.role === 'editor' ? "bg-amber-50 text-amber-700 border-amber-200" :
                          user.role === 'operator' ? "bg-purple-50 text-purple-700 border-purple-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="operator">Operator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                        <button 
                            onClick={() => handleToggleStatus(user.id, user.status)}
                            className="flex items-center group"
                        >
                            <span className={cn(
                                "w-2 h-2 rounded-full inline-block mr-2 group-hover:scale-125 transition-transform",
                                user.status === 'active' ? "bg-green-500" : "bg-slate-300"
                            )} />
                            <span className="text-xs font-bold text-slate-500 uppercase group-hover:text-slate-900">{user.status}</span>
                        </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-slate-300 hover:text-red-600 transition-colors p-2"
                      >
                        <UserMinus size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Whitelist New User</h2>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="text"
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase()})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    placeholder="e.g. jdoe"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Temporary Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                >
                  <option value="admin">Administrator</option>
                  <option value="editor">Editor (Upload + Edit)</option>
                  <option value="operator">Operator (Daily Logs)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-[10px] text-blue-700 font-medium italic">
                <ShieldAlert size={14} className="shrink-0" />
                User will be forced to change this password on their first login.
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg transition-all"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
