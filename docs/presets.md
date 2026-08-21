# Preset 设计与使用

## 选择层级

| 层 | 延迟 | 适用位置 | 内容 |
| --- | --- | --- | --- |
| `base` | 低 | 编辑器、每次 agent edit、pre-commit | recommended correctness、危险 API、import hygiene、suppression governance |
| `strict` | 中 | agent 任务终局、pre-push、CI | base + complexity、mutation、console、显式类型逃逸、project import rules |
| `typeAware` / `type-aware` | 高 | TypeScript 终局、CI | strict + Promise、unsafe any、条件、deprecated API、project/type inference |
| `react` | 高 | React/TSX 项目 | type-aware ESLint/Oxlint 或 strict Biome + Hooks/domain rules |

Biome 的 `type-aware` 包含 nursery Promise 规则，是显式实验层；升级 Biome 时应先运行本仓库 fixtures 与目标项目 canary。

## ESLint

```js
import { react } from "@vibe-coding-preset/eslint-config";

export default [
  ...react,
  {
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
];
```

使用 `typeAware`/`react` 时，每个 TS 文件应属于最近的 `tsconfig.json`。不要用大范围 `allowDefaultProject` 掩盖项目配置问题。

## Biome

```jsonc
{
  "extends": ["@vibe-coding-preset/biome-config/type-aware"],
  "files": {
    "includes": ["src/**", "tests/**"]
  }
}
```

若同时使用两种工具，推荐 Biome 负责 formatter + fast lint，ESLint 只承载成熟 typed/plugin 专项。不要重复启用同一高成本检查。

## Oxlint

```ts
import { defineConfig } from "oxlint";
import { typeAware } from "@vibe-coding-preset/oxlint-config";

export default defineConfig({
  extends: [typeAware],
  options: { typeAware: true },
});
```

Oxlint 提供与另外两套对应的 `base`、`strict`、`typeAware`、`react` 层。共享 npm preset 只能从 `oxlint.config.ts` 作为对象导入；JSON 配置的 `extends` 只解析相对文件路径。`typeAware`/`react` 还需安装 `oxlint-tsgolint`，并由项目根配置显式设置 `options.typeAware: true`。

若以 Oxlint 加速既有 ESLint 项目，先运行 Oxlint，再用 `eslint-plugin-oxlint` 关闭 ESLint 中已覆盖的规则；不要假设同名规则的实现与 option 支持百分之百等价。

## Agent contract

可把以下命令写入 `AGENTS.md` 或 agent hooks：

```text
编辑后运行 pnpm format，再对 changed files 运行 fast lint。
不得新增 disable、ignore、any、非空断言或修改 lint 配置来通过检查。
交付前运行 pnpm run check；unsafe fixes 必须审阅。
```

CI 必须从干净安装运行 `pnpm run check`，不使用 `--write`，并将任何 warning 视为失败。
