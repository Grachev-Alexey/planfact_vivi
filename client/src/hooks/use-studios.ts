import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertStudio } from "@shared/schema";

export function useStudios() {
  return useQuery({
    queryKey: [api.studios.list.path],
    queryFn: async () => {
      const res = await fetch(api.studios.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch studios");
      return api.studios.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertStudio) => {
      const res = await fetch(api.studios.create.path, {
        method: api.studios.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create studio");
      return api.studios.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.studios.list.path] }),
  });
}

export function useDeleteStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.studios.delete.path, { id });
      const res = await fetch(url, { method: api.studios.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete studio");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.studios.list.path] }),
  });
}
