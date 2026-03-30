import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export const StatCard = ({ title, subtitle, children }: StatCardProps) => (
  <div className="bg-card rounded-lg border p-5 shadow-sm">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    <div className="mt-2">{children}</div>
  </div>
);
