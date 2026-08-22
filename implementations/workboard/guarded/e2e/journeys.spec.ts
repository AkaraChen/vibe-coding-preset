import { expect, test, type Page } from "@playwright/test";

const SEED_PASSWORD = "Password123!";
const ALPHA_TASK_1 = "eeeeeeee-eeee-4eee-8eee-000000000001";
const ALPHA_TASK_2 = "eeeeeeee-eeee-4eee-8eee-000000000002";
const BETA_TASK_1 = "ffffffff-ffff-4fff-8fff-000000000001";
const ROADMAP_ID = "cccc1111-cccc-4ccc-8ccc-111111111111";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/w/);
}

test("J1 onboarding", async ({ page, browser }) => {
  const stamp = String(Date.now());
  const email = `j1-${stamp}@test.local`;
  const slug = `j1-${stamp}`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("J1 User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/w");
  await page.getByLabel("Name").fill("Journey One");
  await page.getByLabel("Slug").fill(slug);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.waitForURL(new RegExp(`/w/${slug}$`));
  await expect(page.getByTestId("workspace-heading")).toHaveText("Journey One");
  await page.getByRole("link", { name: "Members" }).click();
  await page.getByLabel("Email").fill("ben@seed.test");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("ben@seed.test")).toBeVisible();

  const benContext = await browser.newContext();
  const benPage = await benContext.newPage();
  await login(benPage, "ben@seed.test");
  await expect(
    benPage.getByRole("link", { name: "Journey One" }),
  ).toBeVisible();
  await benContext.close();
});

test("unauthenticated /w redirects to login", async ({ page }) => {
  await page.goto("/w/alpha");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("J2 plan with filters", async ({ page }) => {
  await login(page, "ada@seed.test");
  await page.goto("/w/alpha/p/roadmap/tasks/new");
  await page.getByLabel("Title").fill("J2 todo");
  await page.getByRole("button", { name: "Create task" }).click();
  await page.goto("/w/alpha/p/roadmap/tasks/new");
  await page.getByLabel("Title").fill("J2 progress");
  await page.getByLabel("Status").selectOption("in_progress");
  await page.getByRole("button", { name: "Create task" }).click();
  await page.goto("/w/alpha/p/roadmap/tasks/new");
  await page.getByLabel("Title").fill("J2 blocked");
  await page.getByLabel("Status").selectOption("blocked");
  await page.getByRole("button", { name: "Create task" }).click();
  await page.goto("/w/alpha/p/roadmap/tasks?status=in_progress");
  await expect(page.getByText("J2 progress")).toBeVisible();
  await expect(page.getByText("J2 todo")).toHaveCount(0);
  await expect(page.getByText("J2 blocked")).toHaveCount(0);
});

test("J3 progress events", async ({ page }) => {
  await login(page, "ada@seed.test");
  const taskId = ALPHA_TASK_2;
  await page.goto(`/w/alpha/p/roadmap/tasks/${taskId}`);
  await page.getByLabel("Task status").selectOption("done");
  await page.getByLabel("Comment").fill("Looking good");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Looking good")).toBeVisible();
  await page.getByLabel("Attachment").setInputFiles({
    buffer: TINY_PNG,
    mimeType: "image/png",
    name: "dot.png",
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await page.goto("/w/alpha/activity");
  await expect(page.getByTestId("activity-task.status_changed")).toBeVisible();
  await expect(page.getByTestId("activity-comment.created")).toBeVisible();
  await expect(page.getByTestId("activity-attachment.created")).toBeVisible();
});

test("J4 conflict banner on stale write", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await login(pageA, "ada@seed.test");
  await login(pageB, "ada@seed.test");
  const created = await pageA.request.post(
    `/api/projects/${ROADMAP_ID}/tasks`,
    {
      data: { title: `J4 conflict ${String(Date.now())}` },
    },
  );
  expect(created.ok()).toBeTruthy();
  const createdBody = (await created.json()) as { task: { id: string } };
  const taskId = createdBody.task.id;

  const firstGet = pageB.waitForResponse(
    (response) =>
      response.url().includes(`/api/tasks/${taskId}`) &&
      response.request().method() === "GET" &&
      response.ok(),
  );
  await pageB.goto(`/w/alpha/p/roadmap/tasks/${taskId}`);
  const snapshot: unknown = await (await firstGet).json();
  await pageB.route(`**/api/tasks/${taskId}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        body: JSON.stringify(snapshot),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    await route.continue();
  });

  await pageA.goto(`/w/alpha/p/roadmap/tasks/${taskId}`);
  await pageA.getByLabel("Task status").selectOption("in_progress");
  await expect(pageA.getByLabel("Task status")).toHaveValue("in_progress");
  await pageB.getByLabel("Task status").selectOption("cancelled");
  await expect(pageB.getByTestId("conflict-banner")).toBeVisible();
  await contextA.close();
  await contextB.close();
});

test("J5 viewer cannot submit", async ({ page, browser }) => {
  await login(page, "cara@seed.test");
  const taskId = ALPHA_TASK_1;
  await page.goto(`/w/alpha/p/roadmap/tasks/${taskId}`);
  await expect(page.getByLabel("Task status")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Add comment" }),
  ).toBeDisabled();
  const response = await page.request.patch(`/api/tasks/${taskId}`, {
    data: { title: "nope", version: 1 },
  });
  expect(response.status()).toBe(403);

  const benContext = await browser.newContext();
  const benPage = await benContext.newPage();
  await login(benPage, "ben@seed.test");
  const hidden = await benPage.request.get(`/api/tasks/${BETA_TASK_1}`);
  expect(hidden.status()).toBe(404);
  await benContext.close();
});
