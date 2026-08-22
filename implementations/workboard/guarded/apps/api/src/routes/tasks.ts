import { and, desc, eq, ilike, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { tasks } from "@workboard/db";
import {
  AppError,
  BULK_STATUS_MAX,
  bulkStatusSchema,
  canTransition,
  ERROR_CODES,
  isTaskStatus,
  offsetForPage,
  parsePageQuery,
  taskCreateSchema,
  taskPatchSchema,
  unprocessable,
  type TaskStatus,
} from "@workboard/shared";
import {
  loadProject,
  loadTask,
  loadWorkspace,
  requirePermission,
} from "../access.ts";
import { recordActivity } from "../activity.ts";
import { parseJson, readVersion, requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

function asStatus(value: string): TaskStatus {
  if (!isTaskStatus(value)) {
    throw unprocessable(ERROR_CODES.invalidTransition, "Unknown status");
  }
  return value;
}

export function mountTasks(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.get("/api/projects/:projectId/tasks", async (c) => {
    const actor = requireActor(c);
    const { project, membership } = await loadProject(
      deps.db,
      c.req.param("projectId"),
      actor.id,
    );
    requirePermission(membership.role, "task.read");
    const { page, pageSize } = parsePageQuery(
      c.req.query("page"),
      c.req.query("pageSize"),
    );
    const status = c.req.query("status");
    const assignee = c.req.query("assignee");
    const q = c.req.query("q");
    const filters = [eq(tasks.projectId, project.id)];
    if (status !== undefined && status.length > 0) {
      filters.push(eq(tasks.status, status));
    }
    if (assignee !== undefined && assignee.length > 0) {
      filters.push(eq(tasks.assigneeId, assignee));
    }
    if (q !== undefined && q.length > 0) {
      filters.push(ilike(tasks.title, `%${q}%`));
    }
    const where = and(...filters);
    const [countRow] = await deps.db
      .select({ total: sql<number>`count(*)` })
      .from(tasks)
      .where(where);
    const items = await deps.db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.updatedAt), desc(tasks.id))
      .limit(pageSize)
      .offset(offsetForPage(page, pageSize));
    return c.json({
      items,
      page,
      pageSize,
      total: countRow === undefined ? 0 : countRow.total,
    });
  });

  app.post("/api/projects/:projectId/tasks", async (c) => {
    const actor = requireActor(c);
    const { project, membership } = await loadProject(
      deps.db,
      c.req.param("projectId"),
      actor.id,
    );
    requirePermission(membership.role, "task.create");
    const body = await parseJson(c, taskCreateSchema);
    const created = await deps.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(tasks)
        .values({
          assigneeId: body.assigneeId ?? null,
          createdBy: actor.id,
          description: body.description ?? "",
          dueAt: body.dueAt ? new Date(body.dueAt) : null,
          priority: body.priority ?? "none",
          projectId: project.id,
          status: body.status ?? "todo",
          title: body.title,
          version: 1,
        })
        .returning();
      const task = inserted[0];
      if (task === undefined) {
        throw new AppError(500, ERROR_CODES.internal, "Failed to create task");
      }
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: task.id,
        entityType: "task",
        type: "task.created",
        workspaceId: membership.workspaceId,
      });
      return task;
    });
    return c.json({ task: created, version: created.version }, 201);
  });

  app.get("/api/tasks/:taskId", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "task.read");
    return c.json({ task });
  });

  app.patch("/api/tasks/:taskId", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "task.update");
    const body = await parseJson(c, taskPatchSchema);
    const version = readVersion(c, body.version);
    if (version !== task.version) {
      throw new AppError(
        409,
        ERROR_CODES.versionConflict,
        "Stale task version",
        { task },
      );
    }
    if (body.status !== undefined && body.status !== task.status) {
      if (!canTransition(asStatus(task.status), body.status)) {
        throw unprocessable(
          ERROR_CODES.invalidTransition,
          "Illegal status transition",
        );
      }
    }
    const updated = await deps.db.transaction(async (tx) => {
      const rows = await tx
        .update(tasks)
        .set({
          assigneeId:
            body.assigneeId === undefined ? task.assigneeId : body.assigneeId,
          description: body.description ?? task.description,
          dueAt:
            body.dueAt === undefined
              ? task.dueAt
              : body.dueAt === null
                ? null
                : new Date(body.dueAt),
          priority: body.priority ?? task.priority,
          status: body.status ?? task.status,
          title: body.title ?? task.title,
          updatedAt: deps.now(),
          version: task.version + 1,
        })
        .where(eq(tasks.id, task.id))
        .returning();
      const next = rows[0];
      if (next === undefined) {
        throw new AppError(500, ERROR_CODES.internal, "Failed to update task");
      }
      const type =
        body.status !== undefined && body.status !== task.status
          ? "task.status_changed"
          : "task.updated";
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: task.id,
        entityType: "task",
        payload: { from: task.status, to: next.status },
        type,
        workspaceId: membership.workspaceId,
      });
      return next;
    });
    return c.json({ task: updated });
  });

  app.delete("/api/tasks/:taskId", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "task.delete");
    await deps.db.delete(tasks).where(eq(tasks.id, task.id));
    return c.body(null, 204);
  });

  app.post("/api/workspaces/:workspaceId/tasks/bulk", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "task.update");
    const body = await parseJson(c, bulkStatusSchema);
    if (body.ids.length > BULK_STATUS_MAX) {
      throw unprocessable(ERROR_CODES.validation, "Too many ids");
    }
    const results: Array<{ error?: string; id: string; ok: boolean }> = [];
    for (const id of body.ids) {
      results.push(
        await applyBulkStatus(
          deps,
          actor.id,
          membership.workspaceId,
          id,
          body.status,
        ),
      );
    }
    return c.json({ results });
  });
}

async function applyBulkStatus(
  deps: AppDeps,
  actorId: string,
  workspaceId: string,
  id: string,
  status: TaskStatus,
): Promise<{ error?: string; id: string; ok: boolean }> {
  try {
    const loaded = await loadTask(deps.db, id, actorId);
    if (loaded.membership.workspaceId !== workspaceId) {
      return { error: ERROR_CODES.notFound, id, ok: false };
    }
    if (!canTransition(asStatus(loaded.task.status), status)) {
      return { error: ERROR_CODES.invalidTransition, id, ok: false };
    }
    await deps.db.transaction(async (tx) => {
      await tx
        .update(tasks)
        .set({
          status,
          updatedAt: deps.now(),
          version: loaded.task.version + 1,
        })
        .where(eq(tasks.id, id));
      await recordActivity(tx, {
        actorId,
        entityId: id,
        entityType: "task",
        payload: { from: loaded.task.status, to: status },
        type: "task.status_changed",
        workspaceId: loaded.membership.workspaceId,
      });
    });
    return { id, ok: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.code, id, ok: false };
    }
    return { error: ERROR_CODES.internal, id, ok: false };
  }
}
