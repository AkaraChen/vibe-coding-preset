# Workboard (guarded)

Strict lint path for the Workboard MVP: ESLint `react` (type-aware + Hooks) and Biome type-aware composed with the React domain. Product behavior follows the KIT-895 `workboard-product-spec.md` attachment.

## Lint roles

| Tool | Owns |
| --- | --- |
| Biome | Format, fast lint, types domain, React domain / Hooks |
| ESLint | Type-aware TypeScript (Promises, `no-unsafe-*`, Hooks) as the second gate |
| `tsc --noEmit` | Full typecheck |
| Tests | Behavior, RBAC, journeys |

Warnings fail both linters (`--max-warnings 0`, `--error-on-warnings`).

`packages/db/drizzle/**` is ignored because drizzle-kit emits SQL/meta snapshots. Schema source in `packages/db/src` remains linted.

## Commands

From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
```

From `implementations/workboard/guarded/` (or via `pnpm --filter workboard-guarded`):

```sh
docker compose up -d
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm --filter @workboard/api dev
pnpm --filter @workboard/web dev
```

Gates:

```sh
pnpm --filter workboard-guarded lint:eslint
pnpm --filter workboard-guarded lint:biome
pnpm --filter workboard-guarded typecheck
pnpm --filter workboard-guarded test
pnpm --filter workboard-guarded test:e2e
pnpm --filter @workboard/web build
pnpm --filter @workboard/api build
```

Seed users (password `Password123!`): `ada@seed.test`, `ben@seed.test`, `cara@seed.test`.
