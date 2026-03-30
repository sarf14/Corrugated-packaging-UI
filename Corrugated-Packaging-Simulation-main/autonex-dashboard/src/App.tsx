import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import OrderTracking from "./pages/OrderTracking.tsx";
import MachineUtilization from "./pages/MachineUtilization.tsx";
import RawLogs from "./pages/RawLogs.tsx";
import Alerts from "./pages/Alerts.tsx";
import NotFound from "./pages/NotFound.tsx";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/orders" element={<OrderTracking />} />
            <Route path="/machines" element={<MachineUtilization />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/logs" element={<RawLogs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
