import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { useSimulation } from "@/hooks/useSimulation";

const OrderTracking = () => {
  const { data, isLoading } = useSimulation();

  if (isLoading || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground animate-pulse">Loading job data...</div>
    );
  }

  const jobsData = Object.entries(data.Completed_Jobs).map(([name, completed], idx) => {
    const target = Math.max(1000, completed as number); 
    const eff = ((completed as number) / target) * 100;
    return {
      id: `J${idx}`,
      name: name,
      completed: completed as number,
      target: target,
      efficiency: Math.round(eff * 10) / 10,
      status: eff >= 100 ? "Complete" : eff >= 80 ? "On Track" : "Delayed"
    };
  });

  let maxHour = 0;
  data.Batch_Metrics.forEach((b: any) => {
    if (b.End_Time) {
      const hr = Math.floor(b.End_Time / 60);
      if (hr > maxHour) maxHour = hr;
    }
  });
  
  const hourlyCounts = new Array(maxHour + 1).fill(0);
  data.Batch_Metrics.forEach((b: any) => {
    if (b.End_Time) {
      const hr = Math.floor(b.End_Time / 60);
      hourlyCounts[hr] += b.Units || 0;
    }
  });
  
  const hourlyExits = hourlyCounts.map((count, hr) => ({
    hour: `Hr ${hr + 1}`,
    boxes: count
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Order Tracking — Job Progress</h1>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground">
              <th className="text-left px-4 py-3 font-medium">Job Type</th>
              <th className="text-right px-4 py-3 font-medium">Completed</th>
              <th className="text-right px-4 py-3 font-medium">Target Demand</th>
              <th className="text-right px-4 py-3 font-medium">Efficiency</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobsData.map((job) => (
              <tr key={job.id} className="border-t hover:bg-muted/50 transition-colors">
                <td className="px-4 py-3 font-medium">{job.name}</td>
                <td className="px-4 py-3 text-right font-medium">{job.completed.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{job.target.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <span className={job.efficiency >= 95 ? "text-success" : job.efficiency >= 80 ? "text-foreground" : "text-destructive"}>
                    {job.efficiency}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    job.status === "Complete" ? "bg-success/10 text-success" :
                    job.status === "On Track" ? "bg-info/10 text-info" :
                    "bg-destructive/10 text-destructive"
                  }`}>
                    {job.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-1">Hourly Factory Exit Rate</h2>
        <p className="text-xs text-muted-foreground mb-4">Boxes successfully exiting final machine per hour (Batch_Metrics.End_Time)</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyExits}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220,13%,91%)", fontSize: "12px" }} />
              <Bar dataKey="boxes" fill="hsl(222, 47%, 14%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
