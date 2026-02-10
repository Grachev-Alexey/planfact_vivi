import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useCashflowReport(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: [api.reports.cashflow.path, filters],
    queryFn: async () => {
      let url = api.reports.cashflow.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cashflow report");
      return await res.json(); // Type is dynamic for reports
    },
  });
}

export function usePnlReport(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: [api.reports.pnl.path, filters],
    queryFn: async () => {
      let url = api.reports.pnl.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch PnL report");
      return await res.json();
    },
  });
}
