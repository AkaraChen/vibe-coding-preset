import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { logger } from "./logger.ts";

const port = Number.parseInt(process.env.API_PORT ?? "3001", 10);
const app = createApp();

serve({ fetch: app.fetch, port }, () => {
  logger.info("api.listen", { status: port });
});
