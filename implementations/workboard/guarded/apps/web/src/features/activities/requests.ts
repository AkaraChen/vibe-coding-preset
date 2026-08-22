import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Activity = {
  actorId: string;
  createdAt: string;
  entityId: string;
  entityType: string;
  id: string;
  type: string;
};

export const activityKeys = {
  list: (workspaceId: string) => ["activities", "list", workspaceId] as const,
};

export function activityListQueryOptions(workspaceId: string) {
  return queryOptions({
    queryFn: async () =>
      api<{ items: Activity[] }>(`/api/workspaces/${workspaceId}/activities`),
    queryKey: activityKeys.list(workspaceId),
  });
}
