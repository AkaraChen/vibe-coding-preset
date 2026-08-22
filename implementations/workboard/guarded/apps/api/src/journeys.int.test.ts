import { expect, test } from "vitest";
import { createDatabase, createSql, migrate, seed } from "@workboard/db";
import { FsStorage } from "@workboard/storage";
import {
  SEED_PASSWORD,
  SEED_WORKSPACE_IDS,
  seedTaskId,
} from "@workboard/shared";
import { createApp } from "./app.ts";
import { ActivityHub } from "./hub.ts";

const sql = createSql();
const db = createDatabase(sql);

function testApp(hub = new ActivityHub()) {
  return createApp({
    cookieSecure: false,
    db,
    hub,
    now: () => new Date(),
    storage: new FsStorage("/tmp/workboard-test-storage"),
    webOrigin: "http://127.0.0.1:3000",
  });
}

async function login(email: string): Promise<string> {
  const app = testApp();
  const response = await app.request("/api/auth/login", {
    body: JSON.stringify({ email, password: SEED_PASSWORD }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

async function json(path: string, cookie: string, init: RequestInit = {}) {
  const app = testApp();
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await app.request(path, { ...init, headers });
  const body: unknown = response.status === 204 ? null : await response.json();
  return { body, status: response.status };
}

test("viewer write is 403 and non-member is 404 using seed beta", async () => {
  await migrate();
  await seed();
  const cara = await login("cara@seed.test");
  const ben = await login("ben@seed.test");
  const betaTask = seedTaskId("beta", 1);
  const viewerWrite = await json(`/api/tasks/${betaTask}`, cara, {
    body: JSON.stringify({ title: "nope", version: 1 }),
    method: "PATCH",
  });
  expect(viewerWrite.status).toBe(404);
  const viewerAlpha = await json(
    `/api/workspaces/${SEED_WORKSPACE_IDS.alpha}`,
    cara,
  );
  expect(viewerAlpha.status).toBe(200);
  const alphaProjects = (
    await json(`/api/workspaces/${SEED_WORKSPACE_IDS.alpha}/projects`, cara)
  ).body as {
    items: Array<{ id: string }>;
  };
  const projectId = alphaProjects.items[0]?.id ?? "";
  const forbiddenWrite = await json(`/api/projects/${projectId}/tasks`, cara, {
    body: JSON.stringify({ title: "viewer cannot" }),
    method: "POST",
  });
  expect(forbiddenWrite.status).toBe(403);
  const benBeta = await json(`/api/workspaces/${SEED_WORKSPACE_IDS.beta}`, ben);
  expect(benBeta.status).toBe(404);
  const benBetaTask = await json(`/api/tasks/${betaTask}`, ben);
  expect(benBetaTask.status).toBe(404);
});

test("illegal transition is 422 and stale version is 409", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const taskId = seedTaskId("alpha", 1);
  const current = (await json(`/api/tasks/${taskId}`, ada)).body as {
    task: { status: string; version: number };
  };
  const illegal = await json(`/api/tasks/${taskId}`, ada, {
    body: JSON.stringify({
      status: current.task.status === "todo" ? "done" : "todo",
      version: current.task.version,
    }),
    method: "PATCH",
  });
  if (current.task.status === "todo") {
    expect(illegal.status).toBe(422);
  }
  const stale = await json(`/api/tasks/${taskId}`, ada, {
    body: JSON.stringify({
      title: "stale",
      version: current.task.version + 99,
    }),
    method: "PATCH",
  });
  expect(stale.status).toBe(409);
});
