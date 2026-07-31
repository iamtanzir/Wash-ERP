import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash, Settings, Sparkles, Check, Info } from "lucide-react";
import { toast } from "sonner";

interface CustomField {
  id?: string;
  doctype: string;
  label: string;
  fieldname: string;
  fieldtype: string;
  options?: string;
  placeholder?: string;
  is_required: boolean;
}

export default function ErpCustomizer() {
  const queryClient = useQueryClient();
  const [doctype, setDoctype] = useState("order");
  const [label, setLabel] = useState("");
  const [fieldtype, setFieldtype] = useState("Data");
  const [options, setOptions] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(false);

  // Fetch custom fields
  const { data: fields = [], isLoading } = useQuery<CustomField[]>({
    queryKey: ["customFields"],
    queryFn: async () => {
      const res = await fetch("/api/db/erp_custom_fields");
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Create custom field
  const addFieldMutation = useMutation({
    mutationFn: async (newField: CustomField) => {
      const res = await fetch("/api/db/erp_custom_fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField)
      });
      if (!res.ok) throw new Error("Failed to add custom field");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Custom field added successfully!");
      setLabel("");
      setOptions("");
      setPlaceholder("");
      setIsRequired(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Something went wrong");
    }
  });

  // Delete custom field
  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/db/erp_custom_fields/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete custom field");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customFields"] });
      toast.success("Custom field deleted.");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error("Please enter a field label");
      return;
    }
    const fieldname = label.toLowerCase().replace(/[^a-z0-9]/g, "_");
    addFieldMutation.mutate({
      doctype,
      label,
      fieldname,
      fieldtype,
      options,
      placeholder,
      is_required: isRequired
    });
  };

  const currentDoctypeLabel = () => {
    switch (doctype) {
      case "order": return "ERP Order (Wash Report)";
      case "bom": return "Bill of Materials (BOM)";
      case "item": return "Stock Item";
      case "invoice": return "Sales Invoice";
      case "employee": return "Employee Record";
      default: return doctype;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro section */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Settings size={120} className="animate-spin-slow" />
        </div>
        <div className="relative z-10">
          <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 mb-3">
            <Sparkles size={12} /> Customizer Workspace
          </span>
          <h2 className="text-2xl font-black tracking-tight">Frappe DocType Customizer</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Empower your system to behave like **ERPNext**. Dynamically add custom database fields to any form and they will immediately render as editable columns across the whole application!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form panel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Plus size={16} className="text-blue-600" /> Create Custom Field
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target Document Type (DocType)</label>
              <select
                value={doctype}
                onChange={(e) => setDoctype(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="order">ERP Order / Wash Report</option>
                <option value="bom">Bill of Materials (BOM)</option>
                <option value="item">Stock Item</option>
                <option value="invoice">Sales Invoice</option>
                <option value="employee">Employee Record</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Field Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Fabric Weight, Priority Code"
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Field Type</label>
                <select
                  value={fieldtype}
                  onChange={(e) => setFieldtype(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Data">Text / String</option>
                  <option value="Int">Integer Number</option>
                  <option value="Float">Float Decimal</option>
                  <option value="Date">Date Picker</option>
                  <option value="Select">Dropdown Menu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mandatory?</label>
                <div className="flex items-center h-9">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isRequired" className="ml-2 text-xs text-slate-600">Yes, required</label>
                </div>
              </div>
            </div>

            {fieldtype === "Select" && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Dropdown Options (comma separated)
                </label>
                <input
                  type="text"
                  value={options}
                  onChange={(e) => setOptions(e.target.value)}
                  placeholder="e.g. High, Medium, Low"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Placeholder Hint</label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                placeholder="e.g. Enter fabric GSM..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={addFieldMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              <span>{addFieldMutation.isPending ? "Adding Field..." : "Add Field Schema"}</span>
            </button>
          </form>
        </div>

        {/* Existing custom fields list */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Configured Meta Fields Schema ({fields.length})
            </h3>
            <div className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">
              <Info size={11} /> Universal Auto-Sync Active
            </div>
          </div>

          <div className="flex-1 overflow-auto max-h-[360px] mt-4 space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading custom schema metadata...</div>
            ) : fields.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No custom fields defined yet. Create your first custom field on the left!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields.map((field) => (
                  <div key={field.id} className="p-4 rounded-xl border border-slate-150 bg-slate-50/50 flex flex-col justify-between group hover:border-blue-200 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">{field.label}</span>
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {field.fieldtype}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        fieldname: <span className="font-semibold text-slate-600">{field.fieldname}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-1">
                        DocType: <span className="font-semibold text-slate-700">{field.doctype.toUpperCase()}</span>
                      </div>
                      {field.placeholder && (
                        <div className="text-[10px] text-slate-400 italic">
                          Placeholder: "{field.placeholder}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-3">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {field.is_required ? (
                          <span className="text-red-500 font-bold">* Mandatory</span>
                        ) : (
                          <span className="text-slate-400 font-medium">Optional</span>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete the custom field "${field.label}"?`)) {
                            deleteFieldMutation.mutate(field.id!);
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Delete Field"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
