# AI / vibe coding 场景下的 linter 约束研究

调研截至 2026-08-21。目标不是堆叠最多规则，而是把 linter 变成 coding agent 可反复调用、低误报、不可轻易绕过的可执行规格。

## 核心结论

1. 优先启用能高置信指向真实缺陷的 correctness/problem 规则；纯格式统一交给 formatter。
2. 采用快速 AST lint 与较慢 type/project-aware lint 双通道。前者进入每次编辑反馈，后者进入任务终局和 CI。
3. Promise 规则是 TypeScript AI 代码中最高 ROI 的约束：漏 `await`、未处理 rejection、Promise 当条件、async callback 误用都可被精确捕获。
4. `no-explicit-any` 不足以防止类型逃逸；ESLint 还需 `no-unsafe-assignment/argument/call/member-access/return`。
5. autofix 必须区分 safe 与 unsafe。格式、简单语法归一化可自动执行；删除 import、添加 `await`、修改 Hooks deps 和控制流必须复核。
6. CI 对确定性规则只接受 `error`，并执行零 warning；旧债使用可审计 baseline，而不是永久 warning budget。
7. suppressions 必须精确到规则、要求理由并报告 unused；agent 默认不得修改 config、ignore 或 baseline。
8. ESLint 仍提供最成熟的 typed lint 和插件生态；Biome 提供更快的一体化 formatter/linter，但类型推断覆盖并非 TypeScript 编译器的完整替代。
9. changed-files lint 是快速反馈，不是完整门禁。`tsconfig`、依赖图或全局声明变化会影响未修改文件，CI 仍需全量检查。
10. lint 通过只是必要条件。类型检查、行为测试、SAST、secret/SCA 与人工 review 各自负责 linter 无法证明的部分。
11. Oxlint 适合替代 ESLint 的快速规则层，并可通过 `oxlint-tsgolint` 承载大多数 typescript-eslint typed rules；迁移时仍须按实际支持列表和 option 逐条验证。

## Failure mode 与控制矩阵

| 失控模式 | ESLint | Biome | 策略 |
| --- | --- | --- | --- |
| 未使用/半成品代码 | TS `no-unused-vars`, `no-unused-expressions`, core recommended | `noUnusedVariables`, `noUnusedImports`, `noUnusedExpressions` | error；unused import 删除属于 unsafe fix |
| Promise 漏接/误用 | `no-floating-promises`, `no-misused-promises`, `await-thenable`, typed `require-await` | `noFloatingPromises`, `noMisusedPromises`（types domain + nursery） | Oxlint 用 `typescript/*` 对应规则；error，不允许用 `void` 机械消音 |
| `any` 传播 | `no-explicit-any` + `no-unsafe-*` | `noExplicitAny`；没有完整 `no-unsafe-*` 对齐保证 | 输入边界先收为 `unknown` 并验证 |
| 永真条件/漏分支 | `strict-boolean-expressions`, `no-unnecessary-condition`, `switch-exhaustiveness-check` | `noUnnecessaryConditions` 等 types 规则 | typed 层 error；迁移前测误报 |
| 错误 import/幽灵依赖/cycle | import-x + restricted imports | `noUndeclaredDependencies`, `noUnresolvedImports`, `noImportCycles` | cycle 昂贵，不进 keystroke 快层 |
| React Hooks | 官方 `react-hooks` recommended | react domain、`useHookAtTopLevel`, `useExhaustiveDependencies` | error；不可机械补依赖数组 |
| 危险 API | core `no-eval`, `no-implied-eval`, `no-new-func`，专项 security rules | security group | 高置信 pattern 阻断；hotspot 人工 triage |
| 复杂度膨胀 | complexity、depth、params | cognitive complexity | 阈值是代理指标；允许有理由的局部例外 |
| 凭据、注入数据流、权限缺陷 | 非通用 linter 职责 | 非 Biome 职责 | secret scan、CodeQL/Semgrep、测试、review |

## ESLint 与 Biome 的能力边界

typescript-eslint v8 推荐 `parserOptions.projectService: true`，复用与编辑器相同的 `tsconfig.json` 语义。typed lint 需要 TypeScript 建立程序，耗时通常接近一次 typecheck，因此本仓库把它放在独立 `typeAware` 层。

Biome 2.x 已经不是“纯 syntax linter”：它提供 project scanner、module graph、types domain、跨文件规则和 GritQL plugins。但 Biome 官方说明其 type inference 只是 TypeScript 类型系统的子集；Biome 2.0 发布时对 `noFloatingPromises` 的有限测试约覆盖 typescript-eslint 检出案例的 75%。当前 `noFloatingPromises` 与 `noMisusedPromises` 仍属于 nursery，所以本仓库只在明确 opt-in 的 `type-aware` preset 中启用。

