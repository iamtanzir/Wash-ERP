import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, Clock, User, Calendar, BarChart2, Activity, Play, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface Task {
  id?: string;
  title: string;
  project: string;
  assigned_to: string;
  deadline: string;
  allocated_hours: number;
  logged_hours: number;
  priority: "High" | "Medium" | "Low";
  status: "To Do" | "In Progress" | "Review" | "Completed";
  description?: string;
  created_at?: string;
}

export default function ErpProject() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tasks" | "create" | "timesheet">("tasks");
  const [search, setSearch] = useState("");

  // Form states
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("Garments R&D Wash");
  const [assignedTo, setAssignedTo] = useState("Tanzir Hossain");
  const [deadline, setDeadline] = useState(new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0]);
  const [allocatedHours, setAllocatedHours] = useState(12);
  const [priority, setPriority] = useState<Task["priority"]>("Medium");
  const [status, setStatus] = useState<Task["status"]>("To Do");
  const [description, setDescription] = useState("");

  // Timesheet log state
  const [logTaskId, setLogTaskId] = useState("");
  const [logHours, setLogHours] = useState(2);
  const [logNotes, setLogNotes] = useState("");

  // Fetch tasks
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["erpProjectTasks"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_project_tasks");
      if (!res.ok) return [];
      const data = await res.json();
      
      // If empty, seed with high-quality Odoo-style project management records
      if (data.length === 0) {
        const seedTasks: Task[] = [
          { title: "Formulate Acetic Acid Ratio for Softener Bath", project: "Chemical R&D Lab", assigned_to: "Farhan Ahmed (Lab Specialist)", deadline: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0], allocated_hours: 8, logged_hours: 5, priority: "High", status: "In Progress", description: "Optimize acid formulation to neutralize alkaline residue from enzyme washes without damaging fiber elasticity.", created_at: new Date().toISOString() },
          { title: "Test Denim Shrinkage on 300L Belly Washer", project: "Wash Quality Control", assigned_to: "Sharif Khan (Senior Dyer)", deadline: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0], allocated_hours: 16, logged_hours: 12, priority: "High", status: "Review", description: "Run test loads with pumice stone to evaluate overall shrinkage factor and warp slippage.", created_at: new Date().toISOString() },
          { title: "Audit Bleaching Recipes for H&M Spring Styles", project: "Brand Compliance", assigned_to: "Tanzir Hossain", deadline: new Date(Date.now() + 8 * 86400000).toISOString().split("T")[0], allocated_hours: 24, logged_hours: 0, priority: "Medium", status: "To Do", description: "Verify compliance of optical brightener agent (OBA) quantities against ZDHC MRSL guidelines.", created_at: new Date().toISOString() },
          { title: "Configure High Contrast Dashboard Columns", project: "IT Systems Integration", assigned_to: "Rezaul Karim (Dev)", deadline: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0], allocated_hours: 6, logged_hours: 6, priority: "Low", status: "Completed", description: "Inject Odoo-inspired open source modules into workspace sub-tabs for easier data queries.", created_at: new Date().toISOString() },
        ];
        
        await fetch("/api/db/batch/erp_project_tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: seedTasks })
        });
        return seedTasks;
      }
      return data;
    }
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const res = await fetch("/api/db/erp_project_tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpProjectTasks"] });
      toast.success("Odoo Project task scheduled successfully.");
      setTitle("");
      setDescription("");
      setAllocatedHours(12);
      setActiveTab("tasks");
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Task> }) => {
      const res = await fetch(`/api/db/erp_project_tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpProjectTasks"] });
      toast.success("Task updated.");
    }
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Task Title is required.");
    createTaskMutation.mutate({
      title: title.trim(),
      project,
      assigned_to: assignedTo,
      deadline,
      allocated_hours: Number(allocatedHours),
      logged_hours: 0,
      priority,
      status,
      description: description.trim() || undefined,
      created_at: new Date().toISOString()
    });
  };

  const handlePostTimesheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logTaskId) return toast.error("Please select a task to log hours.");
    const task = tasks.find(t => t.id === logTaskId);
    if (!task) return;

    const nextLogged = (task.logged_hours || 0) + Number(logHours);
    const nextStatus = nextLogged >= task.allocated_hours ? "Review" : "In Progress";
    
    updateTaskMutation.mutate({
      id: logTaskId,
      payload: {
        logged_hours: nextLogged,
        status: nextStatus as any
      }
    });

    toast.success(`Timesheet logged: added ${logHours} hours.`);
    setLogTaskId("");
    setLogHours(2);
    setLogNotes("");
  };

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.project.toLowerCase().includes(q) || 
      t.assigned_to.toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const projectSummary = useMemo(() => {
    let totalAllocated = 0;
    let totalLogged = 0;
    let finishedCount = 0;
    
    filteredTasks.forEach(t => {
      totalAllocated += t.allocated_hours;
      totalLogged += t.logged_hours;
      if (t.status === "Completed") finishedCount++;
    });

    const completionRate = filteredTasks.length > 0 ? Math.round((finishedCount / filteredTasks.length) * 100) : 0;

    return {
      totalAllocated,
      totalLogged,
      completionRate,
      totalCount: filteredTasks.length
    };
  }, [filteredTasks]);

  const priorityColor = {
    High: "text-red-600 bg-red-50 border-red-200",
    Medium: "text-amber-600 bg-amber-50 border-amber-200",
    Low: "text-blue-600 bg-blue-50 border-blue-200"
  };

  const statusColor = {
    "To Do": "bg-slate-100 text-slate-700",
    "In Progress": "bg-sky-100 text-sky-800",
    "Review": "bg-purple-100 text-purple-800",
    "Completed": "bg-emerald-100 text-emerald-800"
  };

  return (
    <div className="space-y-6">
      {/* Sub menu */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 gap-2">
        <div className="flex">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "tasks"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Tasks & Gantt
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "create"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Schedule New Task
          </button>
          <button
            onClick={() => setActiveTab("timesheet")}
            className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "timesheet"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Post Odoo Timesheet
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full mb-1">
          <Clock size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, task, owner..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-lg border border-slate-200 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {activeTab === "tasks" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Tasks List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Gantt Task List</h3>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">Tasks: {filteredTasks.length}</span>
            </div>
            <div className="divide-y divide-slate-150 overflow-y-auto max-h-[500px]">
              {isLoading ? (
                <div className="text-center py-8 text-slate-400 text-xs">Loading tasks...</div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No matching projects/tasks recorded.</div>
              ) : (
                filteredTasks.map((t, tIdx) => {
                  const percent = Math.min(100, Math.round(((t.logged_hours || 0) / t.allocated_hours) * 100));
                  return (
                    <div key={t.id || `task-gantt-${tIdx}`} className="p-4 hover:bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded font-extrabold uppercase">{t.project}</span>
                          <span className={`text-[9px] border px-1.5 py-0.2 rounded font-extrabold uppercase ${priorityColor[t.priority]}`}>
                            {t.priority} Priority
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 line-clamp-1">{t.title}</h4>
                        {t.description && <p className="text-[11px] text-slate-400 truncate">{t.description}</p>}
                        
                        {/* Owner & Deadline Info */}
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-sans mt-2">
                          <span className="flex items-center gap-1"><User size={12} className="text-slate-400" /> {t.assigned_to}</span>
                          <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> Due {formatDate(t.deadline)}</span>
                        </div>
                      </div>

                      {/* Process & Timesheet bar */}
                      <div className="flex flex-col md:items-end gap-1.5 w-full md:w-44 shrink-0">
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor[t.status]}`}>{t.status}</span>
                          <span className="text-[10px] font-bold font-mono text-slate-600">{t.logged_hours} / {t.allocated_hours} hrs ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${percent}%` }}></div>
                        </div>

                        {/* Quick state controls */}
                        <div className="flex items-center justify-end gap-2 mt-1">
                          {t.status === "To Do" && (
                            <button
                              onClick={() => updateTaskMutation.mutate({ id: t.id!, payload: { status: "In Progress" } })}
                              className="text-[9px] bg-slate-800 text-white font-bold px-2 py-0.8 rounded hover:bg-slate-700 transition-colors"
                            >
                              Start Task
                            </button>
                          )}
                          {t.status === "In Progress" && (
                            <button
                              onClick={() => updateTaskMutation.mutate({ id: t.id!, payload: { status: "Review" } })}
                              className="text-[9px] bg-indigo-600 text-white font-bold px-2 py-0.8 rounded hover:bg-indigo-500 transition-colors"
                            >
                              Submit to Review
                            </button>
                          )}
                          {t.status === "Review" && (
                            <button
                              onClick={() => updateTaskMutation.mutate({ id: t.id!, payload: { status: "Completed" } })}
                              className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.8 rounded hover:bg-emerald-500 transition-colors flex items-center gap-0.5"
                            >
                              <CheckCircle size={10} /> Approve Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* KPI column */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 size={14} className="text-blue-600" /> Operational Efficiency
              </h3>
              <div className="grid grid-cols-2 gap-3 font-sans">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Allocated Hrs</p>
                  <p className="text-base font-black text-slate-800 font-mono">{projectSummary.totalAllocated} hrs</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <p className="text-[9px] font-bold text-indigo-400 uppercase">Timesheet Logged</p>
                  <p className="text-base font-black text-indigo-700 font-mono">{projectSummary.totalLogged} hrs</p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between font-sans">
                <div>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase">Task Burn Rate</p>
                  <p className="text-base font-black text-emerald-800">{projectSummary.completionRate}% Tasks Closed</p>
                </div>
                <Activity size={18} className="text-emerald-500" />
              </div>
            </div>

            {/* Quick Guidelines */}
            <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 shadow-lg space-y-3.5">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                📅 Timesheets Compliance
              </h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                All garments production and lab testing routines must be timesheet-logged down to the exact employee. This ensures complete auditability for buyer standard compliance (BSCI, Accord).
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === "create" ? (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckSquare size={14} className="text-blue-600" /> Schedule New Operational Task
          </h3>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Task Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Wash 300 Pcs Slim Fit Denim Lot A"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Project Category</label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="Chemical R&D Lab">Chemical R&D Lab</option>
                  <option value="Wash Quality Control">Wash Quality Control</option>
                  <option value="Brand Compliance">Brand Compliance</option>
                  <option value="IT Systems Integration">IT Systems Integration</option>
                  <option value="Bulk Operations Setup">Bulk Operations Setup</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assignee</label>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Employee Name"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Allocated Hours</label>
                <input
                  type="number"
                  value={allocatedHours}
                  onChange={(e) => setAllocatedHours(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Deadline Date</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Review">In Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operation Description / Recipe Specs</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include specifications, materials keys, machine ratios (MLR 1:10), or chemical codes..."
                rows={4}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create Task Master File</span>
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post Timesheet Panel */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-blue-600" /> Log Timesheet Work
            </h3>
            <form onSubmit={handlePostTimesheet} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Task File</label>
                <select
                  value={logTaskId}
                  onChange={(e) => setLogTaskId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                >
                  <option value="">-- Choose Active Task --</option>
                  {tasks.filter(t => t.status !== "Completed").map((t, tIdx) => (
                    <option key={t.id || `task-opt-${tIdx}`} value={t.id}>[{t.project}] {t.title} ({t.logged_hours}/{t.allocated_hours} hrs)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hours Logged Today</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={logHours}
                  onChange={(e) => setLogHours(Number(e.target.value))}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Daily Log Remarks</label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. Conducted desizing bath wash trial run"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Submit Hours to Journal</span>
              </button>
            </form>
          </div>

          {/* Operations Activity Logs */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Timesheets Tracking Registry</h3>
            </div>
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Operator</th>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5">Allocated</th>
                    <th className="px-3 py-2.5 text-right">Logged Today</th>
                    <th className="px-4 py-2.5 text-right font-bold text-blue-600">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {tasks.map((t, tIdx) => (
                    <tr key={t.id || `task-row-${tIdx}`} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] uppercase">
                          {t.assigned_to.slice(0, 2)}
                        </div>
                        <span>{t.assigned_to}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-800">{t.title}</span>
                        <div className="text-[10px] text-slate-400">{t.project}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-500">{t.allocated_hours} hrs</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-400">-{t.allocated_hours - t.logged_hours} remaining</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-indigo-600 bg-indigo-50/10">{t.logged_hours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
