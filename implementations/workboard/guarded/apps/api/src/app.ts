import { Hono } from "hono";
import { APP_NAME } from "@workboard/shared";
import { logger } from "./logger.ts";

export function createApp(): Hono {
  const app = new Hono();

  app.use(async (c, next) => {
    const started = Date.now();
    await next();
    logger.info("request", {
      durationMs: Date.now() - started,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
    });
  });

  app.get("/health", (c) => c.json({ ok: true, name: APP_NAME }));
  return app;
}
