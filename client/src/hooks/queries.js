import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => api.get("/projects") });
}

export function useProject(id, { refetchInterval } = {}) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.get(`/projects/${id}`),
    enabled: !!id,
    ...(refetchInterval ? { refetchInterval } : {}),
  });
}

export function useProjectStatus(id, { refetchInterval } = {}) {
  return useQuery({
    queryKey: ["projectStatus", id],
    queryFn: () => api.get(`/projects/${id}/status`),
    enabled: !!id,
    ...(refetchInterval ? { refetchInterval } : {}),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useClips(projectId, { refetchInterval } = {}) {
  return useQuery({
    queryKey: ["clips", projectId],
    queryFn: () => api.get(`/projects/${projectId}/clips`),
    enabled: !!projectId,
    ...(refetchInterval ? { refetchInterval } : {}),
  });
}

export function useRegenerateClip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, clipId, settings }) => api.post(`/clips/${clipId}/regenerate`, { projectId, settings }),
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ["clips", projectId] }),
  });
}

export function useUpdateCaptionStyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, clipId, style, preset, position, captionConfig }) => api.post(`/clips/${clipId}/caption-style`, { projectId, style, preset, position, captionConfig }),
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ["clips", projectId] }),
  });
}

export function useCredits() {
  return useQuery({ queryKey: ["credits"], queryFn: () => api.get("/credits/balance") });
}

export function useCreditTransactions({ limit = 50, offset = 0, type } = {}) {
  return useQuery({ 
    queryKey: ["credits", "transactions", limit, offset, type], 
    queryFn: () => api.get("/credits/transactions", { params: { limit, offset, type } }) 
  });
}

export function useClearTransactions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/credits/transactions"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credits", "transactions"] });
      qc.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}

export function usePricing() {
  return useQuery({ 
    queryKey: ["credits", "pricing"], 
    queryFn: () => api.get("/credits/pricing"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEstimateMonthlyCredits() {
  return useMutation({ 
    mutationFn: (usage) => api.post("/credits/estimate-monthly", { usage }) 
  });
}

export function useBilling() {
  return useQuery({ queryKey: ["billing"], queryFn: () => api.get("/billing/history") });
}

export function useGenerateClips() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, settings }) => api.post(`/projects/${projectId}/generate`, { settings }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useCreateCheckoutSession() {
  return useMutation({ mutationFn: (priceId) => api.post("/billing/checkout", { priceId }) });
}

export function useCreatePortalSession() {
  return useMutation({ mutationFn: () => api.post("/billing/portal") });
}

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: () => api.get("/settings") });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put("/settings", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => api.delete("/auth/profile") });
}

export function useUpdateEmail() {
  return useMutation({ mutationFn: (data) => api.put("/auth/email", data) });
}

export function useUpdatePassword() {
  return useMutation({ mutationFn: (data) => api.put("/auth/password", data) });
}

export function useClipEditState(projectId, clipId) {
  return useQuery({
    queryKey: ["clipEdits", projectId, clipId],
    queryFn: () => api.get(`/clip-edits/${projectId}/${clipId}`),
    enabled: !!projectId && !!clipId,
  });
}

export function useSaveClipEditState(projectId, clipId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (editState) => api.put(`/clip-edits/${projectId}/${clipId}`, editState),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clipEdits", projectId, clipId] }),
  });
}