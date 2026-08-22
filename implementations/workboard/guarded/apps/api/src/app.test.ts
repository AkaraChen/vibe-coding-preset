import { expect, test } from "vitest";
import { createApp } from "./app.ts";

test("GET /health returns ok", async () => {
  const app = createApp();
  const response = await app.request("/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, name: "Workboard" });
});
