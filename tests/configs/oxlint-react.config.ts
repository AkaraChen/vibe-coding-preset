import { react } from "@vibe-coding-preset/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [react],
  options: { typeAware: true },
});
