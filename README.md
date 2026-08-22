# vibe-coding-preset

Strict, explainable ESLint, Biome, and Oxlint presets for AI-assisted coding workflows.

The repository turns linting into an executable contract for coding agents: deterministic diagnostics, zero-warning CI, guarded suppressions, and separate fast and type-aware feedback loops.

## Packages

| Package | Presets | Purpose |
| --- | --- | --- |
| `@vibe-coding-preset/eslint-config` | `base`, `strict`, `typeAware`, `react` | Flat ESLint configs with TypeScript, import, suppression, and React Hooks controls |
| `@vibe-coding-preset/biome-config` | `base`, `strict`, `type-aware`, `react` | Shareable Biome formatter/linter configs, including opt-in project/type analysis |
| `@vibe-coding-preset/oxlint-config` | `base`, `strict`, `typeAware`, `react` | Native Oxlint configs with fast and optional type-aware enforcement |

## Quick start

```sh
pnpm add -D eslint typescript @vibe-coding-preset/eslint-config
```

```js
// eslint.config.js
import { typeAware } from "@vibe-coding-preset/eslint-config";

export default typeAware;
```

```sh
pnpm add -D @biomejs/biome @vibe-coding-preset/biome-config
```

```jsonc
// biome.jsonc
{
  "extends": ["@vibe-coding-preset/biome-config/strict"]
}
```

```sh
pnpm add -D oxlint oxlint-tsgolint @vibe-coding-preset/oxlint-config
```

```ts
// oxlint.config.ts
import { defineConfig } from "oxlint";
import { typeAware } from "@vibe-coding-preset/oxlint-config";

export default defineConfig({
  extends: [typeAware],
  options: { typeAware: true },
});
```

See [`docs/presets.md`](docs/presets.md) for layer selection and agent-loop integration, and [`docs/research.md`](docs/research.md) for the underlying research. The approved Workboard full-stack linter benchmark plan is in [`docs/workboard-benchmark-plan.md`](docs/workboard-benchmark-plan.md).

## Development

```sh
corepack enable
pnpm install
pnpm run check
```

## License

MIT
