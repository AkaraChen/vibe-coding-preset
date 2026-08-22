import { expect, test, type Page } from "@playwright/test";

const SEED_PASSWORD = "Password123!";
const ALPHA_TASK_1 = "eeeeeeee-eeee-4eee-8eee-000000000001";
const ALPHA_TASK_2 = "eeeeeeee-eeee-4eee-8eee-000000000002";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/w/);
}

test("J1 onboarding", async ({ page }) => {
  const email = `j1-${String(Date.now())}@test.local`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("J1 User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/w");
  await page.getByLabel("Name").fill("Journey One");
  await page.getByLabel("Slug").fill(`j1-${String(Date.now())}`);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading")).toBeVisible();
  await page.getByRole("link", { name: "Members" }).click();
  await page.getByLabel("Email").fill("ben@seed.test");
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText("ben@seed.test")).toBeVisible();
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
  await page.goto("/w/alpha/p/roadmap/tasks?status=in_progress");
  await expect(page.getByText("J2 progress")).toBeVisible();
});

test("J3 progress events", async ({ page }) => {
  await login(page, "ada@seed.test");
  const taskId = ALPHA_TASK_2;
  await page.goto(`/w/alpha/p/roadmap/tasks/${taskId}`);
  await page
    .getByLabel("Task status")
    .selectOption("in_progress")
    .catch(async () => {
      await page.getByLabel("Task status").selectOption("cancelled");
    });
  await page.getByLabel("Comment").fill("Looking good");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Looking good")).toBeVisible();
  await page.goto("/w/alpha/activity");
  await expect(
    page.getByText(/comment.created|task.status_changed/),
  ).toBeVisible();
});

test("J5 viewer cannot submit", async ({ page }) => {
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
});
