# Lint journal — Workboard guarded (KIT-895)

Warnings are treated as failures. No `eslint-disable` / `biome-ignore` in product source.

## Slice 1 — Scaffold + lint wiring

- **Commands:** `pnpm --filter workboard-guarded format:check`, `lint:eslint`, `lint:biome`, `typecheck`, `test`; `pnpm --filter @workboard/api build`; `pnpm --filter @workboard/web build`; `curl /health`
- **Failure categories:** ESLint `require-await` on Next `rewrites`; type-aware project service missing `vitest.setup.ts`; NodeNext requiring extensions on Next app files; pnpm ignored native builds (`esbuild`, `@tailwindcss/oxide`)
- **Fix rounds:** 3 (rewrites made sync; include setup file + split web tsconfig; `allowBuilds` for native deps). Biome formatter indent forced to spaces to match preset.
- **Time:** ~25 min
- **Results:** eslint 0, biome 0, tsc 0, vitest 1 passed, Next production build ok, `GET /health` 200, Postgres 16 healthy on 55432
- **Irreducible conflicts:** none

## Slices 2–8 — Domain, API, UI, tests

- **Commands:** same lint/typecheck plus `pnpm --filter @workboard/db migrate`, `seed`, `pnpm --filter workboard-guarded test`
- **Failure categories:**
  - `no-unsafe-*` while `drizzle-orm` / `zod` were transitive-only in `apps/api` (error-typed `eq`/`safeParse`)
  - Zod 4 deprecations (`z.string().email()`, `.uuid()`, `.datetime()`)
  - `while (true)` / `void promise` vs `no-floating-promises` (`ignoreVoid: false`)
  - `no-base-to-string` on `FormData.get`
  - `exactOptionalPropertyTypes` on optional React props
  - testing-library leftover DOM across tests; JSX without automatic runtime
- **Fix rounds:** 6 (add direct deps; compose recursive drain instead of `while(true)`; `formValue` helper; `import type`; RTL `cleanup`; Vitest `jsx: automatic`)
- **Time:** ~90 min
- **Results:** eslint 0, biome 0, tsc 0, vitest **23 passed**, Next production build ok (all spec routes)
- **Irreducible conflicts:** none

## Totals

| Gate | Final |
| --- | --- |
| ESLint `react` (type-aware + Hooks) | pass, `--max-warnings 0` |
| Biome type-aware ⊕ react domain | pass, `--error-on-warnings` |
| `tsc --noEmit` | pass |
| Vitest | 23 passed |
| Next `build` | pass |
| API `tsc --noEmit` | pass |

**Suppressions:** none in product source. SQL migrations live in `packages/db/migrations/`. Biome is invoked via `--config-path biome.guarded.jsonc` so the preset repo does not see a nested Biome root.
