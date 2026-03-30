export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  machine?: string;
  timestamp: string;
  category: "bottleneck" | "jam" | "starvation" | "wip" | "throughput";
}

export interface SimulationData {
  Total_Time: number;
  Completed_Jobs: Record<string, number>;
  Machine_Stats: Record<string, {
    working_time: number;
    setup_time: number;
    down_time: number;
    blocked_time: number;
    starved_time: number;
    completed_operations: number;
  }>;
  Machine_State_Agg: Record<string, {
    Processing: number;
    Setup: number;
    Starved: number;
    Blocked: number;
    Failed: number;
    Idle: number;
  }>;
  WIP_Timeline: any[];
  State_Timeline: any[];
  Batch_Metrics: any[];
  Alerts: Alert[];
}

let rawBase = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").trim().replace(/\/$/, "");
if (!rawBase.startsWith("http")) {
  rawBase = `https://${rawBase}`;
}
const API_BASE_URL = rawBase;
const API_URL = `${API_BASE_URL}/api`;

export const fetchDefaultSimulation = async (): Promise<SimulationData> => {
  const res = await fetch(`${API_URL}/simulate/default`);
  if (!res.ok) throw new Error("Backend not reachable");
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message || "Simulation error");
  return json.data;
};

export const runCustomSimulation = async (file: File | null = null, numRuns: number = 1): Promise<SimulationData> => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  formData.append("num_runs", numRuns.toString());
  const res = await fetch(`${API_URL}/simulate`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Backend not reachable");
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message || "Simulation error");
  return json.data;
};

export interface FactoryConfig {
  machines: Record<string, any>[];
  jobs: Record<string, any>[];
  routings: Record<string, any>[];
}

export const fetchConfig = async (): Promise<FactoryConfig> => {
  const res = await fetch(`${API_URL}/config`);
  if (!res.ok) throw new Error("Cannot fetch config");
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message);
  return json.data;
};

export const fetchConfigFromFile = async (file: File): Promise<FactoryConfig> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/config/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Cannot parse uploaded config");
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message);
  return json.data;
};

export const runJsonSimulation = async (config: FactoryConfig, numRuns: number = 1): Promise<SimulationData> => {
  const res = await fetch(`${API_URL}/simulate/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...config, num_runs: numRuns }),
  });
  if (!res.ok) throw new Error("Backend not reachable");
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message || "Simulation error");
  return json.data;
};



export const sendChatMessage = async (
  question: string,
  simSummary: Partial<SimulationData>,
  history: { role: "user" | "assistant"; content: string }[] = [],
  currentConfig: FactoryConfig | null = null,
  sessionHistory: { label: string; metrics: any }[] = []
): Promise<string> => {
  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      question, 
      sim_summary: simSummary, 
      history,
      current_config: currentConfig,
      session_history: sessionHistory
    }),
  });
  if (!res.ok) throw new Error("Chat API not reachable");
  const json = await res.json();
  return json.reply;
};

