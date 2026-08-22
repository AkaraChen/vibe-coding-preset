import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import {
  APP_NAME,
  AppError,
  ERROR_CODES,
  SESSION_COOKIE,
} from "@workboard/shared";
import { errorEnvelope } from "./http.ts";
import { logger } from "./logger.ts";
import { mountActivities } from "./routes/activities.ts";
import { mountAttachments } from "./routes/attachments.ts";
import { mountAuth } from "./routes/auth.ts";
import { mountComments } from "./routes/comments.ts";
import { mountProjects } from "./routes/projects.ts";
import { mountTasks } from "./routes/tasks.ts";
import { mountWorkspaces } from "./routes/workspaces.ts";
import { loadSession } from "./session.ts";
import type { AppDeps, AppVariables } from "./types.ts";

export function createApp(deps: AppDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use(async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    c.set("actor", undefined);
    c.set("sessionId", undefined);
    const started = Date.now();
    const token = getCookie(c, SESSION_COOKIE);
    if (token !== undefined && token.length > 0) {
      const loaded = await loadSession(deps.db, token, deps.now());
      if (loaded !== undefined) {
        c.set("actor", loaded.actor);
        c.set("sessionId", loaded.sessionId);
      }
    }
    await next();
    const actor = c.get("actor");
    logger.info("request", {
      actorId: actor === undefined ? undefined : actor.id,
      durationMs: Date.now() - started,
      method: c.req.method,
      path: c.req.path,
      requestId,
      status: c.res.status,
    });
  });

  app.onError((error, c) => {
    const requestId = c.get("requestId");
    if (error instanceof AppError) {
      return c.json(errorEnvelope(error, requestId), error.status as 400);
    }
    logger.error("unhandled", { requestId, status: 500 });
    return c.json(
      errorEnvelope(
        new AppError(500, ERROR_CODES.internal, "Internal server error"),
        requestId,
      ),
      500,
    );
  });

  app.get("/health", (c) => c.json({ name: APP_NAME, ok: true }));

  mountAuth(app, deps);
  mountWorkspaces(app, deps);
  mountProjects(app, deps);
  mountTasks(app, deps);
  mountComments(app, deps);
  mountAttachments(app, deps);
  mountActivities(app, deps);
  return app;
}
