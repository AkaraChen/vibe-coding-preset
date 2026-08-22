import { and, desc, eq, isNull } from "drizzle-orm";
import type { Hono } from "hono";
import { comments } from "@workboard/db";
import {
  AppError,
  ERROR_CODES,
  canDeleteComment,
  commentCreateSchema,
  forbidden,
  notFound,
} from "@workboard/shared";
import { loadTask, requirePermission } from "../access.ts";
import { recordActivity } from "../activity.ts";
import { parseJson, requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

export function mountComments(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.get("/api/tasks/:taskId/comments", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "comment.read");
    const items = await deps.db
      .select()
      .from(comments)
      .where(and(eq(comments.taskId, task.id), isNull(comments.deletedAt)))
      .orderBy(desc(comments.createdAt), desc(comments.id));
    return c.json({ items });
  });

  app.post("/api/tasks/:taskId/comments", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "comment.create");
    const body = await parseJson(c, commentCreateSchema);
    const created = await deps.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(comments)
        .values({ authorId: actor.id, body: body.body, taskId: task.id })
        .returning();
      const comment = inserted[0];
      if (comment === undefined) {
        throw new AppError(
          500,
          ERROR_CODES.internal,
          "Failed to create comment",
        );
      }
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: comment.id,
        entityType: "comment",
        payload: { excerpt: body.body.slice(0, 120), taskId: task.id },
        type: "comment.created",
        workspaceId: membership.workspaceId,
      });
      return comment;
    });
    return c.json({ comment: created }, 201);
  });

  app.delete("/api/comments/:commentId", async (c) => {
    const actor = requireActor(c);
    const rows = await deps.db
      .select()
      .from(comments)
      .where(eq(comments.id, c.req.param("commentId")))
      .limit(1);
    const comment = rows[0];
    if (comment === undefined || comment.deletedAt !== null) {
      throw notFound();
    }
    const { membership } = await loadTask(deps.db, comment.taskId, actor.id);
    if (!canDeleteComment(membership.role, comment.authorId === actor.id)) {
      throw forbidden();
    }
    const deletedAt = deps.now();
    await deps.db.transaction(async (tx) => {
      await tx
        .update(comments)
        .set({ deletedAt, updatedAt: deletedAt })
        .where(eq(comments.id, comment.id));
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: comment.id,
        entityType: "comment",
        type: "comment.deleted",
        workspaceId: membership.workspaceId,
      });
    });
    return c.body(null, 204);
  });
}
