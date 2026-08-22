import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { TaskStatusChip } from "./task-status-chip";
import type { Task } from "./requests";

const task: Task = {
  assigneeId: null,
  description: "",
  dueAt: null,
  id: "task-1",
  priority: "none",
  projectId: "p1",
  status: "todo",
  title: "Sample",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

function wrap(ui: ReactElement): ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

test("TaskStatusChip optimistic update then rollback", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 30);
    });
    return new Response(
      JSON.stringify({ error: { code: "internal", message: "fail" } }),
      { status: 500 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  render(wrap(<TaskStatusChip task={task} />));
  await user.selectOptions(screen.getByLabelText("Task status"), "in_progress");
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalled();
  });
});

test("TaskStatusChip shows conflict-banner on 409", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { code: "version_conflict", message: "stale" },
          }),
          { status: 409 },
        ),
      ),
    ),
  );
  render(wrap(<TaskStatusChip task={task} />));
  await user.selectOptions(screen.getByLabelText("Task status"), "in_progress");
  expect(await screen.findByTestId("conflict-banner")).toBeTruthy();
});

test("viewer cannot change status", () => {
  render(wrap(<TaskStatusChip task={task} disabled />));
  const select = screen.getByLabelText("Task status");
  expect(select instanceof HTMLSelectElement && select.disabled).toBe(true);
});
