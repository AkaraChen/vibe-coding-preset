import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import {
  activities,
  activityOutbox,
  createDatabase,
  createSql,
  migrate,
  seed,
} from "@workboard/db";
import { FsStorage } from "@workboard/storage";
import {
  SEED_PASSWORD,
  SEED_PROJECT_IDS,
  SEED_WORKSPACE_IDS,
  seedTaskId,
} from "@workboard/shared";
import { createApp } from "./app.ts";
import { ActivityHub } from "./hub.ts";
import { drainOutbox } from "./worker.ts";

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

test("duplicate project slug is 409", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const response = await json(
    `/api/workspaces/${SEED_WORKSPACE_IDS.alpha}/projects`,
    ada,
    {
      body: JSON.stringify({ name: "Roadmap 2", slug: "roadmap" }),
      method: "POST",
    },
  );
  expect(response.status).toBe(409);
});

test("bulk status returns partial success without rollback", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const todoId = seedTaskId("alpha", 1);
  const doneId = seedTaskId("alpha", 4);
  const response = await json(
    `/api/workspaces/${SEED_WORKSPACE_IDS.alpha}/tasks/bulk`,
    ada,
    {
      body: JSON.stringify({
        ids: [todoId, doneId],
        status: "in_progress",
      }),
      method: "POST",
    },
  );
  expect(response.status).toBe(200);
  const body = response.body as {
    results: Array<{ error?: string; id: string; ok: boolean }>;
  };
  const byId = new Map(body.results.map((row) => [row.id, row]));
  expect(byId.get(todoId)?.ok).toBe(true);
  expect(byId.get(doneId)?.ok).toBe(false);
  const stillDone = (await json(`/api/tasks/${doneId}`, ada)).body as {
    task: { status: string };
  };
  expect(stillDone.task.status).toBe("done");
});

test("attachments reject html and oversized files", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const app = testApp();
  const taskId = seedTaskId("alpha", 1);
  const html = new FormData();
  html.append("file", new File(["<p>no</p>"], "x.html", { type: "text/html" }));
  const htmlResponse = await app.request(`/api/tasks/${taskId}/attachments`, {
    body: html,
    headers: { cookie: ada },
    method: "POST",
  });
  expect(htmlResponse.status).toBe(415);
  const huge = new FormData();
  huge.append(
    "file",
    new File([new Uint8Array(11 * 1024 * 1024)], "big.png", {
      type: "image/png",
    }),
  );
  const hugeResponse = await app.request(`/api/tasks/${taskId}/attachments`, {
    body: huge,
    headers: { cookie: ada },
    method: "POST",
  });
  expect(hugeResponse.status).toBe(413);
});

test("write inserts activity and pending outbox together", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const created = await json(
    `/api/projects/${SEED_PROJECT_IDS.alphaRoadmap}/tasks`,
    ada,
    {
      body: JSON.stringify({ title: "Outbox task" }),
      method: "POST",
    },
  );
  expect(created.status).toBe(201);
  const task = (created.body as { task: { id: string } }).task;
  const activityRows = await db
    .select()
    .from(activities)
    .where(eq(activities.entityId, task.id));
  const activity = activityRows[0];
  expect(activity).toBeDefined();
  if (activity === undefined) {
    return;
  }
  const outboxRows = await db
    .select()
    .from(activityOutbox)
    .where(eq(activityOutbox.activityId, activity.id));
  expect(outboxRows[0]?.status).toBe("pending");
});

test("SSE Last-Event-ID replays missed events into the stream", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  await json(`/api/projects/${SEED_PROJECT_IDS.alphaRoadmap}/tasks`, ada, {
    body: JSON.stringify({ title: "Before resume" }),
    method: "POST",
  });
  const listed = (
    await json(`/api/workspaces/${SEED_WORKSPACE_IDS.alpha}/activities`, ada)
  ).body as { items: Array<{ id: string }> };
  const lastId = listed.items[0]?.id;
  expect(lastId).toBeDefined();
  if (lastId === undefined) {
    return;
  }
  await json(`/api/projects/${SEED_PROJECT_IDS.alphaRoadmap}/tasks`, ada, {
    body: JSON.stringify({ title: "After resume" }),
    method: "POST",
  });
  const app = testApp();
  const stream = await app.request(
    `/api/workspaces/${SEED_WORKSPACE_IDS.alpha}/activities/stream`,
    {
      headers: { cookie: ada, "Last-Event-ID": lastId },
    },
  );
  expect(stream.status).toBe(200);
  expect(stream.headers.get("x-resume-count")).not.toBe("0");
  const reader = stream.body?.getReader();
  expect(reader).toBeDefined();
  if (reader === undefined) {
    return;
  }
  const first = await reader.read();
  await reader.cancel();
  const bytes: unknown = first.value;
  expect(bytes instanceof Uint8Array).toBe(true);
  if (!(bytes instanceof Uint8Array)) {
    return;
  }
  const chunk = new TextDecoder().decode(bytes);
  expect(chunk).toContain("event: task.created");
  expect(chunk).toContain('"type":"task.created"');
});

test("outbox stays pending when the hub throws", async () => {
  await migrate();
  await seed();
  const ada = await login("ada@seed.test");
  const created = await json(
    `/api/projects/${SEED_PROJECT_IDS.alphaRoadmap}/tasks`,
    ada,
    {
      body: JSON.stringify({ title: "Hub throw" }),
      method: "POST",
    },
  );
  const task = (created.body as { task: { id: string } }).task;
  const activityRows = await db
    .select()
    .from(activities)
    .where(eq(activities.entityId, task.id));
  const activity = activityRows[0];
  expect(activity).toBeDefined();
  if (activity === undefined) {
    return;
  }
  const throwingHub = new ActivityHub();
  throwingHub.publish = (): void => {
    throw new Error("hub down");
  };
  await drainOutbox(db, throwingHub);
  const outboxRows = await db
    .select()
    .from(activityOutbox)
    .where(eq(activityOutbox.activityId, activity.id));
  expect(outboxRows[0]?.status).toBe("pending");
});
