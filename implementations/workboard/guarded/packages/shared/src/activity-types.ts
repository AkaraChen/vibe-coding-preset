export const ACTIVITY_TYPES = [
  "workspace.created",
  "member.added",
  "member.role_changed",
  "member.removed",
  "project.created",
  "project.updated",
  "project.archived",
  "task.created",
  "task.updated",
  "task.status_changed",
  "comment.created",
  "comment.deleted",
  "attachment.created",
  "attachment.deleted",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(value: string): value is ActivityType {
  return (ACTIVITY_TYPES as readonly string[]).includes(value);
}
