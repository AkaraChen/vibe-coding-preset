import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["apps/web/**", "jsdom"]],
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/api/src/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.test.tsx",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
