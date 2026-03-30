import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Cpu, FileSpreadsheet, AlertTriangle,
  Upload, Play, Settings2, Plus, Trash2, ChevronDown, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useSimulation } from "@/hooks/useSimulation";
import { fetchConfig, runJsonSimulation, fetchConfigFromFile, type FactoryConfig } from "@/lib/api";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const navItems = [
  { label: "Live Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Order Tracking", icon: ClipboardList, path: "/orders" },
  { label: "Machine Utilization", icon: Cpu, path: "/machines" },
  { label: "Alerts", icon: AlertTriangle, path: "/alerts" },
  { label: "Raw Simulation Logs", icon: FileSpreadsheet, path: "/logs" },
];

// Column definitions for the editable tables
const MACHINE_COLS = [
  { key: "Machine_ID", label: "Machine ID", type: "text" },
  { key: "Count", label: "Count", type: "number" },
  { key: "Input_Buffer_Capacity", label: "Buffer Cap", type: "number" },
  { key: "Processing_Time_Mean", label: "Proc Time (avg)", type: "number" },
  { key: "Jam_Weibull_Shape", label: "Jam Shape (k)", type: "number" },
  { key: "Jam_Weibull_Scale", label: "Jam Scale (λ)", type: "number" },
];

const JOB_COLS = [
  { key: "Job_Type", label: "Job Type", type: "text" },
  { key: "Target_Demand", label: "Target Demand", type: "number" },
  { key: "Batch_Size", label: "Batch Size", type: "number" },
  { key: "Priority", label: "Priority", type: "number" },
];

const ROUTING_COLS = [
  { key: "Job_Type", label: "Job Type", type: "text" },
  { key: "Sequence_Order", label: "Seq", type: "number" },
  { key: "Machine_ID", label: "Machine ID", type: "text" },
  { key: "Process_Time_Per_Unit", label: "Proc/Unit", type: "number" },
  { key: "Setup_Time_Base", label: "Setup Base", type: "number" },
  { key: "Setup_Time_Std", label: "Setup Std", type: "number" },
  { key: "Requires_Forklift", label: "Forklift?", type: "text" },
];

function EditableTable({
  rows, cols, onChange,
}: {
  rows: Record<string, any>[];
  cols: { key: string; label: string; type: string }[];
  onChange: (newRows: Record<string, any>[]) => void;
}) {
  const update = (i: number, key: string, val: any) => {
    const updated = rows.map((r, ri) =>
      ri === i ? { ...r, [key]: val } : r
    );
    onChange(updated);
  };
  const removeRow = (i: number) => onChange(rows.filter((_, ri) => ri !== i));
  const addRow = () => {
    const empty: Record<string, any> = {};
    cols.forEach(c => { empty[c.key] = c.type === "number" ? 1 : ""; });
    onChange([...rows, empty]);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-muted/60">
            {cols.map(c => (
              <th key={c.key} className="px-2 py-1.5 text-left font-semibold text-muted-foreground border border-border whitespace-nowrap">
                {c.label}
              </th>
            ))}
            <th className="px-2 py-1.5 border border-border w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30">
              {cols.map(c => (
                <td key={c.key} className="border border-border p-0">
                  <input
                    type={c.type}
                    value={row[c.key] ?? ""}
                    onChange={e => update(i, c.key, c.type === "number" ? Number(e.target.value) : e.target.value)}
                    className="w-full px-2 py-1 bg-transparent outline-none focus:bg-primary/5 min-w-[60px]"
                  />
                </td>
              ))}
              <td className="border border-border">
                <button onClick={() => removeRow(i)} className="p-1 text-destructive hover:bg-destructive/10 rounded w-full flex items-center justify-center">
                  <Trash2 className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add Row
      </button>
    </div>
  );
}

