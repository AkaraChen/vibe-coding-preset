import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
};

export const workspaceKeys = {
  all: () => ["workspaces"] as const,
  list: () => ["workspaces", "list"] as const,
  detail: (id: string) => ["workspaces", "detail", id] as const,
  members: (id: string) => ["workspaces", "members", id] as const,
};

export function workspaceListQueryOptions() {
  return queryOptions({
    queryFn: async () =>
      api<{ items: Array<{ role: string; workspace: Workspace }> }>(
        "/api/workspaces",
      ),
    queryKey: workspaceKeys.list(),
    staleTime: 15_000,
  });
}

export function workspaceDetailQueryOptions(id: string) {
  return queryOptions({
    queryFn: async () =>
      api<{ role: string; workspace: Workspace }>(`/api/workspaces/${id}`),
    queryKey: workspaceKeys.detail(id),
    staleTime: 15_000,
  });
}

export function membersQueryOptions(id: string) {
  return queryOptions({
    queryFn: async () =>
      api<{
        items: Array<{
          email: string;
          name: string;
          role: string;
          userId: string;
        }>;
      }>(`/api/workspaces/${id}/members`),
    queryKey: workspaceKeys.members(id),
  });
}

export async function createWorkspace(input: {
  name: string;
  slug: string;
}): Promise<{ workspace: Workspace }> {
  return api("/api/workspaces", {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function inviteMember(
  workspaceId: string,
  input: { email: string; role: "viewer" | "member" | "admin" },
) {
  return api(`/api/workspaces/${workspaceId}/members`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}
