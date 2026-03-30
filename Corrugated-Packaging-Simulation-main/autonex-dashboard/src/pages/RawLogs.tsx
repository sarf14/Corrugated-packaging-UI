import { FileSpreadsheet, Download, Database } from "lucide-react";

const logs = [
  { id: 1, name: "Simulation Event Log", source: "pd.DataFrame(self.log_events)", rows: "24,318", format: "CSV", size: "3.8 MB", desc: "Every discrete event: arrivals, starts, completions, jams, clears" },
  { id: 2, name: "Machine State Timeline", source: "pd.DataFrame(self.state_timeline)", rows: "8,640", format: "CSV", size: "1.4 MB", desc: "Second-by-second state of each machine (processing, setup, starved, blocked, failed)" },
  { id: 3, name: "Batch Flow Metrics", source: "pd.DataFrame(self.batch_metrics)", rows: "5,812", format: "CSV", size: "0.9 MB", desc: "Per-batch: arrival_time, start_time, end_time, flow_time, wait_time, machine_path" },
  { id: 4, name: "Queue Size Snapshots", source: "WIP_Timeline", rows: "960", format: "CSV", size: "0.2 MB", desc: "Queue depth at each machine sampled every 30 seconds" },
  { id: 5, name: "Machine Failure Log", source: "self.failure_events", rows: "87", format: "CSV", size: "0.04 MB", desc: "Weibull jam events: machine, time_to_fail, repair_duration, cause" },
  { id: 6, name: "Aggregated Run Summary", source: "multi-run stats", rows: "10", format: "CSV", size: "0.01 MB", desc: "Cross-run averages: throughput, flow_time, utilization, WIP per run" },
];

const RawLogs = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Raw Simulation Logs</h1>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
          <Download className="h-4 w-4" /> Export All (.zip)
        </button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Log Name</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rows</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Size</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-medium">{log.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.desc}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{log.source}</code>
                </td>
                <td className="px-4 py-3 text-right font-medium">{log.rows}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.size}</td>
                <td className="px-4 py-3 text-center">
                  <button className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                    <Download className="h-3 w-3" /> Download .csv
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RawLogs;
