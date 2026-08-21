# @vibe-coding-preset/eslint-config

Flat ESLint presets designed as deterministic guardrails for coding agents.

```js
import { base, strict, typeAware, react } from "@vibe-coding-preset/eslint-config";
```

- `base`: fast, low-false-positive correctness and suppression controls.
- `strict`: complexity, mutation, console, imports, and explicit TypeScript escape-hatch controls.
- `typeAware`: strict plus TypeScript project-service rules for Promises, unsafe `any`, conditions, and deprecated APIs.
- `react`: type-aware plus the current React Hooks recommended rules.

Type-aware presets expect the linted file to belong to a nearby `tsconfig.json`.
