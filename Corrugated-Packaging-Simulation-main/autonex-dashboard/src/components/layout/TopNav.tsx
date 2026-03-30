import { Search } from "lucide-react";

export const TopNav = () => {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
      <div className="text-sm font-semibold text-foreground">
        Digital Twin — Factory Simulator
      </div>

      <div className="flex items-center gap-4">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
          JD
        </div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search"
            className="h-8 w-40 rounded-md border bg-muted/50 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    </header>
  );
};