export const Sidebar = () => {
  const location = useLocation();
  const [configOpen, setConfigOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<FactoryConfig | null>(null);
  const [editTab, setEditTab] = useState<"machines" | "jobs" | "routings">("machines");
  const [isRunning, setIsRunning] = useState(false);
  const [numRuns, setNumRuns] = useState(1);

  const { isMutating, setData } = useSimulation();

  // Load default config if sandbox is open and empty
  useEffect(() => {
    if (configOpen && !config) {
      setConfigLoading(true);
      fetchConfig()
        .then(c => setConfig(c))
        .catch(e => {
          console.error("Config load error:", e);
          toast.error("Failed to load factory configuration.");
        })
        .finally(() => setConfigLoading(false));
    }
  }, [configOpen]);

  const handleJsonRun = async () => {
    if (!config) return;
    
    // --- TARGETED VALIDATION ---
    const errs: string[] = [];

    // Validate Machines
    config.machines.forEach(m => {
      if (!m.Machine_ID) errs.push(`Unnamed machine detected.`);
      if (m.Count <= 0) errs.push(`Machine ${m.Machine_ID || '?'} must have Count > 0.`);
      if (m.Input_Buffer_Capacity <= 0) errs.push(`Machine ${m.Machine_ID || '?'} must have Buffer > 0.`);
      if (m.Processing_Time_Mean <= 0) errs.push(`Machine ${m.Machine_ID || '?'} must have Processing Time > 0.`);
    });

    // Validate Jobs
    config.jobs.forEach(j => {
      if (!j.Job_Type) errs.push(`Unnamed job type detected.`);
      if (j.Target_Demand <= 0) errs.push(`Job ${j.Job_Type || '?'} must have Demand > 0.`);
    });

    // Validate Routings
    config.routings.forEach((r, i) => {
      if (!r.Machine_ID) errs.push(`Routing step ${i+1} is missing a Machine ID.`);
      if (r.Process_Time_Per_Unit <= 0) errs.push(`Routing step ${i+1} (${r.Job_Type}) must have Process Time > 0.`);
    });

    if (errs.length > 0) {
      // Show ONLY the first 2 unique errors so we don't spam the toast
      const unique = Array.from(new Set(errs)).slice(0, 2);
      unique.forEach(err => toast.error("Simulation Blocked", { description: err }));
      return;
    }

    setIsRunning(true);
    try {
      const result = await runJsonSimulation({ 
        ...config, 
        // Force strings to be trimmed
        machines: config.machines.map(m => ({ ...m, Machine_ID: String(m.Machine_ID).trim() })),
        jobs: config.jobs.map(j => ({ ...j, Job_Type: String(j.Job_Type).trim() })),
        routings: config.routings.map(r => ({ ...r, Machine_ID: String(r.Machine_ID).trim(), Job_Type: String(r.Job_Type).trim() })),
      }, numRuns);
      setData(result, config); // Pass both result AND the config used to generate it
      setConfigOpen(false);
      toast.success("Simulation Success", { description: "Analytical twin updated with sandbox config." });
    } catch (e: any) {
      console.error(e);
      toast.error(`Simulation Failed: ${e.message || "Engine Error"}`);
    } finally {
      setIsRunning(false);
    }
  };

  const resetConfig = () => {
    setConfig(null);
    setConfigLoading(true);
    fetchConfig()
      .then(c => setConfig(c))
      .finally(() => setConfigLoading(false));
  };

  const busy = isMutating || isRunning;

  return (
    <aside className="w-56 sidebar-gradient flex flex-col shrink-0">
      <div className="px-5 py-6 flex items-center justify-start">
        <img 
          src={logo} 
          alt="AUTONEX Logo" 
          className="h-9 w-auto object-contain opacity-95 hover:opacity-100 transition-opacity" 
        />
      </div>

      {/* Simulation Config Button */}
      <div className="px-3 mb-3">
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/80 transition-colors">
              <Play className="h-4 w-4" />
              Simulation Config
            </button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Simulation Configuration</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto mt-4 px-1">
              <div className="space-y-6">
                {/* ── Baseline Management Section ── */}
                <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border border-border/50">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Import Excel Baseline
                    </label>
                    <div className="relative group">
                      <input
                        type="file"
                        accept=".xlsx"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            setFile(f);
                            setConfigLoading(true);
                            try {
                              const parsed = await fetchConfigFromFile(f);
                              setConfig(parsed);
                              toast.success("Baseline Imported", { description: `${f.name} loaded into sandbox.` });
                            } catch (err: any) {
                              toast.error("Import Error", { description: err.message || "Failed to parse .xlsx file." });
                            } finally {
                              setConfigLoading(false);
                            }
                          }
                        }}
                      />
                      <div className="px-4 py-2 bg-background border rounded border-border group-hover:border-primary transition-colors text-xs text-muted-foreground flex items-center justify-center gap-2">
                        {file ? `✓ ${file.name}` : "Click to load new .xlsx"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 flex flex-col justify-end">
                    <button
                      onClick={resetConfig}
                      className="w-full h-9 flex items-center justify-center gap-2 text-xs font-medium bg-background border border-border text-foreground hover:bg-muted/50 rounded transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Revert to System Defaults
                    </button>
                    <p className="text-[10px] text-muted-foreground italic text-center">Resets all sandbox tables to standard values</p>
                  </div>
                </div>

                <div className="space-y-4 pb-4">
                  {configLoading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4 text-muted-foreground animate-pulse">
                      <RefreshCw className="h-8 w-8 animate-spin" />
                      <p className="text-sm font-medium">Populating sandbox tables...</p>
                    </div>
                  ) : config ? (
                    <>
                      <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg w-fit">
                        {([
                          { id: "machines", label: "⚙️ Machines" },
                          { id: "jobs", label: "📦 Jobs" },
                          { id: "routings", label: "🔀 Routings" },
                        ] as const).map(et => (
                          <button
                            key={et.id}
                            onClick={() => setEditTab(et.id)}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                              editTab === et.id
                                ? "bg-background text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {et.label}
                          </button>
                        ))}
                      </div>

                      <div className="bg-background rounded-lg border border-border p-1">
                        {editTab === "machines" && (
                          <EditableTable
                            rows={config.machines}
                            cols={MACHINE_COLS.filter(c => config.machines[0] && c.key in config.machines[0])}
                            onChange={rows => setConfig({ ...config, machines: rows })}
                          />
                        )}
                        {editTab === "jobs" && (
                          <EditableTable
                            rows={config.jobs}
                            cols={JOB_COLS.filter(c => config.jobs[0] && c.key in config.jobs[0])}
                            onChange={rows => setConfig({ ...config, jobs: rows })}
                          />
                        )}
                        {editTab === "routings" && (
                          <div className="space-y-2">
                             <p className="text-[10px] text-muted-foreground px-2 pt-1 font-medium italic">
                               Defining the sequence and process parameters for each product type.
                             </p>
                             <EditableTable
                               rows={config.routings}
                               cols={ROUTING_COLS.filter(c => config.routings[0] && c.key in config.routings[0])}
                               onChange={rows => setConfig({ ...config, routings: rows })}
                             />
                          </div>
                        )}
                      </div>

                      {/* ── Final Configuration & Execution ── */}
                      <div className="pt-4 border-t border-border space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground">Statistical Accuracy</h4>
                            <p className="text-xs text-muted-foreground">Number of parallel simulations to average</p>
                          </div>
                          <div className="flex items-center gap-4 bg-muted/40 px-3 py-2 rounded-lg border border-border">
                             <input
                              type="range"
                              min={1}
                              max={50}
                              step={1}
                              value={numRuns}
                              onChange={e => setNumRuns(Number(e.target.value))}
                              className="w-32 h-1.5 rounded-full appearance-none cursor-pointer accent-primary bg-muted"
                            />
                            <span className="text-sm font-bold text-primary w-12 text-center">{numRuns} Runs</span>
                          </div>
                        </div>

                        <button
                          onClick={handleJsonRun}
                          disabled={busy}
                          className="w-full h-12 rounded-lg bg-primary text-primary-foreground text-base font-extrabold hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {busy ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                          {busy ? `Simulating ${numRuns} Cycles...` : `Deploy Sandbox Twin ×${numRuns}`}
                        </button>
                        
                        <p className="text-[11px] text-center text-muted-foreground">
                          Sandbox modifications only reflect in memory and won't overwrite system assets.
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
