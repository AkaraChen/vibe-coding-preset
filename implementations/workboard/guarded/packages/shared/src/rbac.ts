export const WORKSPACE_ROLES = ["viewer", "member", "admin", "owner"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type Permission =
  | "activity.read"
  | "attachment.create"
  | "attachment.delete"
  | "attachment.read"
  | "comment.create"
  | "comment.delete"
  | "comment.read"
  | "member.invite"
  | "member.read"
  | "member.remove"
  | "member.update"
  | "owner.transfer"
  | "project.archive"
  | "project.create"
  | "project.read"
  | "project.update"
  | "task.create"
  | "task.delete"
  | "task.read"
  | "task.update"
  | "workspace.delete"
  | "workspace.read"
  | "workspace.update";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

const PERMISSIONS: Record<Permission, WorkspaceRole> = {
  "activity.read": "viewer",
  "attachment.create": "member",
  "attachment.delete": "member",
  "attachment.read": "viewer",
  "comment.create": "member",
  "comment.delete": "member",
  "comment.read": "viewer",
  "member.invite": "admin",
  "member.read": "viewer",
  "member.remove": "admin",
  "member.update": "admin",
  "owner.transfer": "owner",
  "project.archive": "admin",
  "project.create": "admin",
  "project.read": "viewer",
  "project.update": "admin",
  "task.create": "member",
  "task.delete": "member",
  "task.read": "viewer",
  "task.update": "member",
  "workspace.delete": "owner",
  "workspace.read": "viewer",
  "workspace.update": "admin",
};

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}

export function authorize(
  role: WorkspaceRole,
  permission: Permission,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[permission]];
}

export function canDeleteComment(
  role: WorkspaceRole,
  isAuthor: boolean,
): boolean {
  if (role === "viewer") {
    return false;
  }
  if (isAuthor) {
    return authorize(role, "comment.create");
  }
  return role === "admin" || role === "owner";
}

export function canDeleteAttachment(
  role: WorkspaceRole,
  isUploader: boolean,
): boolean {
  if (role === "viewer") {
    return false;
  }
  if (isUploader) {
    return authorize(role, "attachment.create");
  }
  return role === "admin" || role === "owner";
}

export function canChangeMemberRole(
  actor: WorkspaceRole,
  target: WorkspaceRole,
  next: WorkspaceRole,
): boolean {
  if (target === "owner" || next === "owner") {
    return false;
  }
  if (actor === "owner") {
    return true;
  }
  if (actor !== "admin") {
    return false;
  }
  return target !== "admin" && next !== "admin";
}

export function canRemoveMember(
  actor: WorkspaceRole,
  target: WorkspaceRole,
): boolean {
  if (target === "owner") {
    return false;
  }
  if (actor === "owner") {
    return true;
  }
  if (actor === "admin") {
    return target === "member" || target === "viewer";
  }
  return false;
}

export function assertNotSoleOwner(
  role: WorkspaceRole,
  action: "leave" | "demote",
): void {
  if (role === "owner") {
    throw new Error(`Sole owner cannot ${action}`);
  }
}
