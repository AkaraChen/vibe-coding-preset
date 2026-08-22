import { expect, test } from "vitest";
import { canTransition, TASK_STATUSES, type TaskStatus } from "./status.ts";

const ALLOWED: Array<[TaskStatus, TaskStatus]> = [
  ["todo", "in_progress"],
  ["todo", "cancelled"],
  ["in_progress", "blocked"],
  ["in_progress", "done"],
  ["in_progress", "cancelled"],
  ["blocked", "in_progress"],
  ["blocked", "cancelled"],
];

test("canTransition allows the spec edges only", () => {
  for (const from of TASK_STATUSES) {
    for (const to of TASK_STATUSES) {
      const allowed = ALLOWED.some(([a, b]) => a === from && b === to);
      expect(canTransition(from, to)).toBe(allowed);
    }
  }
});

test("canTransition rejects done to in_progress", () => {
  expect(canTransition("done", "in_progress")).toBe(false);
});
