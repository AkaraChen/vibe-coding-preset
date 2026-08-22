import { and, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { activities, type Database } from "@workboard/db";
import {
  decodeCursor,
  encodeCursor,
  unprocessable,
  ERROR_CODES,
} from "@workboard/shared";
import { loadWorkspace, requirePermission } from "../access.ts";
import type { ActivityEvent } from "../hub.ts";
import { requireActor } from "../http.ts";
import type { AppDeps, AppVariables } from "../types.ts";

type ActivityRow = typeof activities.$inferSelect;

function asPayload(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toActivityEvent(row: ActivityRow): ActivityEvent {
  return {
    actorId: row.actorId,
    createdAt: row.createdAt.toISOString(),
    entityId: row.entityId,
    entityType: row.entityType,
    id: row.id,
    payload: asPayload(row.payload),
    type: row.type,
    workspaceId: row.workspaceId,
  };
}

async function ping(stream: SSEStreamingApi): Promise<void> {
  await stream.sleep(15000);
  await stream.writeSSE({ data: "{}", event: "ping" });
  await ping(stream);
}

async function loadMissedActivities(
  db: Database,
  workspaceId: string,
  lastEventId: string,
): Promise<ActivityRow[]> {
  const originRows = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.workspaceId, workspaceId),
        eq(activities.id, lastEventId),
      ),
    )
    .limit(1);
  const origin = originRows[0];
  if (origin === undefined) {
    return [];
  }
  const after = or(
    gt(activities.createdAt, origin.createdAt),
    and(
      eq(activities.createdAt, origin.createdAt),
      gt(activities.id, origin.id),
    ),
  );
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.workspaceId, workspaceId), after))
    .orderBy(activities.createdAt, activities.id);
}

async function writeMissed(
  stream: SSEStreamingApi,
  rows: ActivityRow[],
): Promise<void> {
  for (const row of rows) {
    const event = toActivityEvent(row);
    await stream.writeSSE({
      data: JSON.stringify(event),
      event: event.type,
      id: event.id,
    });
  }
}

export function mountActivities(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.get("/api/workspaces/:workspaceId/activities", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "activity.read");
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(c.req.query("limit") ?? "20", 10) || 20),
    );
    const cursorValue = c.req.query("cursor");
    const cursor =
      cursorValue === undefined ? undefined : decodeCursor(cursorValue);
    if (cursorValue !== undefined && cursor === undefined) {
      throw unprocessable(ERROR_CODES.validation, "Invalid cursor");
    }
    const filters = [eq(activities.workspaceId, membership.workspaceId)];
    if (cursor !== undefined) {
      const createdAt = new Date(cursor.createdAt);
      filters.push(
        or(
          lt(activities.createdAt, createdAt),
          and(
            eq(activities.createdAt, createdAt),
            lt(activities.id, cursor.id),
          ),
        ) ?? sql`true`,
      );
    }
    const items = await deps.db
      .select()
      .from(activities)
      .where(and(...filters))
      .orderBy(desc(activities.createdAt), desc(activities.id))
      .limit(limit + 1);
    const page = items.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      items.length > limit && last !== undefined
        ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;
    return c.json({ items: page, nextCursor });
  });

  app.get("/api/workspaces/:workspaceId/activities/stream", async (c) => {
    const actor = requireActor(c);
    const { membership } = await loadWorkspace(
      deps.db,
      c.req.param("workspaceId"),
      actor.id,
    );
    requirePermission(membership.role, "activity.read");
    const lastEventId = c.req.header("Last-Event-ID");
    const missed =
      lastEventId !== undefined && lastEventId.length > 0
        ? await loadMissedActivities(
            deps.db,
            membership.workspaceId,
            lastEventId,
          )
        : [];
    c.header("X-Resume-Count", String(missed.length));
    return streamSSE(c, async (stream) => {
      await writeMissed(stream, missed);
      const unsubscribe = deps.hub.subscribe(
        membership.workspaceId,
        (event) => {
          const write = stream.writeSSE({
            data: JSON.stringify(event),
            event: event.type,
            id: event.id,
          });
          write.then(
            () => undefined,
            () => undefined,
          );
        },
      );
      stream.onAbort(() => {
        unsubscribe();
      });
      await ping(stream);
    });
  });
}
