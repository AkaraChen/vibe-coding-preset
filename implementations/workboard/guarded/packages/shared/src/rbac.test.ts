import { expect, test } from "vitest";
import {
  authorize,
  canChangeMemberRole,
  canDeleteAttachment,
  canDeleteComment,
  canRemoveMember,
} from "./rbac.ts";

test("authorize(viewer, task.update) is deny", () => {
  expect(authorize("viewer", "task.update")).toBe(false);
});

test("authorize(member, project.create) is deny", () => {
  expect(authorize("member", "project.create")).toBe(false);
});

test("authorize(admin, workspace.delete) is deny", () => {
  expect(authorize("admin", "workspace.delete")).toBe(false);
});

test("authorize(member, task.update) is allow", () => {
  expect(authorize("member", "task.update")).toBe(true);
});

test("viewer cannot delete comments", () => {
  expect(canDeleteComment("viewer", true)).toBe(false);
  expect(canDeleteComment("viewer", false)).toBe(false);
});

test("author member can delete own comment; admin can delete others", () => {
  expect(canDeleteComment("member", true)).toBe(true);
  expect(canDeleteComment("member", false)).toBe(false);
  expect(canDeleteComment("admin", false)).toBe(true);
});

test("owner cannot be removed or demoted via member APIs", () => {
  expect(canRemoveMember("owner", "owner")).toBe(false);
  expect(canRemoveMember("admin", "owner")).toBe(false);
  expect(canChangeMemberRole("owner", "owner", "admin")).toBe(false);
  expect(canChangeMemberRole("admin", "member", "owner")).toBe(false);
});

test("uploader or admin can delete attachments", () => {
  expect(canDeleteAttachment("viewer", false)).toBe(false);
  expect(canDeleteAttachment("member", true)).toBe(true);
  expect(canDeleteAttachment("member", false)).toBe(false);
  expect(canDeleteAttachment("admin", false)).toBe(true);
});
