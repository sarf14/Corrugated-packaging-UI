import { useState, useCallback } from "react";
import { SimulationData } from "@/lib/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

// Persist state in memory outside the hook's lifecycle
// This ensures it survives unmounts and only resets on full PAGE refresh
let globalMessages: Message[] = [
  {
    role: "assistant",
    content: "I'm your simulation analyst. I have access to the real simulation results. Ask me about bottlenecks, machine jams, starvation, utilization, or flow times.",
  },
];

let globalSandboxResults: Record<number, SimulationData> = {};
let globalSimulationHistory: { label: string; metrics: any }[] = [];

export const useChat = () => {
  const [messages, setMessagesState] = useState<Message[]>(globalMessages);
  const [sandboxResults, setSandboxResultsState] = useState<Record<number, SimulationData>>(globalSandboxResults);
  const [history, setHistoryState] = useState<{ label: string; metrics: any }[]>(globalSimulationHistory);

  const setMessages = useCallback((newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof newMessages === 'function') {
      const updated = newMessages(globalMessages);
      globalMessages = updated;
      setMessagesState(updated);
    } else {
      globalMessages = newMessages;
      setMessagesState(newMessages);
    }
  }, []);

  const setSandboxResults = useCallback((newResults: Record<number, SimulationData> | ((prev: Record<number, SimulationData>) => Record<number, SimulationData>)) => {
    if (typeof newResults === 'function') {
      const updated = newResults(globalSandboxResults);
      globalSandboxResults = updated;
      setSandboxResultsState(updated);
    } else {
      globalSandboxResults = newResults;
      setSandboxResultsState(newResults);
    }
  }, []);

  const addToHistory = useCallback((label: string, metrics: any) => {
    const updated = [...globalSimulationHistory, { label, metrics }];
    if (updated.length > 5) updated.shift(); // Keep only last 5 runs to avoid token limit
    globalSimulationHistory = updated;
    setHistoryState(updated);
  }, []);

  return {
    messages,
    setMessages,
    sandboxResults,
    setSandboxResults,
    history,
    addToHistory,
  };
};
