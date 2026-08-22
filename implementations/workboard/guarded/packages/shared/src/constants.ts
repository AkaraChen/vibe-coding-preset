export const APP_NAME = "Workboard";

export const SESSION_COOKIE = "workboard_session";
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export const PASSWORD_MIN_LENGTH = 10;
export const TASK_PAGE_SIZE_DEFAULT = 20;
export const TASK_PAGE_SIZE_MAX = 100;
export const BULK_STATUS_MAX = 50;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_MIME_ALLOWLIST = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;

export const SEED_PASSWORD = "Password123!";

export const SEED_USER_IDS = {
  ada: "11111111-1111-4111-8111-111111111111",
  ben: "22222222-2222-4222-8222-222222222222",
  cara: "33333333-3333-4333-8333-333333333333",
} as const;

export const SEED_WORKSPACE_IDS = {
  alpha: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  beta: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

export const SEED_PROJECT_IDS = {
  alphaRoadmap: "cccc1111-cccc-4ccc-8ccc-111111111111",
  alphaOps: "cccc2222-cccc-4ccc-8ccc-222222222222",
  betaLaunch: "dddd1111-dddd-4ddd-8ddd-111111111111",
} as const;

export function seedTaskId(scope: "alpha" | "beta", index: number): string {
  const prefix = scope === "alpha" ? "e" : "f";
  const n = index.toString().padStart(12, "0");
  return `${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${n}`;
}
