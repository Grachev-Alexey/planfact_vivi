import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertTransaction } from "@shared/schema";

export function useTransactions(filters?: { startDate?: string; endDate?: string; studioId?: string }) {
  const queryKey = [api.transactions.list.path, filters];
  return useQuery({
    queryKey,
    queryFn: async () => {
      let url = api.transactions.list.path;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        if (filters.studioId) params.append("studioId", filters.studioId);
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return api.transactions.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTransaction) => {
      const payload = {
        ...data,
        amount: Number(data.amount), // ensure number
        date: new Date(data.date).toISOString() // ensure ISO string
      };
      
      const res = await fetch(api.transactions.create.path, {
        method: api.transactions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create transaction");
      return api.transactions.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] }); // balances change
      queryClient.invalidateQueries({ queryKey: [api.reports.cashflow.path] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.transactions.delete.path, { id });
      const res = await fetch(url, { method: api.transactions.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete transaction");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.transactions.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.accounts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.reports.cashflow.path] });
    },
  });
}
