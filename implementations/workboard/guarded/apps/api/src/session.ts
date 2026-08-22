import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { sessions, users, type Database } from "@workboard/db";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "@workboard/shared";
import type { Actor } from "./types.ts";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function expiryTimes(
  now: Date,
  createdAt: Date,
): { expiresAt: Date; lastSeenAt: Date } {
  const absolute = new Date(createdAt.getTime() + SESSION_ABSOLUTE_MS);
  const idle = new Date(now.getTime() + SESSION_IDLE_MS);
  const expiresAt = idle.getTime() < absolute.getTime() ? idle : absolute;
  return { expiresAt, lastSeenAt: now };
}

export async function createSession(
  db: Database,
  userId: string,
  now: Date,
): Promise<string> {
  const token = newToken();
  const times = expiryTimes(now, now);
  await db.insert(sessions).values({
    createdAt: now,
    expiresAt: times.expiresAt,
    lastSeenAt: times.lastSeenAt,
    tokenHash: hashToken(token),
    userId,
  });
  return token;
}

export async function loadSession(
  db: Database,
  token: string,
  now: Date,
): Promise<{ actor: Actor; sessionId: string } | undefined> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }
  const absolute = new Date(
    row.session.createdAt.getTime() + SESSION_ABSOLUTE_MS,
  );
  if (now.getTime() >= absolute.getTime()) {
    return undefined;
  }
  const times = expiryTimes(now, row.session.createdAt);
  await db
    .update(sessions)
    .set({ expiresAt: times.expiresAt, lastSeenAt: times.lastSeenAt })
    .where(eq(sessions.id, row.session.id));
  return {
    actor: { email: row.user.email, id: row.user.id, name: row.user.name },
    sessionId: row.session.id,
  };
}

export async function deleteSession(
  db: Database,
  sessionId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
