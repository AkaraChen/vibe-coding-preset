import { expect, test } from "vitest";
import { createDatabase, createSql, migrate, seed } from "@workboard/db";
import { FsStorage } from "@workboard/storage";
import { SEED_PASSWORD } from "@workboard/shared";
import { createApp } from "./app.ts";
import { ActivityHub } from "./hub.ts";

const sql = createSql();
const db = createDatabase(sql);

function testApp() {
  return createApp({
    cookieSecure: false,
    db,
    hub: new ActivityHub(),
    now: () => new Date(),
    storage: new FsStorage("/tmp/workboard-test-storage"),
    webOrigin: "http://127.0.0.1:3000",
  });
}

test("GET /health returns ok", async () => {
  const response = await testApp().request("/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, name: "Workboard" });
});

test("login sets HttpOnly cookie and me/logout work", async () => {
  await migrate();
  await seed();
  const app = testApp();
  const login = await app.request("/api/auth/login", {
    body: JSON.stringify({ email: "ada@seed.test", password: SEED_PASSWORD }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(login.status).toBe(200);
  const setCookie = login.headers.get("set-cookie") ?? "";
  expect(setCookie.toLowerCase()).toContain("httponly");
  expect(setCookie.toLowerCase()).toContain("samesite=lax");
  const cookie = setCookie.split(";")[0] ?? "";
  const me = await app.request("/api/auth/me", { headers: { cookie } });
  expect(me.status).toBe(200);
  const logout = await app.request("/api/auth/logout", {
    headers: { cookie },
    method: "POST",
  });
  expect(logout.status).toBe(204);
  const meAfter = await app.request("/api/auth/me", { headers: { cookie } });
  expect(meAfter.status).toBe(401);
});

test("wrong password is 401", async () => {
  await migrate();
  await seed();
  const response = await testApp().request("/api/auth/login", {
    body: JSON.stringify({
      email: "ada@seed.test",
      password: "not-the-password",
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(401);
});
