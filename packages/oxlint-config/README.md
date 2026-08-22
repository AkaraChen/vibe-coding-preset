# @vibe-coding-preset/oxlint-config

Shareable Oxlint presets for fast, low-noise AI coding feedback. Exports `base`, `strict`, `typeAware`, and `react`; the default export is `typeAware`.

```ts
import { defineConfig } from "oxlint";
import { typeAware } from "@vibe-coding-preset/oxlint-config";

export default defineConfig({
  extends: [typeAware],
  options: { typeAware: true },
});
```

Install `oxlint-tsgolint` when using `typeAware` or `react`. Oxlint requires the root config—not a shared preset—to enable `options.typeAware`.
