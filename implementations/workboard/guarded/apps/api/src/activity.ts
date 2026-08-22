import { randomUUID } from "node:crypto";
import type { Database } from "@workboard/db";
import { activities, activityOutbox } from "@workboard/db";
import type { ActivityType } from "@workboard/shared";

type Tx = Pick<Database, "insert">;

export async function recordActivity(
  tx: Tx,
  input: {
    actorId: string;
    entityId: string;
    entityType: string;
    payload?: Record<string, unknown>;
    type: ActivityType;
    workspaceId: string;
  },
): Promise<{ id: string }> {
  const id = randomUUID();
  await tx.insert(activities).values({
    id,
    actorId: input.actorId,
    entityId: input.entityId,
    entityType: input.entityType,
    payload: input.payload ?? {},
    type: input.type,
    workspaceId: input.workspaceId,
  });
  await tx.insert(activityOutbox).values({
    activityId: id,
    status: "pending",
  });
  return { id };
}
