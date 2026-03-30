import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { AIInsightsPanel } from "@/components/dashboard/AIInsightsPanel";
import { MessageSquare, X } from "lucide-react";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const [aiOpen, setAiOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopNav />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6 bg-background custom-scrollbar">
            {children}
          </main>
          
          {/* Persistent AI Panel - Kept mounted to preserve scroll & state */}
          <div className={`w-96 border-l bg-card flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
            aiOpen ? "translate-x-0 opacity-100 shadow-2xl" : "translate-x-full absolute right-0 opacity-0 pointer-events-none"
          }`}>
            <div className="h-14 px-4 flex items-center justify-between border-b">
              <span className="text-sm font-semibold text-foreground">AI Simulation Analyst</span>
              <button onClick={() => setAiOpen(false)} className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <AIInsightsPanel />
          </div>
        </div>
      </div>

      {/* Floating AI trigger */}
      {!aiOpen && (
        <button
          onClick={() => setAiOpen(true)}
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-50"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};
