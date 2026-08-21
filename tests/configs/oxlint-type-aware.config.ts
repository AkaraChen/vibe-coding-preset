import { typeAware } from "@vibe-coding-preset/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [typeAware],
  options: { typeAware: true },
});
