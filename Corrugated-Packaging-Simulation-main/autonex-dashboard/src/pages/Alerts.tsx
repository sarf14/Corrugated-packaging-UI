import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, Clock, Cpu, TrendingDown, Layers } from "lucide-react";
import { useSimulation } from "@/hooks/useSimulation";

const severityConfig = {
  critical: { icon: AlertCircle, color: "bg-red-500/10 text-red-600 border-red-500/20", badge: "bg-red-500 text-white" },
  warning: { icon: AlertTriangle, color: "bg-amber-500/10 text-amber-600 border-amber-500/20", badge: "bg-amber-500 text-white" },
  info: { icon: Info, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", badge: "bg-blue-500 text-white" },
};

const categoryIcons: any = {
  bottleneck: Layers,
  jam: Cpu,
  starvation: TrendingDown,
  wip: Layers,
  throughput: TrendingDown,
};

const Alerts = () => {
  const { data, isLoading } = useSimulation();

  if (isLoading || !data) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-muted-foreground animate-pulse">
        Loading simulation alerts...
      </div>
    );
  }

  const alerts = (data.Alerts || []) as any[];
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const infoCount = alerts.filter((a) => a.severity === "info").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alerts & Bottleneck Events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real alerts generated from the SimPy engine — bottlenecks, jams, starvation, and throughput anomalies.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical Alerts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{warningCount}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Info className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{infoCount}</p>
              <p className="text-xs text-muted-foreground">Info</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Alerts — Current Simulation Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alerts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No alerts — factory ran smoothly!</p>
          )}
          {alerts.map((alert) => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
            const Icon = config.icon;
            const CatIcon = categoryIcons[alert.category] || TrendingDown;
            return (
              <div key={alert.id} className={`rounded-lg border p-4 ${config.color}`}>
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{alert.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badge}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs mt-1.5 opacity-90 leading-relaxed">{alert.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] opacity-70">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{alert.timestamp}</span>
                      {alert.machine && <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{alert.machine}</span>}
                      <span className="flex items-center gap-1"><CatIcon className="h-3 w-3" />{alert.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default Alerts;
