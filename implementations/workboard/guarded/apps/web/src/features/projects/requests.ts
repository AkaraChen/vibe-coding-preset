import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Project = {
  archivedAt: string | null;
  description: string;
  id: string;
  name: string;
  slug: string;
  workspaceId: string;
};

export const projectKeys = {
  all: () => ["projects"] as const,
  list: (workspaceId: string) => ["projects", "list", workspaceId] as const,
};

export function projectListQueryOptions(workspaceId: string) {
  return queryOptions({
    queryFn: async () =>
      api<{ items: Project[] }>(`/api/workspaces/${workspaceId}/projects`),
    queryKey: projectKeys.list(workspaceId),
  });
}

export async function createProject(
  workspaceId: string,
  input: { description?: string; name: string; slug: string },
): Promise<{ project: Project }> {
  return api(`/api/workspaces/${workspaceId}/projects`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}
