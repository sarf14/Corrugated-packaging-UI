import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSimulation } from "@/hooks/useSimulation";

const MachineUtilization = () => {
  const { data, isLoading } = useSimulation();

  if (isLoading || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground animate-pulse">
        Loading machine utilization data...
      </div>
    );
  }

  const STATE_COLORS = {
    processing: "#22c55e", // Green-500
    setup: "#3b82f6",      // Blue-500
    starved: "#94a3b8",    // Slate-400
    blocked: "#f97316",    // Orange-500
    failed: "#ef4444"      // Red-500
  };

  // Build % state breakdown per machine
  const machineStats = Object.entries(data.Machine_Stats).map(([machine, stats]: [string, any]) => {
    const working = stats.working_time || 0;
    const setup = stats.setup_time || 0;
    const starved = stats.starved_time || 1e-6; 
    const blocked = stats.blocked_time || 0;
    const failed = stats.down_time || 0;
    const total = working + setup + starved + blocked + failed || 1;
    return {
      machine,
      processing: (working / total) * 100,
      setup: (setup / total) * 100,
      starved: (starved / total) * 100,
      blocked: (blocked / total) * 100,
      failed: (failed / total) * 100,
    };
  });

  // Build absolute minutes per state
  const ganttData = Object.entries(data.Machine_Stats).map(([machine, stats]: [string, any]) => ({
    machine,
    processing: stats.working_time || 0,
    setup: stats.setup_time || 0,
    starved: stats.starved_time || 0,
    blocked: stats.blocked_time || 0,
    failed: stats.down_time || 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground underline decoration-primary/30 underline-offset-8">
        Machine Utilization Analytical Twin
      </h1>

      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-1">State Breakdown by Machine (%)</h2>
        <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-tighter">Proportion of shift time in each state</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={machineStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
              <YAxis dataKey="machine" type="category" width={120} tick={{ fontSize: 10, fontWeight: 500 }} />
              <Tooltip 
                 formatter={(val: number) => `${val.toFixed(1)}%`}
                 contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "11px" }} 
              />
              <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 600, paddingTop: "10px" }} />
              <Bar dataKey="processing" stackId="a" fill={STATE_COLORS.processing} name="Processing" />
              <Bar dataKey="setup" stackId="a" fill={STATE_COLORS.setup} name="Setup" />
              <Bar dataKey="starved" stackId="a" fill={STATE_COLORS.starved} name="Starved" />
              <Bar dataKey="blocked" stackId="a" fill={STATE_COLORS.blocked} name="Blocked" />
              <Bar dataKey="failed" stackId="a" fill={STATE_COLORS.failed} name="Failed/Jam" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-1">Shift Timeline (minutes)</h2>
        <p className="text-xs text-muted-foreground mb-4 font-medium uppercase tracking-tighter">Cumulative minutes per state across full simulation</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ganttData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} unit=" min" />
              <YAxis dataKey="machine" type="category" width={120} tick={{ fontSize: 10, fontWeight: 500 }} />
              <Tooltip 
                 formatter={(val: number) => `${Math.round(val)} min`}
                 contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "11px" }} 
              />
              <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 600, paddingTop: "10px" }} />
              <Bar dataKey="processing" stackId="a" fill={STATE_COLORS.processing} name="Processing" />
              <Bar dataKey="setup" stackId="a" fill={STATE_COLORS.setup} name="Setup" />
              <Bar dataKey="starved" stackId="a" fill={STATE_COLORS.starved} name="Starved" />
              <Bar dataKey="blocked" stackId="a" fill={STATE_COLORS.blocked} name="Blocked" />
              <Bar dataKey="failed" stackId="a" fill={STATE_COLORS.failed} name="Failed/Jam" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MachineUtilization;
