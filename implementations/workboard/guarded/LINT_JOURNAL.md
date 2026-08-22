# Lint journal — Workboard guarded (KIT-895)

Warnings are treated as failures. No `eslint-disable` / `biome-ignore` in product source.

## Slice 1 — Scaffold + lint wiring

- **Commands:** `pnpm --filter workboard-guarded format:check`, `lint:eslint`, `lint:biome`, `typecheck`, `test`; `pnpm --filter @workboard/api build`; `pnpm --filter @workboard/web build`; `curl /health`
- **Failure categories:** ESLint `require-await` on Next `rewrites`; type-aware project service missing `vitest.setup.ts`; NodeNext requiring extensions on Next app files; pnpm ignored native builds (`esbuild`, `@tailwindcss/oxide`)
- **Fix rounds:** 3 (rewrites made sync; include setup file + split web tsconfig; `allowBuilds` for native deps). Biome formatter indent forced to spaces to match preset.
- **Time:** ~25 min
- **Results:** eslint 0, biome 0, tsc 0, vitest 1 passed, Next production build ok, `GET /health` 200 `{ok:true,name:Workboard}`, Postgres 16 healthy on 55432
- **Irreducible conflicts:** none
