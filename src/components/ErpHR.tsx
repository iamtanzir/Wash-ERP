import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, UserCheck, Wallet, Calendar, ShieldCheck, FileText, Check } from "lucide-react";
import { toast } from "sonner";
import { formatNumber, formatDate } from "../lib/utils";

interface Employee {
  id?: string;
  employee_id: string;
  name: string;
  department: "Wash Production" | "Chemical Lab" | "Finishing & QC" | "Admin & Accounts";
  designation: string;
  joining_date: string;
  salary: number;
  status: "Active" | "Inactive";
  custom_values?: Record<string, any>;
  created_at?: string;
}

interface Attendance {
  id?: string;
  employee_id: string;
  name: string;
  date: string;
  status: "Present" | "Absent" | "Late" | "On Leave";
  logged_by: string;
  created_at?: string;
}

export default function ErpHR() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"directory" | "attendance">("directory");

  // Custom Fields Meta Query
  const { data: customFields = [] } = useQuery({
    queryKey: ["customFields"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_custom_fields");
      if (!res.ok) return [];
      const all: any[] = await res.json();
      return all.filter(f => f.doctype === "employee");
    }
  });

  const [customFormVals, setCustomFormVals] = useState<Record<string, any>>({});

  // Employee Form States
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [empDept, setEmpDept] = useState<Employee["department"]>("Wash Production");
  const [empDesg, setEmpDesg] = useState("");
  const [empJoinDate, setEmpJoinDate] = useState(new Date().toISOString().split("T")[0]);
  const [empSalary, setEmpSalary] = useState(25000); // 25,000 BDT default

  // Attendance Logger States
  const [attEmpId, setAttEmpId] = useState("");
  const [attStatus, setAttStatus] = useState<Attendance["status"]>("Present");

  // Queries
  const { data: employees = [], isLoading: loadingEmployees } = useQuery<Employee[]>({
    queryKey: ["erpEmployees"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_employees");
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: attendanceLogs = [], isLoading: loadingAttendance } = useQuery<Attendance[]>({
    queryKey: ["erpAttendance"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_attendance");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Mutations
  const createEmployeeMutation = useMutation({
    mutationFn: async (emp: Employee) => {
      const res = await fetch("/api/db/erp_employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emp)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpEmployees"] });
      toast.success("Employee record saved successfully.");
      setEmpId("");
      setEmpName("");
      setEmpDesg("");
      setEmpSalary(25000);
      setCustomFormVals({});
    }
  });

  const postAttendanceMutation = useMutation({
    mutationFn: async (att: Attendance) => {
      const res = await fetch("/api/db/erp_attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(att)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["erpAttendance"] });
      toast.success("Attendance ledger updated.");
      setAttEmpId("");
    }
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId.trim() || !empName.trim() || !empDesg.trim()) return toast.error("Please fill in ID, Name, and Designation.");
    
    if (employees.some(emp => emp.employee_id.toLowerCase() === empId.toLowerCase().trim())) {
      return toast.error("Employee ID code already taken.");
    }

    createEmployeeMutation.mutate({
      employee_id: empId.trim().toUpperCase(),
      name: empName.trim(),
      department: empDept,
      designation: empDesg.trim(),
      joining_date: empJoinDate,
      salary: Number(empSalary),
      status: "Active",
      custom_values: customFormVals,
      created_at: new Date().toISOString()
    });
  };

  const handlePostAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attEmpId) return toast.error("Please select an employee.");
    const selectedEmp = employees.find(emp => emp.employee_id === attEmpId);

    postAttendanceMutation.mutate({
      employee_id: attEmpId,
      name: selectedEmp?.name || "Unknown Staff",
      date: new Date().toISOString().split("T")[0],
      status: attStatus,
      logged_by: "Admin",
      created_at: new Date().toISOString()
    });
  };

  const handleGenerateSalary = (emp: Employee) => {
    const daysAttended = attendanceLogs.filter(a => a.employee_id === emp.employee_id && a.status === "Present").length;
    const workingDays = 26; // monthly standard
    const payout = Math.round((emp.salary / workingDays) * Math.max(1, Math.min(workingDays, daysAttended || 22)));
    toast.info(`Salary Slip for ${emp.name}: BDT ${formatNumber(payout)} based on ${daysAttended || 22}/${workingDays} working days checked-in.`);
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Total Workforce Registries</p>
          <p className="text-3xl font-light text-blue-600 mt-1">{employees.length} <span className="text-sm font-normal text-slate-400">staff</span></p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Checked In Checked-Out (Today)</p>
          <p className="text-3xl font-light text-emerald-600 mt-1">
            {attendanceLogs.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status === "Present").length} <span className="text-sm font-normal text-slate-400">present</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Wages & Salaries Budget</p>
          <p className="text-3xl font-light text-slate-800 mt-1">BDT {formatNumber(employees.reduce((sum, e) => sum + e.salary, 0))} <span className="text-sm font-normal text-slate-400">/mo</span></p>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("directory")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "directory"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Staff & Human Resources
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2.5 font-bold text-xs uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "attendance"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Work Attendance Book
        </button>
      </div>

      {activeTab === "directory" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Employee Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Plus size={14} className="text-blue-600" /> Save Employee Card
            </h3>
            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Employee ID code</label>
                  <input
                    type="text"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    placeholder="e.g. EMP-1049"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Department</label>
                  <select
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                  >
                    <option value="Wash Production">Wash Production</option>
                    <option value="Chemical Lab">Chemical Lab</option>
                    <option value="Finishing & QC">Finishing & QC</option>
                    <option value="Admin & Accounts">Admin & Accounts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Employee Name</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="e.g. Tanzir Rahman"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Designation Role</label>
                <input
                  type="text"
                  value={empDesg}
                  onChange={(e) => setEmpDesg(e.target.value)}
                  placeholder="e.g. Senior Chemical Wash Executive"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={empJoinDate}
                    onChange={(e) => setEmpJoinDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Base Salary (BDT)</label>
                  <input
                    type="number"
                    value={empSalary}
                    onChange={(e) => setEmpSalary(Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                  />
                </div>
              </div>

              {/* Custom field meta fields */}
              {customFields.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    {field.label} {field.is_required && <span className="text-red-500">*</span>}
                  </label>
                  {field.fieldtype === "Select" ? (
                    <select
                      value={customFormVals[field.fieldname] || ""}
                      onChange={(e) => setCustomFormVals({ ...customFormVals, [field.fieldname]: e.target.value })}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                    >
                      <option value="">-- Choose Option --</option>
                      {field.options?.split(",").map((o: string) => (
                        <option key={o.trim()} value={o.trim()}>{o.trim()}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.fieldtype === "Int" || field.fieldtype === "Float" ? "number" : "text"}
                      value={customFormVals[field.fieldname] || ""}
                      onChange={(e) => setCustomFormVals({ ...customFormVals, [field.fieldname]: e.target.value })}
                      placeholder={field.placeholder || ""}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                    />
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={createEmployeeMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Save Staff Record</span>
              </button>
            </form>
          </div>

          {/* Employee list tables */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Facility Employee Directory</h3>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">Employees: {employees.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Staff ID</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Dept & Role</th>
                    <th className="px-3 py-2.5">Joining Date</th>
                    <th className="px-3 py-2.5 text-right">Base Salary</th>
                    <th className="px-4 py-2.5 text-right">Payroll slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingEmployees ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading workforce registry...</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={6} className="text-center p-8 text-slate-400 italic">No employees enrolled. Fill card on the left!</td></tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{emp.employee_id}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-slate-800">{emp.name}</span>
                          {emp.custom_values && Object.entries(emp.custom_values).map(([k, v]) => (
                            <div key={k} className="text-[10px] text-slate-400">
                              {k}: <span className="text-slate-600">{String(v)}</span>
                            </div>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-slate-500 font-medium">
                          {emp.department}<br />
                          <span className="text-[10px] text-slate-400 italic">{emp.designation}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{formatDate(emp.joining_date)}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold text-slate-800">BDT {formatNumber(emp.salary)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleGenerateSalary(emp)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-900 active:bg-black text-white font-bold px-2 py-1 rounded flex items-center gap-1.5 ml-auto"
                          >
                            <FileText size={11} /> Calc Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Post Attendance Log */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={14} className="text-blue-600" /> Log Check-In
            </h3>
            <form onSubmit={handlePostAttendance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Employee</label>
                <select
                  value={attEmpId}
                  onChange={(e) => setAttEmpId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.employee_id}>[{emp.employee_id}] {emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Attendance Status</label>
                <select
                  value={attStatus}
                  onChange={(e) => setAttStatus(e.target.value as any)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none"
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late (Check-in delayed)</option>
                  <option value="On Leave">On Approved Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={postAttendanceMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Post Check-In Sheet</span>
              </button>
            </form>
          </div>

          {/* Attendance Ledger Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Posted Workforce Check-Ins</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Total Logs: {attendanceLogs.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[480px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase">
                    <th className="px-4 py-2.5">Checked In Date</th>
                    <th className="px-3 py-2.5">Staff Name</th>
                    <th className="px-3 py-2.5">Employee ID</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
                  {loadingAttendance ? (
                    <tr><td colSpan={5} className="text-center p-8 text-slate-400">Loading Check-In sheets...</td></tr>
                  ) : attendanceLogs.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-8 text-slate-400 italic">No attendance records logged for today.</td></tr>
                  ) : (
                    attendanceLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{formatDate(log.created_at || "")}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{log.name}</td>
                        <td className="px-3 py-3 font-mono font-bold text-blue-600 text-[11px]">{log.employee_id}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            log.status === "Present" ? "bg-emerald-100 text-emerald-800" :
                            log.status === "Late" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium">{log.logged_by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
