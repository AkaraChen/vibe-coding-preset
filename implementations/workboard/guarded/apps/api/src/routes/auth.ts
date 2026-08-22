import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Hono } from "hono";
import { users } from "@workboard/db";
import {
  AppError,
  ERROR_CODES,
  conflict,
  loginSchema,
  registerSchema,
  SESSION_COOKIE,
  unauthenticated,
} from "@workboard/shared";
import { parseJson, requireActor } from "../http.ts";
import { createSession, deleteSession } from "../session.ts";
import type { AppDeps, AppVariables } from "../types.ts";

const ARGON2 = {
  memoryCost: 4096,
  parallelism: 1,
  timeCost: 1,
  type: argon2.argon2id,
} as const;

function cookieOpts(deps: AppDeps) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "Lax" as const,
    secure: deps.cookieSecure,
  };
}

export function mountAuth(
  app: Hono<{ Variables: AppVariables }>,
  deps: AppDeps,
): void {
  app.post("/api/auth/register", async (c) => {
    const body = await parseJson(c, registerSchema);
    const existing = await deps.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    if (existing[0] !== undefined) {
      throw conflict(ERROR_CODES.slugConflict, "Email already registered");
    }
    const passwordHash = await argon2.hash(body.password, ARGON2);
    const inserted = await deps.db
      .insert(users)
      .values({ email: body.email, name: body.name, passwordHash })
      .returning();
    const user = inserted[0];
    if (user === undefined) {
      throw new AppError(500, ERROR_CODES.internal, "Failed to create user");
    }
    const token = await createSession(deps.db, user.id, deps.now());
    setCookie(c, SESSION_COOKIE, token, cookieOpts(deps));
    return c.json(
      { user: { email: user.email, id: user.id, name: user.name } },
      201,
    );
  });

  app.post("/api/auth/login", async (c) => {
    const body = await parseJson(c, loginSchema);
    const rows = await deps.db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);
    const user = rows[0];
    const valid =
      user !== undefined &&
      (await argon2.verify(user.passwordHash, body.password));
    if (user === undefined || !valid) {
      throw unauthenticated();
    }
    const token = await createSession(deps.db, user.id, deps.now());
    setCookie(c, SESSION_COOKIE, token, cookieOpts(deps));
    return c.json({
      user: { email: user.email, id: user.id, name: user.name },
    });
  });

  app.post("/api/auth/logout", async (c) => {
    requireActor(c);
    const sessionId = c.get("sessionId");
    if (sessionId !== undefined) {
      await deleteSession(deps.db, sessionId);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.get("/api/auth/me", (c) => {
    const actor = requireActor(c);
    return c.json({ user: actor });
  });
}
