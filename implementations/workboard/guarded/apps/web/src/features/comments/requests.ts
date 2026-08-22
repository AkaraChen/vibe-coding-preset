import { queryOptions } from "@tanstack/react-query";
import { api } from "../../shared/api/client";

export type Comment = {
  authorId: string;
  body: string;
  createdAt: string;
  id: string;
};

export const commentKeys = {
  list: (taskId: string) => ["comments", "list", taskId] as const,
};

export function commentListQueryOptions(taskId: string) {
  return queryOptions({
    queryFn: async () =>
      api<{ items: Comment[] }>(`/api/tasks/${taskId}/comments`),
    queryKey: commentKeys.list(taskId),
  });
}

export async function createComment(
  taskId: string,
  body: string,
): Promise<{ comment: Comment }> {
  return api(`/api/tasks/${taskId}/comments`, {
    body: JSON.stringify({ body }),
    method: "POST",
  });
}
