import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Task = {
  assigneeId: string | null;
  description: string;
  dueAt: string | null;
  id: string;
  priority: string;
  projectId: string;
  status: string;
  title: string;
  updatedAt: string;
  version: number;
};

export type TaskFilters = {
  assignee: string | null;
  q: string | null;
  status: string | null;
};

export const taskKeys = {
  all: () => ["tasks"] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
  list: (projectId: string, filters: TaskFilters) =>
    ["tasks", "list", projectId, filters] as const,
};

export function taskListQueryOptions(projectId: string, filters: TaskFilters) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.assignee) {
    params.set("assignee", filters.assignee);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  const query = params.toString();
  return queryOptions({
    queryFn: async () =>
      api<{ items: Task[] }>(
        `/api/projects/${projectId}/tasks${query.length > 0 ? `?${query}` : ""}`,
      ),
    queryKey: taskKeys.list(projectId, filters),
  });
}

export function taskDetailQueryOptions(taskId: string) {
  return queryOptions({
    queryFn: async () => api<{ task: Task }>(`/api/tasks/${taskId}`),
    queryKey: taskKeys.detail(taskId),
  });
}

export async function createTask(
  projectId: string,
  input: { status?: string; title: string },
): Promise<{ task: Task }> {
  return api(`/api/projects/${projectId}/tasks`, {
    body: JSON.stringify(input),
    method: "POST",
  });
}

export async function patchTask(
  taskId: string,
  input: { status?: string; title?: string; version: number },
): Promise<{ task: Task }> {
  return api(`/api/tasks/${taskId}`, {
    body: JSON.stringify(input),
    method: "PATCH",
  });
}
