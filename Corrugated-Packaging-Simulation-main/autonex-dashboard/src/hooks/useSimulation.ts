import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDefaultSimulation, runCustomSimulation, fetchConfig, runJsonSimulation, SimulationData, FactoryConfig } from "../lib/api";
import { toast } from "sonner";

export const useSimulation = () => {
  const queryClient = useQueryClient();

  const query = useQuery<SimulationData>({
    queryKey: ["simulation"],
    queryFn: fetchDefaultSimulation,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const configQuery = useQuery<FactoryConfig>({
    queryKey: ["config"],
    queryFn: fetchConfig,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const mRun = useMutation({
    mutationFn: async ({ file, numRuns }: { file: File | null; numRuns: number }) => {
      return runCustomSimulation(file, numRuns);
    },
    onMutate: () => {
      toast.loading("Engine starting... Calculating physics...", { id: "sim-toast" });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["simulation"], data);
      toast.success("Simulation complete! Results loaded.", { id: "sim-toast" });
    },
    onError: (err: any) => {
      toast.error(`Engine Failure: ${err.message}`, { id: "sim-toast" });
    },
  });

  const mRunJson = useMutation({
    mutationFn: async (config: FactoryConfig) => {
      // Direct call to API without side effects
      return runJsonSimulation(config);
    },
    onMutate: () => {
      toast.loading("Calculating scenario in sandbox...", { id: "sim-sandbox-toast" });
    },
    onSuccess: () => {
      toast.success("Sandbox simulation complete!", { id: "sim-sandbox-toast" });
    },
    onError: (err: any) => {
      toast.error(`Sandbox Error: ${err.message}`, { id: "sim-sandbox-toast" });
    },
  });

  return {
    data: query.data,
    config: configQuery.data,
    isLoading: query.isLoading || configQuery.isLoading,
    isError: query.isError || configQuery.isError,
    error: query.error || configQuery.error,
    runSimulation: mRun.mutateAsync,
    runJsonSimulation: mRunJson.mutateAsync,
    isMutating: mRun.isPending || mRunJson.isPending,
    setData: (d: SimulationData, c?: FactoryConfig) => {
      queryClient.setQueryData(["simulation"], d);
      if (c) queryClient.setQueryData(["config"], c);
      toast.success("Baseline updated to this scenario.");
    },
  };
};
