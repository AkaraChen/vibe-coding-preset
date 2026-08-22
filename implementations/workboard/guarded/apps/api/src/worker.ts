import { and, eq, lte } from "drizzle-orm";
import { activities, activityOutbox, type Database } from "@workboard/db";
import { logger } from "./logger.ts";
import type { ActivityEvent, ActivityHub } from "./hub.ts";

function asPayload(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function drainOutbox(
  db: Database,
  hub: ActivityHub,
  now = new Date(),
): Promise<void> {
  const pending = await db
    .select({ activity: activities, outbox: activityOutbox })
    .from(activityOutbox)
    .innerJoin(activities, eq(activityOutbox.activityId, activities.id))
    .where(
      and(
        eq(activityOutbox.status, "pending"),
        lte(activityOutbox.nextAttemptAt, now),
      ),
    )
    .limit(50);

  for (const row of pending) {
    const event: ActivityEvent = {
      actorId: row.activity.actorId,
      createdAt: row.activity.createdAt.toISOString(),
      entityId: row.activity.entityId,
      entityType: row.activity.entityType,
      id: row.activity.id,
      payload: asPayload(row.activity.payload),
      type: row.activity.type,
      workspaceId: row.activity.workspaceId,
    };
    try {
      hub.publish(row.activity.workspaceId, event);
      await db
        .update(activityOutbox)
        .set({ processedAt: now, status: "published" })
        .where(eq(activityOutbox.id, row.outbox.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "publish failed";
      logger.error("outbox.publish", { status: 0 });
      const attempts = row.outbox.attempts + 1;
      await db
        .update(activityOutbox)
        .set({
          attempts,
          lastError: message,
          nextAttemptAt: new Date(now.getTime() + 1000 * attempts),
          status: attempts >= 5 ? "failed" : "pending",
        })
        .where(eq(activityOutbox.id, row.outbox.id));
    }
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runOutboxLoop(
  db: Database,
  hub: ActivityHub,
): Promise<void> {
  await tick(db, hub);
}

async function tick(db: Database, hub: ActivityHub): Promise<void> {
  try {
    await drainOutbox(db, hub);
  } catch {
    logger.error("outbox.loop");
  }
  await sleep(500);
  await tick(db, hub);
}
