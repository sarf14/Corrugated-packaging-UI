import React from "react";
import { SimulationData } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Trophy, ArrowUpRight } from "lucide-react";

interface WIPLeaderboardProps {
  machineStats: SimulationData["Machine_Stats"];
}

export const WIPLeaderboard = ({ machineStats }: WIPLeaderboardProps) => {
  // Extract and sort machines by average WIP contribution
  const leaderboard = Object.entries(machineStats)
    .map(([id, stats]) => ({
      id,
      // Fallback to 0 if average_wip doesn't exist yet (before engine update runs)
      avgWip: (stats as any).average_wip || 0,
    }))
    .sort((a, b) => b.avgWip - a.avgWip);

  const maxWip = Math.max(...leaderboard.map((m) => m.avgWip), 1);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-none tracking-tight flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            WIP Contribution Leaderboard
          </h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            Ranking machines by time-weighted average buffer length
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-50" />
      </div>
      <div className="p-6 pt-0 space-y-4">
        {leaderboard.map((machine, index) => (
          <div key={machine.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-4">#{index + 1}</span>
                <span className="font-semibold">{machine.id}</span>
              </div>
              <span className="font-mono font-bold text-primary">
                {machine.avgWip.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground tracking-tighter">avg units</span>
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
               <div 
                className="h-full bg-primary transition-all duration-500 ease-in-out" 
                style={{ width: `${(machine.avgWip / maxWip) * 100}%` }}
               />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
