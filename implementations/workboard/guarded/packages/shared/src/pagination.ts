import { TASK_PAGE_SIZE_DEFAULT, TASK_PAGE_SIZE_MAX } from "./constants.ts";

export type PageQuery = {
  page: number;
  pageSize: number;
};

export function parsePageQuery(
  pageRaw: string | undefined,
  pageSizeRaw: string | undefined,
): PageQuery {
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
  const requested =
    Number.parseInt(pageSizeRaw ?? String(TASK_PAGE_SIZE_DEFAULT), 10) ||
    TASK_PAGE_SIZE_DEFAULT;
  const pageSize = Math.min(TASK_PAGE_SIZE_MAX, Math.max(1, requested));
  return { page, pageSize };
}

export function offsetForPage(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
