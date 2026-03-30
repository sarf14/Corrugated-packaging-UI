import { StatCard } from "@/components/dashboard/StatCard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Clock, TrendingUp } from "lucide-react";
import { useSimulation } from "@/hooks/useSimulation";
import { WIPLeaderboard } from "@/components/dashboard/WIPLeaderboard";

const CHART_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
  "#10b981", // Emerald
];

const STATE_COLORS = {
  Processing: "#22c55e",
  Setup: "#3b82f6",
  Starved: "#94a3b8",
  Blocked: "#f97316",
  Failed: "#ef4444"
};

const Index = () => {
  const { data, isLoading, isError } = useSimulation();

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="font-semibold tracking-tight">Booting SimPy physics engine...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-destructive font-medium">
        Error loading simulation data. Is the backend running?
      </div>
    );
  }

  // --- METRIC CARDS ---
  const totalCompleted = Object.values(data.Completed_Jobs).reduce((a: any, b: any) => a + b, 0);

  const validBatches = data.Batch_Metrics.filter((b: any) => typeof b.Flow_Time === "number" && b.Flow_Time > 0);
  const avgFlowTimeMins = validBatches.length > 0
    ? validBatches.reduce((a: any, b: any) => a + b.Flow_Time, 0) / validBatches.length
    : 0;

  const simTimeHours = data.Total_Time / 60;
  const avgThroughput = simTimeHours > 0 ? Math.round(totalCompleted / simTimeHours) : 0;

  const peakWip = data.WIP_Timeline.length > 0
    ? Math.max(...data.WIP_Timeline.map((w: any) => w.Global_WIP || 0))
    : 0;

  let totalDowntime = 0;
  Object.values(data.Machine_Stats).forEach((stats: any) => {
    totalDowntime += stats.down_time || 0;
  });

  // --- WIP CHART ---
  const wipKeys = data.WIP_Timeline.length > 0
    ? Object.keys(data.WIP_Timeline[0]).filter(k => k !== "Time" && k !== "Global_WIP")
    : [];

  const raw = data.WIP_Timeline;
  const step = Math.max(1, Math.floor(raw.length / 100));
  const wipTimeline = raw
    .filter((_: any, i: number) => i % step === 0)
    .map((w: any) => {
      const point: any = { time: `${Math.round(w.Time / 60)}h` };
      wipKeys.forEach(k => { point[k] = w[k] || 0; });
      return point;
    });

  // --- MACHINE STATE DONUT ---
  const stateAgg: Record<string, number> = {
    Processing: 0, Setup: 0, Starved: 0, Blocked: 0, Failed: 0
  };
  Object.values(data.Machine_Stats).forEach((stats: any) => {
    stateAgg.Processing += stats.working_time || 0;
    stateAgg.Setup += stats.setup_time || 0;
    stateAgg.Starved += stats.starved_time || 0;
    stateAgg.Blocked += stats.blocked_time || 0;
    stateAgg.Failed += stats.down_time || 0;
  });
  const stateTotal = Object.values(stateAgg).reduce((a, b) => a + b, 0) || 1;
  const machineStates = Object.entries(stateAgg)
    .filter(([_, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value: Math.round((value / stateTotal) * 100),
      color: (STATE_COLORS as any)[name],
    }))
    .sort((a, b) => b.value - a.value);

  const topState = machineStates[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            Analytical Twin Dashboard{" "}
            <span className="text-muted-foreground font-normal text-sm">
              | Corrugated Factory Real-Time Physics Mode
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-card border rounded-md px-3 py-1.5 text-xs font-bold text-muted-foreground shadow-sm">
          <Clock className="h-3.5 w-3.5" />
          RUN TIME: {Math.round(simTimeHours * 10) / 10} HOURS
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard title="Total Throughput" subtitle="boxes produced (all types)">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{totalCompleted.toLocaleString()}</span>
          </div>
        </StatCard>

        <StatCard title="Cycle Time" subtitle="Avg Batch Flow (min)">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{avgFlowTimeMins.toFixed(1)}</span>
            <span className="text-sm font-semibold text-muted-foreground">MIN</span>
          </div>
        </StatCard>

        <StatCard title="Throughput Rate" subtitle="units produced / hour">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{avgThroughput.toLocaleString()}</span>
            <span className="text-sm font-semibold text-muted-foreground">U/H</span>
          </div>
        </StatCard>

        <StatCard title="Peak WIP" subtitle="Max concurrent batches">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{peakWip}</span>
          </div>
        </StatCard>

        <StatCard title="Total Downtime" subtitle="Mechanical failures (min)">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{Math.round(totalDowntime)}</span>
            <span className="text-sm font-semibold text-muted-foreground">MIN</span>
          </div>
        </StatCard>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-foreground">Buffer Occupancy (WIP)</h2>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Queue size at each machine input</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-muted-foreground">
                {wipKeys.slice(0, 4).map((k, i) => (
                  <div key={k} className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded border">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                    {k}
                  </div>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={wipTimeline}>
                  <defs>
                    {wipKeys.slice(0, 4).map((k, i) => (
                      <linearGradient key={k} id={`grad_${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0.0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 500 }} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 500 }} />
                  <Tooltip 
                     contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", fontSize: "11px" }} 
                  />
                  {wipKeys.slice(0, 4).map((k, i) => (
                    <Area
                      key={k}
                      type="stepAfter"
                      dataKey={k}
                      stroke={CHART_COLORS[i]}
                      fill={`url(#grad_${i})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <WIPLeaderboard machineStats={data.Machine_Stats} />
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-bold text-foreground mb-1">State Distribution</h3>
            <p className="text-[10px] text-muted-foreground mb-6 font-medium uppercase tracking-tighter">Aggregate shift efficiency</p>
            <div className="flex items-center justify-center py-4">
              <div className="relative h-44 w-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={machineStates} innerRadius={55} outerRadius={75} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                      {machineStates.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-foreground tracking-tight">{topState?.value ?? 0}%</span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{topState?.name ?? "Idle"}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-2.5">
              {machineStates.map((s) => (
                <div key={s.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-all">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <div className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-xs font-bold text-foreground">{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