Biome 的 GritQL plugin 可匹配 AST pattern、产生 diagnostics 和 safe/unsafe rewrite，但不等同于任意 JavaScript ESLint plugin API。需要成熟的 `no-unsafe-*`、复杂 resolver 或框架插件时，应保留 ESLint 专项层。

Oxlint 1.x 的配置模型面向 ESLint v8 eslintrc 兼容，原生实现 core、TypeScript、import、React/Hooks 等常用插件规则，并提供 ESLint flat config 迁移器；“兼容”仍不是完全同构。JavaScript plugin API 兼容处于 alpha，规则总量、options 和 typed 覆盖会随版本变化。本仓库因此只启用已由 fixtures 验证的交集，并把 Oxlint 与 ESLint/Biome 保持相同的四层语义。

Oxlint 的类型感知由 `oxlint-tsgolint` 提供。共享配置可携带 typed 规则，但 `options.typeAware` 是根配置选项，不能由包静默开启；这使性能成本在消费项目中保持显式。共享 npm 配置也需要在 `oxlint.config.ts` 中 import 对象，JSON `extends` 不解析包名。

## 严重度和 fix 策略

- 语法、运行时和类型 bug 且修复意图明确：`error`。
- nursery、新项目扫描、复杂度或上下文相关规则：先 opt-in；证明低误报后再升级。
- 纯偏好：formatter 或关闭。
- CI：ESLint `--max-warnings 0`；Biome `--error-on-warnings`。
- 自动执行：formatter 与规则声明的 safe fix。
- 人工复核：unused import 删除、Promise/控制流、Hooks dependencies、任何 unsafe fix。

ESLint 开启 `reportUnusedDisableDirectives` 与 `reportUnusedInlineConfigs`，并用 eslint-comments 要求 description、禁止 unlimited disable。Biome suppression 原生带 explanation 且报告 unused，但还需 review/CI 禁止宽泛的 `biome-ignore-all`、range suppression 和未授权 ignore/config 变更。

## 推荐反馈闭环

1. agent 编辑后先运行 formatter 与 safe fixes。
2. 对 changed files 运行 base/strict 快 lint，输出简洁的 `path:line:column rule message`。
3. 每轮只修一个根因簇并重跑；连续两轮错误集合不缩小或三轮未清零时停止机械重试。
4. 任务终局运行 full lint → `tsc --noEmit` → relevant tests → build/security。
5. pre-commit 只处理 staged files；typed lint、cycle 与全量扫描放 pre-push/CI。

agent 普通任务不应修改 `eslint.config.*`、`biome.json*`、`tsconfig*`、ignore、suppressions/baseline 或校验脚本。确需修改时应成为显式任务并单独 review。

## 争议与待验证项

- 更严格不必然更好：高噪规则会诱导 agent 添加 assertion、无意义 helper 或 suppression。
- complexity 和行数并非可维护性的真值；清晰的 switch 可能优于碎片化间接调用。
- `exhaustive-deps` 捕获真实 stale closure，但直接补齐不稳定函数可能造成 effect loop；正确修复常是调整数据流。
- 静态分析反馈能改善部分代码生成实验，但 diagnostic count 下降不等于语义正确；必须同时跑测试。
- 在具体仓库发布 strict 默认值前，应测 cold/warm lint 时间、内存、TP/FP/FN，以及 agent 的投机修复率。

## 主要来源

- [ESLint configure rules](https://eslint.org/docs/latest/use/configure/rules)
- [ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions)
- [typescript-eslint typed linting](https://typescript-eslint.io/getting-started/typed-linting/)
- [typescript-eslint performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/)
- [typescript-eslint no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/)
- [TypeScript TSConfig reference](https://www.typescriptlang.org/tsconfig/)
- [Biome 2.0 release](https://biomejs.dev/blog/biome-v2/)
- [Biome 2.5 release](https://biomejs.dev/blog/biome-v2-5/)
- [Biome domains](https://biomejs.dev/linter/domains/)
- [Biome suppressions](https://biomejs.dev/analyzer/suppressions/)
- [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config.html)
- [Oxlint configuration reference](https://oxc.rs/docs/guide/usage/linter/config-file-reference)
- [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware)
- [Migrating from ESLint to Oxlint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint)
- [React Rules of Hooks lint](https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks)
- [GitHub Copilot hooks](https://docs.github.com/en/copilot/concepts/agents/hooks)
- [CodeQL JavaScript and TypeScript queries](https://docs.github.com/en/code-security/reference/code-scanning/codeql/codeql-queries/javascript-typescript-built-in-queries)
- [Fu et al., Security Weaknesses of Copilot-Generated Code](https://arxiv.org/abs/2310.02059)（2023，观察性研究）
- [Static Analysis as a Feedback Loop](https://arxiv.org/abs/2508.14419)（2025，预印本）
