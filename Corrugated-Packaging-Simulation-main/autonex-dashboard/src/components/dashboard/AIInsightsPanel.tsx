import { useState, useEffect } from "react";
import { Send, Bot, User, Loader2, ArrowRight, CheckCircle2, Factory, Clock, Package } from "lucide-react";
import { useSimulation } from "@/hooks/useSimulation";
import { useChat } from "@/hooks/useChat";
import { sendChatMessage, SimulationData, FactoryConfig } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "Where is the main bottleneck?",
  "What caused the longest jam?",
  "Summarize machine utilization",
  "What is the current WIP level?",
  "Which machine needs attention?",
];

const ComparisonMetric = ({ label, current, scenario, unit = "", isLowerBetter = false, icon: Icon }: any) => {
  const curVal = typeof current === 'number' ? current : 0;
  const sceVal = typeof scenario === 'number' ? scenario : 0;
  const diff = sceVal - curVal;
  const percent = curVal !== 0 ? (diff / curVal) * 100 : 0;
  
  const isImprovement = isLowerBetter ? diff < 0 : diff > 0;
  const showDiff = diff !== 0;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-muted/50">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground line-through opacity-50">{curVal.toLocaleString()}{unit}</div>
          <div className="text-xs font-bold">{sceVal.toLocaleString()}{unit}</div>
        </div>
        {showDiff && (
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isImprovement ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {diff > 0 ? '+' : ''}{percent.toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
};

export const AIInsightsPanel = () => {
  const { data: baseline, config: baselineConfig, runJsonSimulation, setData } = useSimulation();
  const { messages, setMessages, sandboxResults, setSandboxResults, history, addToHistory } = useChat();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState<Record<number, boolean>>({});

  // Auto-snap simulation baseline into history for AI memory
  useEffect(() => {
    if (baseline && baseline.Total_Time) {
      // Check if this result is already in history to avoid duplicates on re-renders
      const last = history[history.length - 1];
      const currentSnapshot = {
        throughput: Object.values(baseline.Completed_Jobs || {}).reduce((a: any, b: any) => a + Number(b), 0),
        time: Math.round(baseline.Total_Time),
        bottleneck: getTopBottleneck(baseline.Machine_Stats)
      };

      if (!last || last.metrics.throughput !== currentSnapshot.throughput || last.metrics.time !== currentSnapshot.time) {
        addToHistory(`Run ${history.length + 1}`, currentSnapshot);
      }
    }
  }, [baseline, history.length, addToHistory]);

  const parseProposal = (text: string) => {
    const match = text.match(/\[\[PROPOSAL: (\{.*?\})\]\]/s);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error("Failed to parse proposal JSON", e);
      }
    }
    return null;
  };

  const executeScenario = async (idx: number, proposal: any) => {
    setIsSimulating(prev => ({ ...prev, [idx]: true }));
    try {
      const result = await runJsonSimulation(proposal);
      setSandboxResults(prev => ({ ...prev, [idx]: result }));
    } catch (e: any) {
      console.error("Scenario execution failed", e);
    } finally {
      setIsSimulating(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const history_context = messages
        .slice(1)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await sendChatMessage(msg, {
        Total_Time: baseline?.Total_Time,
        Completed_Jobs: baseline?.Completed_Jobs,
        Machine_Stats: baseline?.Machine_Stats,
        Alerts: baseline?.Alerts,
      }, history_context, baselineConfig || null, history); // Pass history to backend
      
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Could not reach the backend. Make sure the Python server is running." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getTopBottleneck = (stats: any) => {
    if (!stats) return "N/A";
    const entries = Object.entries(stats);
    if (entries.length === 0) return "N/A";
    return entries.sort((a: any, b: any) => b[1].blocked_time - a[1].blocked_time)[0][0];
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => {
          const proposal = m.role === "assistant" ? parseProposal(m.content) : null;
          const cleanContent = m.content.replace(/\[\[PROPOSAL: .*?\]\]/s, "").trim();
          const scenarioData = sandboxResults[i];
          const running = isSimulating[i];

          const baselineThroughput = baseline?.Completed_Jobs ? Object.values(baseline.Completed_Jobs).reduce((a, b) => a + b, 0) : 0;
          const scenarioThroughput = scenarioData?.Completed_Jobs ? Object.values(scenarioData.Completed_Jobs).reduce((a, b) => a + b, 0) : 0;

          return (
            <div key={i} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  m.role === "assistant" ? "bg-primary/10" : "bg-primary"
                }`}>
                  {m.role === "assistant" ? <Bot className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-primary-foreground" />}
                </div>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {cleanContent}
                </div>
              </div>
              
              {proposal && (
                <div className="ml-8 mt-1 p-0 border rounded-xl bg-card overflow-hidden shadow-md border-primary/20 max-w-[90%] animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 bg-primary/5 border-b border-primary/10">
                    <p className="text-xs font-bold flex items-center gap-1.5 text-primary">
                      <Factory className="h-3.5 w-3.5" />
                      Proposed What-If Scenario
                    </p>
                  </div>
                  
                  <div className="p-3">
                    {!scenarioData ? (
                      <>
                        <div className="text-[10px] text-muted-foreground mb-3 grid grid-cols-2 gap-2">
                          {Object.keys(proposal).map(key => (
                            <div key={key} className="bg-muted/50 px-2 py-1 rounded border border-border/50">
                              <span className="font-semibold">{key}:</span> {proposal[key].length} entries
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => executeScenario(i, proposal)}
                          disabled={running}
                          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                        >
                          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                          {running ? "Averaging 20 Simulations..." : "Run Scenario Sandbox (×20 avg)"}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-1 animate-in zoom-in-95 duration-300">
                        <ComparisonMetric 
                          label="Total Throughput" 
                          current={baselineThroughput} 
                          scenario={scenarioThroughput} 
                          unit=" units" 
                          icon={Package}
                        />
                        <ComparisonMetric 
                          label="Simulation Time" 
                          current={baseline?.Total_Time} 
                          scenario={scenarioData.Total_Time} 
                          unit=" min" 
                          isLowerBetter={true} 
                          icon={Clock}
                        />
                        
                        <div className="mt-3 pt-3 flex items-center justify-between border-t border-dashed">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Bottleneck Shift</span>
                            <div className="flex items-center gap-1 text-[10px] font-bold">
                              <span className="text-muted-foreground/60">{getTopBottleneck(baseline?.Machine_Stats)}</span>
                              <ArrowRight className="h-2 w-2" />
                              <span className="text-primary">{getTopBottleneck(scenarioData.Machine_Stats)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setData(scenarioData, proposal)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-md text-[10px] font-bold hover:bg-green-600 transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Apply to Main Dash
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing simulation data...
            </div>
          </div>
        )}
      </div>

      {/* Starter prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-xs px-2.5 py-1.5 rounded-full border hover:bg-muted transition-colors text-muted-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about the simulation…"
            className="flex-1 h-9 rounded-md border bg-muted/50 px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading}
            className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
