import { and, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";
import { projects } from "@workboard/db";
import {
  AppError,
  ERROR_CODES,
  conflict,
  projectCreateSchema,
  projectPatchSchema,
} from "@workboard/shared";
import { loadProject, loadWorkspace, requirePermission } from "../access.ts";
import { recordActivity } from "../activity.ts";
import { parseJson, requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

export function mountProjects(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.get("/api/workspaces/:workspaceId/projects", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "project.read");
    const archived = c.req.query("archived") === "1";
    const items = archived
      ? await deps.db
          .select()
          .from(projects)
          .where(eq(projects.workspaceId, membership.workspaceId))
      : await deps.db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.workspaceId, membership.workspaceId),
              isNull(projects.archivedAt),
            ),
          );
    return c.json({ items });
  });

  app.post("/api/workspaces/:workspaceId/projects", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "project.create");
    const body = await parseJson(c, projectCreateSchema);
    try {
      const created = await deps.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(projects)
          .values({
            description: body.description ?? "",
            name: body.name,
            slug: body.slug,
            workspaceId: membership.workspaceId,
          })
          .returning();
        const project = inserted[0];
        if (project === undefined) {
          throw new AppError(
            500,
            ERROR_CODES.internal,
            "Failed to create project",
          );
        }
        await recordActivity(tx, {
          actorId: actor.id,
          entityId: project.id,
          entityType: "project",
          type: "project.created",
          workspaceId: membership.workspaceId,
        });
        return project;
      });
      return c.json({ project: created }, 201);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw conflict(ERROR_CODES.slugConflict, "Project slug already exists");
    }
  });

  app.get("/api/projects/:projectId", async (c) => {
    const actor = requireActor(c);
    const { project, membership } = await loadProject(
      deps.db,
      c.req.param("projectId"),
      actor.id,
    );
    requirePermission(membership.role, "project.read");
    return c.json({ project });
  });

  app.patch("/api/projects/:projectId", async (c) => {
    const actor = requireActor(c);
    const { project, membership } = await loadProject(
      deps.db,
      c.req.param("projectId"),
      actor.id,
    );
    requirePermission(membership.role, "project.update");
    const body = await parseJson(c, projectPatchSchema);
    try {
      const updated = await deps.db
        .update(projects)
        .set({
          description: body.description ?? project.description,
          name: body.name ?? project.name,
          slug: body.slug ?? project.slug,
          updatedAt: deps.now(),
        })
        .where(eq(projects.id, project.id))
        .returning();
      return c.json({ project: updated[0] });
    } catch {
      throw conflict(ERROR_CODES.slugConflict, "Project slug already exists");
    }
  });

  app.post("/api/projects/:projectId/archive", async (c) => {
    const actor = requireActor(c);
    const { project, membership } = await loadProject(
      deps.db,
      c.req.param("projectId"),
      actor.id,
    );
    requirePermission(membership.role, "project.archive");
    const archivedAt = deps.now();
    await deps.db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({ archivedAt, updatedAt: archivedAt })
        .where(eq(projects.id, project.id));
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: project.id,
        entityType: "project",
        type: "project.archived",
        workspaceId: membership.workspaceId,
      });
    });
    return c.json({ archivedAt: archivedAt.toISOString() });
  });
}
