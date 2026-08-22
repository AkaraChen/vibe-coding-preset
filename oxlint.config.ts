import { base } from "@vibe-coding-preset/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  ignorePatterns: ["tests/fixtures/invalid*", "tests/fixtures/react-invalid*"],
});
