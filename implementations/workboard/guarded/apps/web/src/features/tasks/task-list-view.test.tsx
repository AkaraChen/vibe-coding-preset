import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { TaskListView } from "./task-list-view";
import type { Task } from "./requests";

const sample: Task = {
  assigneeId: null,
  description: "",
  dueAt: null,
  id: "t1",
  priority: "none",
  projectId: "p1",
  status: "todo",
  title: "Sample",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: 1,
};

test("TaskList four states", () => {
  const { rerender } = render(
    <TaskListView
      error={false}
      forbidden={false}
      items={[]}
      loading
      workspaceSlug="alpha"
      projectSlug="roadmap"
    />,
  );
  expect(screen.getByTestId("loading-state")).toBeTruthy();
  rerender(
    <TaskListView
      error={false}
      forbidden={false}
      items={[]}
      loading={false}
      workspaceSlug="alpha"
      projectSlug="roadmap"
    />,
  );
  expect(screen.getByTestId("empty-state")).toBeTruthy();
  rerender(
    <TaskListView
      error
      forbidden={false}
      items={[]}
      loading={false}
      workspaceSlug="alpha"
      projectSlug="roadmap"
    />,
  );
  expect(screen.getByTestId("error-state")).toBeTruthy();
  rerender(
    <TaskListView
      error={false}
      forbidden
      items={[]}
      loading={false}
      workspaceSlug="alpha"
      projectSlug="roadmap"
    />,
  );
  expect(screen.getByTestId("forbidden-state")).toBeTruthy();
  rerender(
    <TaskListView
      error={false}
      forbidden={false}
      items={[sample]}
      loading={false}
      workspaceSlug="alpha"
      projectSlug="roadmap"
    />,
  );
  expect(screen.getByText("Sample")).toBeTruthy();
});
