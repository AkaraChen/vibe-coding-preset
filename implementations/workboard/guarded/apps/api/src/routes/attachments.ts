import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { attachments } from "@workboard/db";
import {
  AppError,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_ALLOWLIST,
  ERROR_CODES,
  canDeleteAttachment,
  forbidden,
  notFound,
} from "@workboard/shared";
import { loadTask, requirePermission } from "../access.ts";
import { recordActivity } from "../activity.ts";
import { requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

const MIME = new Set<string>(ATTACHMENT_MIME_ALLOWLIST);

export function mountAttachments(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.post("/api/tasks/:taskId/attachments", async (c) => {
    const actor = requireActor(c);
    const { task, membership } = await loadTask(
      deps.db,
      c.req.param("taskId"),
      actor.id,
    );
    requirePermission(membership.role, "attachment.create");
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError(422, ERROR_CODES.validation, "file is required");
    }
    if (!MIME.has(file.type)) {
      throw new AppError(
        415,
        ERROR_CODES.unsupportedMediaType,
        "MIME type not allowed",
      );
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      throw new AppError(413, ERROR_CODES.payloadTooLarge, "File too large");
    }
    const id = randomUUID();
    const storageKey = randomUUID();
    const body = new Uint8Array(await file.arrayBuffer());
    await deps.storage.put(storageKey, body, file.type);
    const created = await deps.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(attachments)
        .values({
          filename: file.name,
          id,
          mimeType: file.type,
          sizeBytes: file.size,
          storageKey,
          taskId: task.id,
          uploaderId: actor.id,
        })
        .returning();
      const row = inserted[0];
      if (row === undefined) {
        throw new AppError(
          500,
          ERROR_CODES.internal,
          "Failed to store attachment",
        );
      }
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: row.id,
        entityType: "attachment",
        payload: { filename: row.filename, taskId: task.id },
        type: "attachment.created",
        workspaceId: membership.workspaceId,
      });
      return row;
    });
    return c.json(
      {
        id: created.id,
        filename: created.filename,
        mime: created.mimeType,
        size: created.sizeBytes,
      },
      201,
    );
  });

  app.get("/api/attachments/:attachmentId", async (c) => {
    const actor = requireActor(c);
    const row = await loadAttachment(
      deps,
      c.req.param("attachmentId"),
      actor.id,
    );
    requirePermission(row.membership.role, "attachment.read");
    const object = await deps.storage.get(row.attachment.storageKey);
    if (object === undefined) {
      throw notFound();
    }
    return new Response(Uint8Array.from(object.body), {
      headers: {
        "Content-Disposition": `attachment; filename="${row.attachment.filename}"`,
        "Content-Type": row.attachment.mimeType,
      },
    });
  });

  app.get("/api/attachments/:attachmentId/meta", async (c) => {
    const actor = requireActor(c);
    const row = await loadAttachment(
      deps,
      c.req.param("attachmentId"),
      actor.id,
    );
    requirePermission(row.membership.role, "attachment.read");
    return c.json({
      filename: row.attachment.filename,
      id: row.attachment.id,
      mime: row.attachment.mimeType,
      size: row.attachment.sizeBytes,
    });
  });

  app.delete("/api/attachments/:attachmentId", async (c) => {
    const actor = requireActor(c);
    const row = await loadAttachment(
      deps,
      c.req.param("attachmentId"),
      actor.id,
    );
    if (
      !canDeleteAttachment(
        row.membership.role,
        row.attachment.uploaderId === actor.id,
      )
    ) {
      throw forbidden();
    }
    await deps.db.transaction(async (tx) => {
      await tx.delete(attachments).where(eq(attachments.id, row.attachment.id));
      await recordActivity(tx, {
        actorId: actor.id,
        entityId: row.attachment.id,
        entityType: "attachment",
        type: "attachment.deleted",
        workspaceId: row.membership.workspaceId,
      });
    });
    await deps.storage.delete(row.attachment.storageKey);
    return c.body(null, 204);
  });
}

async function loadAttachment(
  deps: AppDeps,
  attachmentId: string,
  userId: string,
) {
  const rows = await deps.db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  const attachment = rows[0];
  if (attachment === undefined) {
    throw notFound();
  }
  const loaded = await loadTask(deps.db, attachment.taskId, userId);
  return { attachment, membership: loaded.membership };
}
