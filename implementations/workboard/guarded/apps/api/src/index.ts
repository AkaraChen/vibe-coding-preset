import { serve } from "@hono/node-server";
import { createDatabase, createSql } from "@workboard/db";
import { FsStorage } from "@workboard/storage";
import { createApp } from "./app.ts";
import { apiPort, cookieSecure, storageDir, webOrigin } from "./env.ts";
import { ActivityHub } from "./hub.ts";
import { logger } from "./logger.ts";
import { runOutboxLoop } from "./worker.ts";

const sql = createSql();
const db = createDatabase(sql);
const hub = new ActivityHub();
const app = createApp({
  cookieSecure: cookieSecure(),
  db,
  hub,
  now: () => new Date(),
  storage: new FsStorage(storageDir()),
  webOrigin: webOrigin(),
});

const port = apiPort();
serve({ fetch: app.fetch, port }, () => {
  logger.info("api.listen", { status: port });
});

await runOutboxLoop(db, hub);
