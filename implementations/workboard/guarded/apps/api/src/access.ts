import { and, eq } from "drizzle-orm";
import {
  projects,
  tasks,
  workspaceMembers,
  workspaces,
  type Database,
} from "@workboard/db";
import {
  authorize,
  forbidden,
  notFound,
  type Permission,
  type WorkspaceRole,
} from "@workboard/shared";

export type Membership = {
  role: WorkspaceRole;
  workspaceId: string;
};

export async function loadMembership(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<Membership> {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw notFound();
  }
  return { role: row.role as WorkspaceRole, workspaceId };
}

export function requirePermission(
  role: WorkspaceRole,
  permission: Permission,
): void {
  if (!authorize(role, permission)) {
    throw forbidden();
  }
}

export async function loadWorkspace(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<{
  membership: Membership;
  workspace: typeof workspaces.$inferSelect;
}> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const workspace = rows[0];
  if (workspace === undefined) {
    throw notFound();
  }
  const membership = await loadMembership(db, workspaceId, userId);
  return { membership, workspace };
}

export async function loadProject(
  db: Database,
  projectId: string,
  userId: string,
): Promise<{
  membership: Membership;
  project: typeof projects.$inferSelect;
}> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const project = rows[0];
  if (project === undefined) {
    throw notFound();
  }
  const membership = await loadMembership(db, project.workspaceId, userId);
  return { membership, project };
}

export async function loadTask(
  db: Database,
  taskId: string,
  userId: string,
): Promise<{
  membership: Membership;
  project: typeof projects.$inferSelect;
  task: typeof tasks.$inferSelect;
}> {
  const rows = await db
    .select({ project: projects, task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw notFound();
  }
  const membership = await loadMembership(db, row.project.workspaceId, userId);
  return { membership, project: row.project, task: row.task };
}
