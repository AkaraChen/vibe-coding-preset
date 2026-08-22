# Workboard Benchmark 实施计划（修订终稿）

文档状态：KIT-893 **唯一**实施计划。只交付计划，不实现代码。  
宿主推荐：独立仓库 `workboard-benchmark`（默认；理由见 §3.4）。  
对齐仓库：`vibe-coding-preset`（三套工具 × 四层；研究见 `docs/research.md`；fixtures 已覆盖 floating Promise、`any`、条件 Hooks）。  
锁定日期：2026-08-22。修订日期：2026-08-22（响应 Guided Review request-changes）。

**规格所有权（覆盖本线程两份旧附件）：**

| 稿 | 评论 id | 地位 |
| --- | --- | --- |
| 本文件 | 本评论附件 | **唯一终稿**；实现只准对照这里 |
| 稿 A | `01a027e3-d5cb-7c99-959e-b29dab26cd18` | 底稿；已被本修订取代 |
| 稿 B | `01a027e6-839e-7d6b-a987-10cd35bb4b18` | **作废**。尤其不可采信其 Biome 终局格（把包内 `react.jsonc` 写成已含 type-aware） |

稿 B 与本文件冲突时一律以本文件为准：issue 数 25、非法迁移 422、任务列表 OFFSET、batch 为 must、活动同事务 + must outbox、seed 3 用户 / 2 workspace、owner 仅 `members.role`、Biome 终局格必须组合 type-aware + react。

---

## 1. 一页概览与范围

### 1.1 Overview

**Workboard** 是一个中等偏大的全栈 TypeScript 协作应用：多用户 Workspace → Project → Task → Comment，产品语义接近 Linear / Asana 的简化版。它不是 Todo List，也不是 CMS：复杂度来自 RBAC、任务状态机、乐观并发、附件、SSE 活动流和真实 API/DB 边界。

它同时是 **linter 对比实验的宿主应用**。实验问题不是「这个 app 好不好用」，而是：在同一 git baseline、同一任务语料、同一模型参数与同一测试数据下，不同 lint preset（无 lint / ESLint 各层 / Biome 各层 / Oxlint 扩展列）对 AI / vibe coding 产出的约束效果有何差异——捕获率、误报、autofix、绕过、修复轮次、最终测试通过与人工 review 负担。

选择 Workboard 的理由（已锁定，不再讨论）：

- 实体链与 RBAC/状态机天然产生 Promise、类型逃逸、Hooks、IDOR、409 冲突等真实缺陷面。
- 前后端分离（Next.js UI + 独立 Hono API + Postgres）让「React 状态」与「API/DB 边界」成为可拆分的任务语料，而不是单页 mock。
- 贴近团队日常，提示词可重复、可评审，不必编造生僻业务。
- 现有 preset fixtures（floating Promise、`any`、条件 Hooks）可以直接扩展到这个代码面，不必另起缺陷分类学。

### 1.2 为何适合作为 linter benchmark

| 维度 | Workboard 提供的可观测面 | 对应 research 结论 |
| --- | --- | --- |
| Promise / async | 任务状态变更、SSE、附件、Drizzle 事务 | Promise 规则最高 ROI |
| 类型逃逸 | JSON 活动 payload、multipart 元数据、外部输入 | `no-explicit-any` 不够，需要 `no-unsafe-*` |
| React | 列表筛选、乐观更新、条件渲染 Hooks | Hooks 规则必须 error，不可机械补 deps |
| 分层质量 | RBAC、IDOR、密钥、注入 | lint ≠ 全部质量责任 |
| 反馈闭环 | 快 lint vs typed lint vs tsc vs test | 双通道；changed-files ≠ 全量门禁 |
| 绕过 | disable / ignore / `any` / 删测试 | suppressions 需治理；防作弊门禁 |

### 1.3 In-scope

- 邮箱密码 session（HttpOnly cookie）+ workspace RBAC（owner / admin / member / viewer）。
- Workspace / Project / Task / Comment 的真实 CRUD、列表分页筛选排序、部分批量操作。
- 乐观更新 + 409 版本冲突 + 空 / loading / error / forbidden 四态。
- 本地磁盘 multipart 附件（存储接口可替换 S3，本计划 must 只实现本地适配器）。
- SSE 活动流（单进程 fanout）+ 同事务写入 `activities` + **最小 outbox worker**（F21 must，见 §4.1）。
- PostgreSQL + Drizzle schema/migrations/seed；Docker Compose 本地一键起。
- Vitest 单元/集成、Testing Library 组件、Playwright e2e。
- Benchmark harness：9 格 lint 矩阵、≥16 条任务语料、≥20 条缺陷注入、JSONL+Markdown 报告、防作弊门禁。
- 全矩阵共用 Biome format（linter 与 formatter 解耦）。

### 1.4 Out-of-scope

- 本 issue：任何应用代码、脚手架落地、跑实验、开 PR（计划只作为 issue 附件交付）。
- 移动端原生 / React Native / 桌面壳。
- 多租户计费、用量、Stripe、组织级 SSO。
- OAuth / 魔法链接 / WebAuthn（可列 could，不进 MVP）。
- 实时协同编辑（CRDT / 光标 / 操作变换）。
- WebSocket、推送通知服务、邮件投递（事务邮件 could）。
- 完整 design system、主题市场、i18n（文案英文硬编码即可）。
- Kubernetes、多区域、只读副本、全文搜索引擎。
- 把安全/权限正确性全部算进 lint 指标。
- 在 `vibe-coding-preset` 发布面内嵌实验产物（见 §3.4）。

### 1.5 成功标准（本计划交付后，后续实现可验收）

下列条目全部为可观察条件。实现阶段未开始前，本 issue 的成功标准是「计划本身满足这些设计」：

1. **矩阵可一键跑同一任务集**：至少 7 个最低格（`none` / `eslint-base` / `eslint-strict` / `eslint-typeAware+react` / `biome-base` / `biome-strict` / `biome-type-aware+react`）加上 2 个扩展格（`oxlint-base` / `oxlint-typeAware+react`）共用同一 `benchmarks/tasks/` 目录；一条命令（建议 `pnpm bench --cell <id> --task Txx`）可复跑单格单任务。
2. **控制变量可复现**：git baseline SHA、lockfile、Node 22、pnpm、seed SQL、模型/参数模板均写入每次 run 的 JSONL 头记录；换 cell 不得改业务源码，只换 lint config。
3. **报告字段齐全**：每次 run 产出 JSONL 记录，字段见 §8.6；Markdown 汇总可由 JSONL 生成。
4. **防作弊门禁可执行**：harness 在任务前后跑 `git diff` allowlist、扫描 disable/`any`/非空断言/删测试/改 config；违规写 `cheat=true` 且该 cell-task 记失败。
5. **分层责任可执行**：缺陷目录每条都有 `expected_catch_layer`；安全/RBAC 正确性不得记入 lint 捕获率分子。
6. **产品 MVP 可走通**：未登录无法进受保护路由；owner 可建 workspace/project/task；**member 可写其所在 workspace 内任意 task**（workspace 级写权限，不以 assignee / `created_by` 为限）；viewer GET 200、PATCH 403；**非成员 GET/PATCH 一律 404**（防探测，不 403）；任务状态机非法迁移 422；并发 PATCH 无 If-Match 或版本过期 409。
7. **页面 ↔ API ↔ 实体无孤立模块**：§5.4 映射表覆盖全部 must 页面。

---

## 2. 角色、旅程、功能分级

### 2.1 角色

| 角色 | 身份 | 权限摘要 |
| --- | --- | --- |
| guest | 未登录 | 仅 `/login`、`/register`；其它路由重定向 |
| viewer | `workspace_members.role=viewer` | 读 workspace/project/task/comment/activity/attachment 元数据；禁止一切写 |
| member | `role=member` | viewer + **对该 workspace 内任意 task** 创建/编辑/改状态/评论/上传附件（不以 assignee 或 `created_by` 为限）；不可改成员角色、不可删 workspace/project |
| admin | `role=admin` | member + 管理项目、邀请/改非 owner 成员、归档项目；不可删 workspace、不可改 owner |
| owner | `role=owner`（每 workspace 恰好 1 人） | 全部，含删除 workspace、转让 owner、移除 admin |

不变量：

- 一个用户可加入多个 workspace，角色按 `(workspace_id, user_id)` 计。
- 不能把自己从唯一 owner 移除；转让必须指定已存在成员。
- guest 不是 `workspace_members` 行。

### 2.2 核心旅程（5 条）

**J1 入驻**：注册 → 登录 → 创建 workspace（创建者自动 owner）→ 邀请 member/viewer → 被邀请人登录后看到该 workspace。  
完成定义：seed 外的新用户走完上述步骤后，`GET /api/workspaces` 含新 workspace；被邀请人 `GET /api/workspaces/:id/members` 能看到自己；**已登录但非该 workspace 成员** 对 `GET /api/workspaces/:id`、`GET /api/workspaces/:id/members`、该空间下 project/task 的 GET/PATCH **一律 404**（`not_found`），不得 403。

**J2 规划**：在 workspace 内创建 project → 创建若干 task（含 assignee、priority、due）→ 列表按 status/assignee/q 筛选。  
完成定义：Playwright 能从 UI 建 project+3 条不同 status 的 task，筛选 `status=in_progress` 只显示对应行。

**J3 推进**：打开 task → 改 status（乐观更新）→ 写 comment → 上传附件 → 活动流出现对应事件。  
完成定义：status 切换后 200ms 内 UI 已变；刷新后与服务器一致；SSE 或活动列表出现 `task.status_changed`、`comment.created`、`attachment.created`。

**J4 冲突恢复**：两会话同时 PATCH 同一 task（不同 `version`）→ 后者 409 → UI 展示冲突并提供「重新加载」。  
完成定义：集成测试固定 409；组件测试冲突 banner 可见；不允许静默覆盖。

**J5 权限边界**：viewer 打开 task 详情 → 编辑控件不可用且键盘不可聚焦提交 → 直接调 PATCH 返回 403。  
完成定义：e2e 断言按钮 `disabled` 或未渲染；API 集成断言 403 body.code=`forbidden`。

每条旅程映射到功能表 ID，无孤立功能。

### 2.3 功能表（must / should / could）

| ID | 功能 | 级别 | 旅程 | 可观察完成定义 |
| --- | --- | --- | --- | --- |
| F01 | 注册 / 登录 / 登出 / `GET /me` | must | J1 | 错误密码 401；成功 Set-Cookie HttpOnly；登出后 `/me` 401 |
| F02 | Session 过期与续期 | must | J1 | `sessions.expires_at` 过期后 401；活跃请求可滑动续期（默认 7 天绝对过期 + 24h 滑动） |
| F03 | 受保护路由 | must | J1 J5 | 未登录访问 `/w/*` 302 到 `/login?next=` |
| F04 | Workspace CRUD | must | J1 | owner 创建后列表可见；非成员 GET 404（防探测，不暴露 403） |
| F05 | 成员邀请与角色变更 | must | J1 J5 | admin 邀请 email 已注册用户；viewer 邀请 403；不能降级唯一 owner |
| F06 | Project CRUD + 归档 | must | J2 | slug 在 workspace 内唯一，冲突 409；归档后默认列表隐藏 |
| F07 | Task CRUD | must | J2 J3 | 创建返回 201 + `version=1`；非法 status 422 |
| F08 | Task 状态机 | must | J3 | 仅允许 §4.3 迁移表中的边；否则 422 `invalid_transition` |
| F09 | 列表分页/筛选/搜索/排序 | must | J2 | 任务列表用 OFFSET：`page/pageSize/status/assignee/q/sort`；`q` 对 title ILIKE；稳定排序 `updated_at desc, id desc`。评论/活动用 cursor（时间线追加）。两者并存是刻意的。 |
| F10 | 批量改 status（≤50 ids） | must | J2 | **锁定** HTTP 200 + `{results:[{id,ok,error?}]}`；永不 207。部分失败不回滚已成功项；viewer 整单 403；ids>50 整单 422 |
| F11 | 乐观更新 + rollback | must | J3 J4 | onMutate 写缓存；onError 回滚；409 不自动重试 |
| F12 | Comment CRUD（软删） | must | J3 | 作者或 admin 可删；viewer 403；软删后列表不返回 body |
| F13 | 附件 multipart 上传/下载/删除 | must | J3 | MIME allowlist + 10MB；磁盘路径不出现在 URL（用 attachment id）；viewer 可下载、不可删 |
| F14 | 活动写入 + 列表游标 | must | J3 | 每个成功写操作在同一 DB 事务插入 `activities` |
| F15 | SSE 活动流 | must | J3 | `text/event-stream`；`Last-Event-ID` 可续；未登录 401 |
| F16 | 空/loading/error/forbidden 四态 | must | J2 J5 | 四态均有 data-testid，e2e 可断言 |
| F17 | 键盘可达主流程 | must | J1–J3 | Tab 顺序覆盖登录、创建 task、改 status、提交 comment；可见 focus ring |
| F18 | Seed 数据 | must | 全部 | `pnpm db:seed` 可幂等重置为固定 UUID：**3 用户 / 2 workspace**（见种子表）/ alpha 2 projects + 30 tasks；beta 1 project + ≥2 tasks（供 T09） |
| F19 | 登录限流 | should | J1 | 同 IP 5 次/分钟失败 → 429 |
| F20 | SSE 失败回退为 15s 轮询 | should | J3 | EventSource onerror 后改 GET 游标 |
| F21 | 活动 outbox worker | must | J3 | 写操作同事务插入 `activities` + `activity_outbox(pending)`；进程内 worker drain 后发 SSE；hub throw 时行保持 pending 且可重放。这是 issue 要求的「后台任务」异步边界，与 F15 活动流分立 |
| F22 | Task 从 done 重开为 todo | should | J3 | 仅 owner/admin；cancelled 默认不可重开 |
| F23 | 批量指派 | should | J2 | `POST /tasks/bulk` action=assign |
| F24 | 附件存储换 S3 适配器 | could | J3 | 接口 `Storage.put/get/delete`；must 只落地 `FsStorage` |
| F25 | OAuth | could | J1 | 明确不做 MVP |
| F26 | 列表虚拟化 | could | J2 | 默认分页 20，不虚拟化 |
| F27 | Redis SSE 多实例 | could | J3 | MVP 单进程 EventEmitter |
| F28 | i18n / 主题 / 通知邮件 | could | — | 不做 |
| F29 | Webhook 出站 | could | J3 | 异步边界由 **F21 outbox worker** 满足；出站 webhook 仍不做 MVP |

Must 覆盖 issue 要求：auth（F01–F03）、CRUD+列表筛选（F04–F10）、乐观更新（F11）、附件（F13）、活动流（F14–F15）、**后台任务异步边界（F21 outbox drain，与 SSE 分立）**、a11y 基础（F16–F17）。

**F18 种子表（固定 UUID，写入 `packages/db/seed.ts`）：**

| 用户 | email（例） | alpha（slug=`alpha`） | beta（slug=`beta`） |
| --- | --- | --- | --- |
| Ada | ada@seed.test | owner | owner（beta 仅此一人） |
| Ben | ben@seed.test | member | **非成员** |
| Cara | cara@seed.test | viewer | **非成员** |

T09 / IDOR 集成测试 **必须使用上述 seed 的 beta task UUID**，禁止在测试里现场创建第二 workspace（避免每个任务自己造数据、破坏 baseline）。

---

## 3. 技术栈与架构

### 3.1 推荐栈（锁定）

| 层 | 选择 | 理由 |
| --- | --- | --- |
| 包管理 / Node | pnpm workspace + Node 22（对齐 preset：`packageManager: pnpm@11.22.0`，`engines.node: ^22.13.0 \|\| >=24`；benchmark 锁 22.x） | 与 preset 仓库可复用 catalog 习惯 |
| 前端 | Next.js App Router + React 19 + TypeScript | 主要 benchmark 面；App Router 产生真实 async 服务端边界，但 **业务不放 Route Handlers** |
| 数据获取 | TanStack Query | 乐观更新/rollback 是一等公民；禁止再用 Zustand 存 server state |
| UI | Tailwind + 少量自研组件（Button/Input/Dialog/Table） | 不做 design system，减少与 lint 无关的 diff 噪声 |
| 后端 | 独立 Hono API（`apps/api`） | 边界清晰，利于 API/DB 任务语料 |
| 校验 | Zod（共享于 `packages/shared`） | 前后端同一 schema |
| DB | PostgreSQL 16 + Drizzle ORM + Drizzle migrations | 迁移可审；不用 Prisma |
| Auth | 自研邮箱密码 + `sessions` 表 + HttpOnly cookie | 不做 OAuth；密码 argon2id |
| 实时 | SSE（Hono stream） | 不做 WebSocket |
| 附件 | multipart → `Storage` 接口 → `FsStorage` | 可替换 S3 |
| 测试 | Vitest + Testing Library + Playwright | 与锁定一致 |
| Formatter | **全矩阵共用 Biome format** | 避免 Prettier/Biome 混用污染 lint 对比 |
| Lint 消费 | `@vibe-coding-preset/{eslint,biome,oxlint}-config` 按 cell 切换 | 被测对象就是这些 preset |

实施阶段 1 将 `next` / `react` / `react-dom` / `hono` / `drizzle-orm` / `zod` 等写入 lockfile 的精确版本。默认取当时与 React 19 兼容的 Next.js 稳定版；版本本身是控制变量，一经锁定不得在实验中途升级。

### 3.2 关键依赖 vs 应避免依赖

**允许（must 集合）**：`next`、`react`、`react-dom`、`hono`、`@hono/node-server`、`@hono/zod-validator`、`drizzle-orm`、`drizzle-kit`、`postgres`、`zod`、`@tanstack/react-query`、`argon2` 或 `@node-rs/argon2`、`tailwindcss`、`vitest`、`@testing-library/react`、`jsdom`、`@playwright/test`、`@biomejs/biome`、`eslint`、`oxlint`、`oxlint-tsgolint`、`typescript`、preset 三包。

**应避免**：

- NextAuth / Clerk / Better Auth / Lucia（会把 session 边界藏进黑盒，削弱 API 语料）。
- Prisma、TypeORM。
- tRPC / GraphQL（REST 清单更适合逐条任务与权限表）。
- Redux、Zustand、Jotai、Recoil（server state 用 Query）。
- shadcn 全量 / Radix 全家桶当 design system（与锁定「少量自研」冲突；个别无样式行为库若 1 个 Dialog 需要可开 could，默认不用）。
- Socket.io / ws。
- 重型 CMS、S3 SDK（must 阶段）、i18n 框架、状态机库（XState——状态机用纯函数 `transition(status, action)`）。
- `eslint-disable` 作为依赖策略；CI 视宽泛 disable 为作弊。

### 3.3 文字版架构

```
Browser
  │  HTML/JS from Next.js (apps/web :3000)
  │  cookie: workboard_session (HttpOnly, Path=/, SameSite=Lax, Secure in prod)
  │
  ├─ document/navigation ──► Next.js App Router
  │     只做 RSC 壳、受保护布局、rewrite
  │     禁止 Route Handlers 承载业务
  │
  └─ XHR/fetch / EventSource ──► /api/*  (Next rewrite → Hono :3001)
        │
        Hono apps/api
          ├─ middleware: request-id, session, rbac
          ├─ routes: auth, workspaces, projects, tasks, comments, attachments, activities
          ├─ services: 纯函数状态机 + 权限策略
          ├─ repos: Drizzle
          ├─ activity: 同事务 insert activities + activity_outbox(pending)
          ├─ worker: 进程内 drain outbox → SSE hub.publish（失败则 pending 重试）
          └─ storage: FsStorage (./data/attachments)
                │
                PostgreSQL 16
```

鉴权：登录写入 `sessions`（token 只存 sha256，cookie 存随机 token）。API 从 cookie 取 token → hash 查找 → 挂 `c.get('user')`。Next 布局调用 `GET /api/auth/me` 决定是否 redirect；UI 不自建 JWT。

部署边界：

- 本地 must：`docker compose up` 起 `postgres`；host 跑 `pnpm --filter api dev` 与 `pnpm --filter web dev`，或 compose 再加 api/web 两服务。
- 可选单机：同一 compose 含 postgres + api + web，web 环境变量 `API_PROXY=http://api:3001`。
- 不做 k8s。附件目录挂 volume。
- CI：GitHub Actions 服务容器起 Postgres；干净 `pnpm install --frozen-lockfile`。

### 3.4 Benchmark 宿主：独立仓库（推荐）

二选一结论：**独立仓库 `workboard-benchmark`**，不要放进 `vibe-coding-preset` 的 `benchmarks/workboard`。

| | 独立仓库 | preset 子目录 |
| --- | --- | --- |
| 发布面 | 不污染 npm packages | 实验产物、fixture 大文件、报告易误打包 |
| CI 节奏 | 实验矩阵可小时级；preset CI 保持快 | 矩阵会拖垮 preset `pnpm run check` |
| 版本钉扎 | 对 preset SHA/semver 显式钉扎 | 源码树耦合，难以回放「当时的 preset」 |
| 权限 | 实验可私有 | 与 MIT preset 混在一起 |

未发表 npm 前，benchmark 仓库用 pnpm `overrides` 或 git submodule 钉扎 `vibe-coding-preset` **精确 git SHA**，并在每次实验报告头记录该 SHA。Preset 一旦 publish，改为 registry 精确版本。

### 3.5 Monorepo 目录树（独立仓库）

```
workboard-benchmark/
  package.json                 # pnpm 11.22, engines node 22
  pnpm-workspace.yaml
  pnpm-lock.yaml
  docker-compose.yml           # postgres:16 + volume
  biome.format.jsonc           # 仅 formatter，全矩阵共用
  tsconfig.base.json
  apps/
    web/                       # Next.js App Router
    api/                       # Hono
  packages/
    db/                        # drizzle schema, migrations, seed
    shared/                    # zod schemas, error codes, 领域类型
    storage/                   # Storage 接口 + FsStorage
    lint-cells/                # 9 个 cell 的 eslint/biome/oxlint 包装配置
  benchmarks/
    harness/                   # 跑 cell×task、防作弊、写 JSONL
    tasks/T01/…T16/            # prompt.md, allowlist.txt, tests/
    defects/catalog.json       # D01…
    seeds/                     # 与 packages/db seed 同源
    reports/                   # gitignore；CI artifact
  .github/workflows/
    ci.yml                     # format + tsc + unit/int + 非矩阵 lint 的开发用 preset
    bench.yml                  # workflow_dispatch 跑矩阵
```

### 3.6 模块职责与依赖方向

```
packages/shared  ←  packages/db  ←  apps/api
       ↑                ↑
       └──── apps/web ──┘（web 禁止依赖 db）
packages/storage ← apps/api
packages/lint-cells ← 仅 benchmarks/harness 与各 cell 工作树
```

硬规则：

- `apps/web` **不得** import `packages/db`、`drizzle-orm`、`postgres`、`apps/api` 源码。
- `packages/db` **不得** import Hono 或 React。
- `packages/shared` **不得** import 任何 app。
- Next.js `app/api/**` 除 rewrite 代理外保持空。
- 违反上述的 import 由 ESLint `import-x` restricted + Biome `noUndeclaredDependencies` 在开发 preset 中拦截（这是宿主工程卫生，不是被测矩阵本身）。

---

## 4. 数据模型与 API 合约

### 4.1 表、字段、约束、索引

公共列：`id uuid PK default gen_random_uuid()`，时间戳 `timestamptz not null default now()`。

**users**  
`email citext not null unique`  
`password_hash text not null`  
`display_name text not null`  
`created_at` `updated_at`

**sessions**  
`user_id uuid not null → users on delete cascade`  
`token_hash text not null unique`  
`expires_at timestamptz not null`  
`created_at`  
索引：`(user_id)`、`(expires_at)`

**workspaces**  
`name text not null`  
`slug citext not null unique`  
`created_at` `updated_at`  
（owner 以 members.role=owner 表达，不另存 owner_id，避免双写。表可有 `created_by uuid → users` 仅审计。）

**workspace_members**  
`workspace_id uuid not null → workspaces on delete cascade`  
`user_id uuid not null → users on delete cascade`  
`role text not null check in ('owner','admin','member','viewer')`  
`created_at`  
唯一：`(workspace_id, user_id)`  
部分唯一：每个 workspace 至多一个 owner——`unique (workspace_id) where role = 'owner'`

**projects**  
`workspace_id uuid not null → workspaces on delete cascade`  
`name text not null`  
`slug citext not null`  
`description text not null default ''`  
`archived_at timestamptz null`  
`created_at` `updated_at`  
唯一：`(workspace_id, slug)`  
索引：`(workspace_id, archived_at)`

**tasks**  
`project_id uuid not null → projects on delete cascade`  
`title text not null`  
`description text not null default ''`  
`status text not null check in ('backlog','todo','in_progress','in_review','done','cancelled')`  
`priority text not null default 'none' check in ('none','low','medium','high','urgent')`  
`due_date date null`  
`created_by uuid not null → users`  
`version int not null default 1`  
`created_at` `updated_at`  
索引：`(project_id, status)`、`(project_id, updated_at desc, id desc)`  
Gin 或 `lower(title)` btree 供 `q`（MVP：`title ilike` + btree `(project_id)` 可接受）

**task_assignees**  
`task_id uuid not null → tasks on delete cascade`  
`user_id uuid not null → users`  
PK `(task_id, user_id)`  
索引：`(user_id)`

**comments**  
`task_id uuid not null → tasks on delete cascade`  
`author_id uuid not null → users`  
`body text not null`  
`created_at` `updated_at`  
`deleted_at timestamptz null`  
索引：`(task_id, created_at)` where `deleted_at is null`

**attachments**  
`task_id uuid not null → tasks on delete cascade`  
`uploader_id uuid not null → users`  
`filename text not null`  
`mime_type text not null`  
`size_bytes int not null`  
`storage_key text not null unique`  
`created_at`  
索引：`(task_id)`

**activities**  
`workspace_id uuid not null → workspaces on delete cascade`  
`project_id uuid null → projects on delete set null`  
`task_id uuid null → tasks on delete set null`  
`actor_id uuid not null → users`  
`type text not null`  （见下）  
`payload jsonb not null default '{}'`  
`created_at`  
索引：`(workspace_id, created_at desc, id desc)` 作游标

**activity_outbox**（F21 must；issue「后台任务」边界）  
`activity_id uuid not null unique → activities on delete cascade`  
`status text not null check in ('pending','published','failed') default 'pending'`  
`attempts int not null default 0`  
`last_error text null`  
`created_at`  
`published_at timestamptz null`  
索引：`(status, created_at)` where `status = 'pending'`  
不变量：插入 `activities` 的同一 DB 事务必须插入对应 outbox 行；worker 不得在事务提交前 publish；`failed` 仅在 `attempts >= 5` 后写入，测试可注入 hub throw。

活动 `type` 枚举（关闭自由字符串）：  
`workspace.created` `member.added` `member.role_changed` `member.removed`  
`project.created` `project.updated` `project.archived`  
`task.created` `task.updated` `task.status_changed` `task.assignees_changed`  
`comment.created` `comment.deleted`  
`attachment.created` `attachment.deleted`

### 4.2 任务状态机

允许边（其余 422 `invalid_transition`）：

```
backlog      → todo | cancelled
todo         → backlog | in_progress | cancelled
in_progress  → todo | in_review | cancelled
in_review    → in_progress | done | cancelled
done         → todo          （should：仅 owner/admin；MVP 若未做 F22 则 done 为终态）
cancelled    → （无；owner 重开列为 could）
```

实现：`packages/shared` 导出 `canTransition(from, to, role): boolean`，API 与前端共用。禁止在 handler 里手写 if 链副本。

乐观锁：每次成功 PATCH/status 将 `version = version + 1`。请求带 `version` 或 `If-Match`；不匹配 → 409 `version_conflict`，body 含当前 task。

### 4.3 错误信封

```json
{ "error": { "code": "forbidden", "message": "Viewer cannot update tasks", "details": {} } }
```

| HTTP | code 例 |
| --- | --- |
| 401 | `unauthenticated` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `slug_conflict` `already_member` `version_conflict` `owner_transfer_required` |
| 413 | `payload_too_large` |
| 415 | `unsupported_media_type` |
| 422 | `validation` `invalid_transition` |
| 429 | `rate_limited` |

非成员访问他人 workspace **一律 404**（不 403），减少 IDOR 探测面。已是成员但角色不足 → 403。

### 4.4 API 清单

权限列：G=guest，V=viewer，M=member，A=admin，O=owner。R=已登录任意用户。

#### Auth

| Method | Path | 权限 | 输入 | 成功 | 错误 |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | G | `{email,password,displayName}` | 201 `{user}` + Set-Cookie | 409 email 占用；422 弱密码（≥10 字符） |
| POST | `/api/auth/login` | G | `{email,password}` | 200 `{user}` + Set-Cookie | 401；429 |
| POST | `/api/auth/logout` | R | — | 204 + Clear-Cookie | 401 |
| GET | `/api/auth/me` | R | — | 200 `{user}` | 401 |

Cookie：`workboard_session=<opaque>`；`HttpOnly; Path=/; SameSite=Lax; Secure`（生产）。Token 32 字节 CSPRNG，只存 sha256。

#### Workspaces & members

| Method | Path | 权限 | 输入 | 成功 | 错误 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/workspaces` | R | — | 200 `{items:[{workspace,role}]}` | 401 |
| POST | `/api/workspaces` | R | `{name,slug}` | 201 | 409 slug |
| GET | `/api/workspaces/:id` | V+ | — | 200 | 401/404 |
| PATCH | `/api/workspaces/:id` | A+ | `{name,slug?}` | 200 | 403/404/409 |
| DELETE | `/api/workspaces/:id` | O | — | 204 | 403/404 |
| GET | `/api/workspaces/:id/members` | V+ | — | 200 `{items}` | 401/404 |
| POST | `/api/workspaces/:id/members` | A+ | `{email,role}` role≠owner | 201 | 404 用户不存在（可统称 not_found）；409 already_member；422 role=owner |
| PATCH | `/api/workspaces/:id/members/:userId` | A+ | `{role}` | 200 | 403 改 owner；409 拆唯一 owner |
| DELETE | `/api/workspaces/:id/members/:userId` | A+ | — | 204 | 403 移除唯一 owner；O 可移除 A |

#### Projects

| Method | Path | 权限 | 输入 | 成功 | 错误 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/workspaces/:id/projects` | V+ | `?archived=0\|1` | 200 `{items}` | 401/404 |
| POST | `/api/workspaces/:id/projects` | A+ | `{name,slug,description?}` | 201 | 403 member 不可建；409 slug |
| GET | `/api/projects/:id` | V+ | — | 200 | 404 |
| PATCH | `/api/projects/:id` | A+ | `{name,slug,description}` | 200 | 403/404/409 |
| POST | `/api/projects/:id/archive` | A+ | — | 200 `{archivedAt}` | 403/404 |

#### Tasks

| Method | Path | 权限 | 输入 | 成功 | 错误 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/projects/:id/tasks` | V+ | `status,assignee,q,sort,page,pageSize` | 200 `{items,page,pageSize,total}` | 422 pageSize>100 |
| POST | `/api/projects/:id/tasks` | M+ | `{title,description?,status?,priority?,dueDate?,assigneeIds?}` | 201 `{task,version:1}` | 403 V；422 |
| GET | `/api/tasks/:id` | V+ | — | 200 含 assignees/commentsCount | 404 |
| PATCH | `/api/tasks/:id` | M+ | 字段子集 + `version` | 200 新 version | 409 version；403 V |
| POST | `/api/tasks/:id/status` | M+ | `{status,version}` | 200 | 422 非法边；409 |
| POST | `/api/projects/:id/tasks/bulk` | M+ | `{ids: uuid[], action, status?}` ids≤50 | **200** `{results:[{id,ok,error?}]}`（禁止 207） | 403 V 整单；422 整单（ids>50 / 非法 action）；单项 version 冲突放进 `results[].error=version_conflict` |

#### Comments / attachments / activities

| Method | Path | 权限 | 输入 | 成功 | 错误 |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/tasks/:id/comments` | V+ | — | 200 不含软删 body | 404 |
| POST | `/api/tasks/:id/comments` | M+ | `{body}` | 201 | 403 V；422 空 |
| PATCH | `/api/comments/:id` | 作者或 A+ | `{body}` | 200 | 403/404 |
| DELETE | `/api/comments/:id` | 作者或 A+ | — | 204 软删 | 403/404 |
| POST | `/api/tasks/:id/attachments` | M+ | multipart `file` | 201 `{id,filename,mime,size}` | 413/415/403 |
| GET | `/api/attachments/:id` | V+ | — | 200 stream + `Content-Disposition` | 404 |
| DELETE | `/api/attachments/:id` | 上传者或 A+ | — | 204 | 403/404 |
| GET | `/api/workspaces/:id/activities` | V+ | `cursor,limit` | 200 `{items,nextCursor}` | 404 |
| GET | `/api/workspaces/:id/activities/stream` | V+ | SSE；`Last-Event-ID` | `id:` + `data: json` | 401/404 |

附件 MIME allowlist（默认）：`image/png` `image/jpeg` `image/webp` `application/pdf` `text/plain`。其它 415。大小默认 10×1024×1024。

### 4.5 Must 页面 ↔ API 覆盖（无缺口）

见 §5.4。每个写操作均有权限与 401/403/404/409/422 语义，见上表。

---

## 5. 前端信息架构

### 5.1 路由表

| 路由 | 页面 | 守卫 | 主实体 |
| --- | --- | --- | --- |
| `/login` | 登录 | guest；已登录跳 `/w` | user |
| `/register` | 注册 | guest | user |
| `/w` | Workspace 列表 | R | workspace |
| `/w/[workspaceId]` | Project 列表 | V+ | project |
| `/w/[workspaceId]/settings` | 成员与 slug | A+ 可写；V 只读 | member |
| `/w/[workspaceId]/activity` | 活动时间线 | V+ | activity |
| `/w/[workspaceId]/p/[projectId]` | Task 列表 | V+ | task |
| `/w/[workspaceId]/p/[projectId]/tasks/new` | 创建表单 | M+；V → forbidden 态 | task |
| `/w/[workspaceId]/p/[projectId]/tasks/[taskId]` | 详情：status、assignee、comment、附件 | V+ 只读 / M+ 可写 | task, comment, attachment |

404：未知 id。forbidden：角色不足但仍是成员。loading：Query `isPending`。empty：`items.length===0` 且非 loading。

### 5.2 Feature folder 边界

```
apps/web/src/
  app/                          # 仅路由壳与 layouts
  features/
    auth/                       # login-form, session query, guards
    workspaces/
    projects/
    tasks/                      # list, filters, status-chip, optimistic mutation
    comments/
    attachments/
    activity/                   # SSE hook + timeline
  shared/
    ui/                         # Button Input Dialog Table Banner
    query/                      # QueryClient, keys factory
    api/                        # fetch wrapper, error parse
```

页面文件只组合 feature 导出，不直接写 fetch。Query keys：`['tasks', projectId, filters]`、`['task', id]` 等集中在 `features/*/queries.ts`。

### 5.3 状态策略

- **Server state**：TanStack Query。mutations 的 `onMutate` / `onError` / `onSettled` 处理乐观更新。
- **Optimistic 范围（must）**：task status chip、task title 行内编辑。附件上传不乐观（等 201）。
- **Rollback**：onError 恢复 snapshot；409 额外 `invalidateQueries` 并展示冲突 Banner（`data-testid="conflict-banner"`）。
- **交互 state**：筛选输入、对话框开闭、选中行，留在组件 `useState`。
- **SSE**：`useActivityStream(workspaceId)` 用 `EventSource`；收到事件后 `queryClient.invalidateQueries` 对应 key。禁止在 `useEffect` 里手写轮询作为主路径（回退见 F20）。
- **禁止**：全局 store 镜像 task 列表；`useEffect` 拉任务列表。

四态组件约定：每个 feature 列表导出 `ListView`，内部切换：

- `isPending` → `<LoadingState />`
- `isError` → `<ErrorState retry />`
- `isForbidden`（403）→ `<ForbiddenState />`
- `items.length===0` → `<EmptyState />`
- 否则表格/时间线

### 5.4 路由 ↔ API ↔ 实体映射

| 路由 | API | 实体 |
| --- | --- | --- |
| `/login` `/register` | `POST /auth/login\|register` `POST /auth/logout` `GET /auth/me` | users, sessions |
| `/w` | `GET/POST /workspaces` | workspaces, workspace_members |
| `/w/:id` | `GET /workspaces/:id` `GET/POST /workspaces/:id/projects` | projects |
| `/w/:id/settings` | members CRUD、`PATCH /workspaces/:id` | workspace_members |
| `/w/:id/activity` | `GET .../activities` + SSE stream | activities |
| `/w/:id/p/:pid` | `GET/POST .../tasks` `POST .../tasks/bulk` | tasks, task_assignees |
| `.../tasks/new` | `POST /projects/:id/tasks` | tasks |
| `.../tasks/:tid` | `GET/PATCH /tasks/:id` `POST .../status` comments* attachments* | tasks, comments, attachments |

无孤立页面、无无主 API。

---

## 6. 质量与非功能（NFR 勾选清单）

实现阶段结束时，下列每一项必须能勾选（可观察）。

### 6.1 安全

- [ ] 密码 argon2id（memoryCost 与时间成本写入配置常量，测试用较低成本）。明文永不落库、不进日志。
- [ ] Session token CSPRNG，只存 hash；cookie HttpOnly + SameSite=Lax；生产 Secure。
- [ ] 写操作校验 `Origin` 与 `Host` 同源（同站 `/api` 代理下应通过）；跨站 Origin 失败 403 `csrf`，与 RBAC 的 403 `forbidden` 分 code。
- [ ] 所有写操作走 RBAC；集成测试覆盖 viewer PATCH 403 与非成员 404。
- [ ] 附件 MIME allowlist + 10MB；存储 key 为 uuid，不使用用户文件名当路径。
- [ ] 下载 `Content-Disposition: attachment`；禁止把用户 HTML 当 `text/html` 内联。
- [ ] 无 `eval` / `new Function` / `dangerouslySetInnerHTML` 于产品路径（lint 亦拦）。
- [ ] 登录失败不计泄露「邮箱是否存在」；统一 401。
- [ ] SQL 只通过 Drizzle 参数化；禁止字符串拼接 SQL（测试 + review，不算 lint 分子）。

### 6.2 错误处理

- [ ] API 全部走 §4.3 信封；未捕获异常 500 + `internal`，不回堆栈给客户端。
- [ ] 前端解析 `error.code` 映射 Banner；网络断开有独立 copy。
- [ ] 409 必须可恢复（重新加载），禁止 `window.alert`。

### 6.3 日志

- [ ] 每请求 `x-request-id`（或生成 uuid）写入结构化 JSON 日志：`{level,requestId,method,path,status,ms,userId?}`。
- [ ] 不记录 password、cookie、附件二进制。
- [ ] API 开发preset 禁 `console`（strict）；用 logger 封装。

### 6.4 无障碍

- [ ] 主流程键盘可达（F17）；焦点可见。
- [ ] 表单控件有 label（`htmlFor` 或 wrap）。
- [ ] 错误用 `role="alert"`。
- [ ] 状态 chip 不只靠颜色（同时有文字）。
- [ ] Dialog 有 `role="dialog"` 与 Esc 关闭。
- [ ] 不要求 WCAG 完整审计；e2e 覆盖 Tab 登录+创建 task 即可。

### 6.5 性能

- [ ] 列表默认 pageSize=20，max=100。
- [ ] 虚拟化 = could，MVP 不做。
- [ ] SSE 单连接/workspace；切 workspace 关闭旧 EventSource。
- [ ] Next 生产 `next build` 在 CI 通过。
- [ ] typed lint 不进 keystroke 路径；开发默认 fast lint。

### 6.6 隐私

- [ ] 备份/日志不含密码哈希以外的凭据。
- [ ] 活动 payload 不存 comment 全文超 2KB；可只存 id+excerpt。
- [ ] 无第三方分析脚本（benchmark 纯度）。

---

## 7. 测试金字塔

分层原则：能用单元证明的不写集成；能用集成证明的不把 RBAC 只放 e2e。Benchmark 任务的「基线测试」引用下列用例名。

### 7.1 单元（domain / RBAC）— `packages/shared` + `apps/api` 纯函数

| 用例名 | 保护的结果 |
| --- | --- |
| `canTransition rejects done → in_progress` | 非法边不可过 |
| `canTransition allows in_review → done for member` | 合法边可过 |
| `canTransition done → todo only for admin+ when F22 on` | 重开策略 |
| `authorize(viewer, 'task.update') === deny` | viewer 只读 |
| `authorize(member, 'project.create') === deny` | member 不能建项目 |
| `authorize(admin, 'workspace.delete') === deny` | admin 不能删 workspace |
| `password policy rejects 9-char` | 注册 422 |
| `activity type enum rejects unknown string` | payload 收口 |

最少落地前 3+3 条（状态机 3 + RBAC 3）。

### 7.2 集成（API + 真实 Postgres）

| 用例名 | 保护的结果 |
| --- | --- |
| `POST /auth/login sets HttpOnly cookie` | session 契约 |
| `viewer PATCH /tasks/:id → 403 forbidden` | RBAC 在传输层 |
| `non-member GET /workspaces/:id → 404` | 防探测 |
| `POST /tasks then GET list filter status` | CRUD+筛选 |
| `concurrent PATCH with stale version → 409` | 乐观锁 |
| `illegal status transition → 422 invalid_transition` | 状态机 |
| `duplicate project slug → 409` | 唯一约束 |
| `multipart rejects 11MB and text/html` | 附件门禁 |
| `write task inserts activity in same transaction` | 回滚则无活动且无 outbox 行 |
| `outbox stays pending when hub throws; worker replay publishes` | F21 后台 drain |
| `SSE receives task.status_changed after POST /status` | 活动流 |

测试用 compose/testcontainers Postgres；禁止 sqlite「差不多」。

### 7.3 组件（Testing Library）

| 用例名 | 保护的结果 |
| --- | --- |
| `TaskStatusChip optimistic: shows in_progress before server` | F11 |
| `TaskStatusChip rolls back on 500` | rollback |
| `TaskStatusChip shows conflict-banner on 409` | J4 |
| `TaskList empty/loading/error/forbidden four states` | F16 |
| `CommentForm submit disabled for viewer` | J5 |
| `FilterBar calls query with status=todo` | F09 |

### 7.4 E2E（Playwright，关键路径）

| 用例名 | 保护的结果 |
| --- | --- |
| `register → create workspace → invite member` | J1 |
| `create project and three tasks; filter in_progress` | J2 |
| `change status, comment, upload png; activity lists events` | J3 |
| `viewer cannot submit task edit in UI and API 403` | J5 |
| `keyboard: tab through login and create-task` | F17 |
| `unauthenticated /w redirects to /login` | F03 |

CI：unit+integration 每 PR；e2e 在 `main` 与 nightly。Benchmark 任务失败判定看该任务 allowlist 内的基线测试，不默认跑全量 e2e（耗时会污染 wall time 对比）。

---

## 8. Benchmark 方法论（核心）

后来者应能不经讨论直接建 `benchmarks/` 脚手架。本章即规格。

### 8.1 控制变量

每次 cell×task run 必须记录并固定：

| 变量 | 固定方式 |
| --- | --- |
| git baseline | 实验开始时 `BASELINE_SHA`；每个 task 从该 SHA + 工作树干净状态 checkout。任务结束 `git reset --hard BASELINE_SHA && git clean -fd`（报告已写盘后） |
| 任务 prompt | `benchmarks/tasks/Txx/prompt.md` 只读；harness 把文件原文送模型，禁止运行时拼接额外「请通过 lint」以外的系统附加（系统附加必须版本化在 `harness/system.md`） |
| 模型 / 参数 | `run.json` 模板：`provider, model, temperature, top_p, max_tokens, seed(if any), date`。一次矩阵战役用同一组；换模型算另一战役 |
| 依赖 | `pnpm-lock.yaml` frozen；CI `pnpm install --frozen-lockfile` |
| DB | `pnpm db:reset && pnpm db:seed`，seed 使用固定 UUID（写在 `packages/db/seed.ts`） |
| Node / pnpm | `.nvmrc`=`22.13.0`（或 CI `node-version: 22.13.0`）；`packageManager` 字段 |
| Runner | 干净 GitHub-hosted 或等价容器；禁止本地脏 `node_modules` 混入战役结果 |
| Formatter | 所有 cell 先 `pnpm format`（Biome format only）；**比较的是 lint 不是 format** |
| 业务源码 | cell 切换只覆盖 `packages/lint-cells/<cell>/` 与根部 eslint/biome/oxlint 入口，不改 `apps/**` |

`none` cell：不跑任何 linter；仍跑 format、`tsc --noEmit`、任务基线测试。这是对照基线，用来测量「无 lint 时模型自己的缺陷率」。

### 8.2 配置矩阵与能力缺口

最低 7 格 + 扩展 2 格：

| Cell ID | 工具层 | 包装方式 | 已知缺口（必须写进报告 `capability_gaps`） |
| --- | --- | --- | --- |
| `none` | 无 linter | 空配置 | 不捕获任何 lint 层缺陷 |
| `eslint-base` | `base` | `export { base }` | 无 typed Promise / 无 `no-unsafe-*` / 无 Hooks |
| `eslint-strict` | `strict` | `export { strict }` | 有 `no-explicit-any` 与非空断言、复杂度；**仍无** floating Promise 与 `no-unsafe-*` |
| `eslint-typeAware+react` | `react`（已含 typeAware） | `export { react }` | 参考实现；`ignoreVoid: false`，`void promise` 不可消音 |
| `biome-base` | `base` | extends `.../base` | recommended 语法层；无 Promise typed |
| `biome-strict` | `strict` | extends `.../strict` | 有 `noExplicitAny`、`noNonNullAssertion`、security `noDangerouslySetInnerHtml`；**无**完整 `no-unsafe-*` |
| `biome-type-aware+react` | **组合** type-aware + react | 见下 | Biome typed ≈ TS 子集；官方对 `noFloatingPromises` 约覆盖 tseslint 案例 **75%**，且与 `noMisusedPromises` 同属 **nursery**。Biome `react.jsonc` **只 extends strict，不含 type-aware**——矩阵格必须由 harness **显式组合**两个文件（domains.types + domains.react + nursery Promise 规则），不能只 `extends react` |
| `oxlint-base` | `base` | 包装 + 不设 typeAware | **与 ESLint 非完全等价**；options/规则实现需逐条验证 |
| `oxlint-typeAware+react` | `react` | `extends: [react]` 且 **`options.typeAware: true`** + 依赖 `oxlint-tsgolint` | typed 规则由 tsgolint 提供，不能靠 npm 包静默打开；JSON `extends` 不解析包名，必须 `oxlint.config.ts` import 对象。同名规则 ≠ 同 option |

Biome 组合配置（harness 提供，不算改「被测 preset 源码」）：

```jsonc
{
  "extends": ["@vibe-coding-preset/biome-config/type-aware"],
  "linter": {
    "domains": { "types": "recommended", "react": "recommended" },
    "rules": {
      "correctness": { "useExhaustiveDependencies": "error", "useHookAtTopLevel": "error" },
      "nursery": { "noFloatingPromises": "error", "noMisusedPromises": "error" }
    }
  }
}
```

比较纪律：

- 不得因为缺口去「补齐」Biome/Oxlint 规则来强行对齐 ESLint。缺口记 FN 或 `gap`，不是工具失败。
- Oxlint 扩展列在汇总表单独成组，不并入 ESLint vs Biome 主结论，除非该条缺陷已由 fixtures 验证两边都抓。
- 开发宿主自身可用一套「工程卫生」lint；**战役过程中 agent 看到的只有该 cell 的配置**。

### 8.3 任务语料（T01–T16）

每个任务目录：

```
benchmarks/tasks/Txx/
  prompt.md          # 给模型的唯一任务说明
  allowlist.txt      # git diff 允许路径 glob，一行一个
  denylist.txt       # 即使 allow 也禁止（lint config、lockfile、tests 删除）
  baseline.test.ts   # 完成后必须绿的测试（或指向仓库已有用例名）
  done.md            # 可观察完成定义（给人看，也给 harness 断言脚本）
```

禁止改动（全局 denylist，所有任务继承）：

- `packages/lint-cells/**`
- `eslint.config.*` `biome.json*` `oxlint.config.*`
- `**/tsconfig*.json`（除非任务明确是 tsconfig 任务——本语料没有）
- `.gitignore` ignore 文件、baseline suppressions
- `pnpm-lock.yaml` `package.json` 依赖段（除非任务是加依赖——本语料没有）
- 删除任何已有 `*.test.*` / `e2e/**`
- `benchmarks/harness/**`

覆盖类型：新功能、bugfix、refactor、async/Promise、React 状态/Hooks、API/DB、安全、可维护性。

---

**T01 新功能：任务到期日筛选**  
提示词摘要：在项目任务列表增加 `due=overdue|today|week|none` 筛选，后端用 `due_date` 计算，前端 FilterBar 增加控件。  
允许：`apps/api/**/tasks*` `packages/db/**` `apps/web/src/features/tasks/**` `packages/shared/**`  
禁止：全局 denylist。  
基线测试：`GET /tasks?due=overdue` 只返回 `due_date < today && status not in done,cancelled`；组件 `FilterBar` 发出 `due=today`。  
完成：API 集成绿 + 列表 URL 与 query 同步 + viewer 可用该筛选。

**T02 新功能：批量指派**  
提示词摘要：实现 `POST /projects/:id/tasks/bulk` action=`assign`，body `{ids, assigneeIds}`；UI 多选后出现「Assign」对话框。  
允许：tasks API、task_assignees、tasks feature、e2e 可追加不可删旧。  
基线：viewer 403；ids>50 422；成功后活动 `task.assignees_changed`。  
完成：集成 + 组件多选路径绿。

**T03 Bugfix：状态变更里的 floating Promise**  
提示词摘要：`TaskStatusChip` 的 onChange 调用了 `mutateAsync` 却未 await/void 处理被禁；生产日志显示未处理 rejection。请修复该 bug，保持乐观更新语义。  
允许：`apps/web/src/features/tasks/**`  
基线：组件测试 rollback；typed cell 对修复后文件跑 lint 应不再报 `no-floating-promises`（none cell 只看测试）。  
完成：测试绿；不得用 `void` 消音（ESLint cell `ignoreVoid:false`）；正确修复是 await + try/catch 或 mutation 的 `mutate` 回调。

**T04 Bugfix：条件 Hooks**  
提示词摘要：`TaskList` 在 `if (!projectId) return null` 之后才调用 `useTasksQuery`，React 报 Hooks 顺序。把 Hooks 提到顶层并保留 empty 态。  
允许：`apps/web/src/features/tasks/**`  
基线：组件测试四态；react 层 lint 不再报 `rules-of-hooks` / `useHookAtTopLevel`。  
完成：不得禁用规则。

**T05 Refactor：抽出 RBAC 策略模块**  
提示词摘要：`apps/api` 里多处 if role 重复。抽到 `packages/shared` 的 `authorize(role, action)`，handler 只调它。行为不变。  
允许：`packages/shared/**` `apps/api/**`（非路由 URL 变更）  
禁止：改权限矩阵语义。  
基线：既有 RBAC 集成全绿；单测 `authorize(*)` 新增。  
完成：handler 中不再出现字符串 `'viewer'` 与动作的散落比较（harness 可用 rg 计数阈值）。

**T06 Async：SSE 断线续传**  
提示词摘要：实现 `Last-Event-ID`：客户端重连后补上漏掉的 activities，然后继续 stream。  
允许：`apps/api/**/activities*` `apps/web/src/features/activity/**`  
基线：集成测试先 insert 两条活动，stream 从第一条 id 续，应再收到第二条。  
完成：不得改用 WebSocket。

**T07 React：乐观 status + 409 rollback**  
提示词摘要：完成 F11/J4：chip 乐观更新；服务器 409 时回滚并显示 `conflict-banner`。  
允许：tasks feature、可选 shared ui Banner  
基线：§7.3 三条 StatusChip 测试。  
完成：data-testid 存在；409 不自动 PATCH 第二次。

**T08 API/DB：评论分页游标**  
提示词摘要：`GET /tasks/:id/comments?cursor&limit`，按 `created_at,id` 稳定游标；默认 20。  
允许：comments 路由、db、web comments feature  
基线：插入 25 条，第一页 20，第二页 5，cursor 不回绕；软删不出现。  
完成：无 OFFSET 分页。

**T09 安全：防止 IDOR**  
提示词摘要：有报告称只要猜到 task uuid，其它 workspace 的 member 也能 PATCH。补授权：task 必须属于调用者所在 workspace。写回归测试。  
允许：api task 中间件/repo、新测试  
禁止：靠「隐藏 uuid」；禁止去掉测试；**禁止在测试里创建第二 workspace**（必须用 F18 seed 的 `beta`）。  
基线：以 Ben 登录（alpha 的 member、beta 的非成员），`PATCH /api/tasks/:betaTaskId` → **404** `not_found`（不是 403）。Ada 对同一 id PATCH 200。  
完成：**此任务的 lint 捕获率不计入安全正确性**；判定只看测试。若模型只加 lint disable 或 `as any`，cheat 扫描仍可失败。

**T10 可维护性：拆分胖 TaskService**  
提示词摘要：`task-service.ts` 超过认知复杂度阈值。拆成 `create` `update` `transition` `list` 四个函数文件，不改 HTTP 契约。  
允许：`apps/api/src/**/tasks/**`  
基线：既有 task 集成绿；strict cell 对拆后文件 `complexity`/`noExcessiveCognitiveComplexity` 不再超标。  
完成：禁止把逻辑藏进 `_` 空函数骗复杂度。

**T11 Async：附件上传错误态**  
提示词摘要：上传中显示 progress；413/415 映射到 `role=alert` 错误；成功后插入列表。不要乐观插入。  
允许：attachments feature、api 已存在则只改 web  
基线：组件测试 415；e2e 可选。  
完成：失败时列表 count 不变。

**T12 React：搜索 debounce 与四态**  
提示词摘要：FilterBar 的 q 输入 300ms debounce，空/loading/error/forbidden 四态齐。  
允许：tasks feature  
基线：§7.3 TaskList 四态；debounce 测试 fake timer。  
完成：每次按键不得直接打 API（可用 spy 断言）。

**T13 Bugfix：活动 payload 的 `any` 传播**  
提示词摘要：`JSON.parse` 结果被标 `any` 并 `.foo` 调用。改为 `unknown` + zod `ActivityPayload`。  
允许：activity 相关 api/web/shared  
基线：zod 解析失败记日志并跳过该事件；typed ESLint 不再 `no-unsafe-*` / `no-explicit-any`。  
完成：Biome cell 可能只抓 `noExplicitAny` 不抓 unsafe member——报告记 gap，不算 Biome 失败。

**T14 API：并发 409**  
提示词摘要：给 PATCH 加上 version 校验（若尚未有）并写集成测试双连接 stale version。  
允许：tasks repo/service、测试  
基线：`concurrent PATCH with stale version → 409`。  
完成：无 version 字段的 PATCH 422，不是静默成功。

**T15 安全：附件 MIME allowlist**  
提示词摘要：拒绝 `text/html` `application/javascript`；下载强制 attachment disposition。测试覆盖。  
允许：attachments api、storage、测试  
基线：§7.2 multipart rejects。  
完成：安全层测试；lint 不是主指标。

**T16 Refactor：降低嵌套回调**  
提示词摘要：某 list handler 四层回调触发 `max-nested-callbacks` / cognitive complexity。改为 early return + async/await。  
允许：指定一个 api 文件（落地时写死路径，如 `apps/api/src/routes/tasks-list.ts`）  
基线：list 集成绿；strict lint 通过该文件。  
完成：禁止 eslint-disable complexity。

战役默认跑 T01–T16 全集。烟雾可跑 `{T03,T04,T07,T09,T13}`。

### 8.4 缺陷注入目录（D01–D20）

注入方式：`benchmarks/defects/catalog.json` + 可选 `inject/` 补丁。用于 **静态评估 preset 检出能力**（不经模型）以及 **任务结束后扫描 FN**。语义扩展现有 fixtures（floating Promise、`any`、条件 Hooks），不另起分类。

| id | code_pattern | file_area | expected_catch_layer | which_presets_should_catch |
| --- | --- | --- | --- | --- |
| D01 | 调用返回 `Promise` 的函数且未 await/return（与 `tests/fixtures/invalid.ts` 同构） | `apps/web/src/features/tasks` 或 `apps/api` 服务 | lint-rule | ETR、BTR（nursery，允许 FN）、OTR（需 typeAware:true）。EB/ES/BB/BS/OB：**不要求** |
| D02 | `onClick={asyncHandler}` 或 `if (load())` 把 Promise 当 void/boolean（misused promises） | tasks UI | lint-rule | ETR、BTR（nursery）、OTR。其余不要求 |
| D03 | `const x: any = JSON.parse(...)`（与 fixture `leaked: any` 同构） | activity payload 解析 | lint-rule | ES、ETR、BS、BTR、OTR（strict+）。base/none 不要求 |
| D04 | `JSON.parse` 无标注，结果传入 typed 函数（unsafe assignment/call/member） | activity / attachment meta | lint-rule | **仅 ETR 强要求**；OTR 需逐条验证 tsgolint；BTR **记 gap**（无完整 no-unsafe-* 对齐） |
| D05 | `if (cond) useFoo()`（与 `react-invalid.tsx` 同构） | TaskList/Greeting 类组件 | lint-rule | ETR、BTR、OTR 的 react 层。base/strict/none 不要求 |
| D06 | `useEffect(() => { void fetch(id) }, [])` 缺 `id` | task detail | lint-rule | ETR/BTR/OTR react。修复不得机械填入不稳定函数（research：可能 effect loop）→ 正确性仍要 **test** |
| D07 | 未使用变量 / 半成品函数 | 任意 apps | lint-rule | BB+/ES+（Biome base recommended 含 unused；ESLint TS recommended）。none 不要求 |
| D08 | `eval(userString)` / `new Function` | 禁止出现于产品路径；可放 inject 样本 | lint-rule | 所有非 none 的 base+（`no-eval` / security） |
| D09 | `value!` 非空断言 | API 响应解包 | lint-rule | ES、ETR、BS、BTR、OTR strict+ |
| D10 | `features/tasks` ↔ `features/activity` 循环 import | web features | lint-rule | ES（import-x/no-cycle）、BS（noImportCycles）、OTR/OB 若启用 import/no-cycle。cycle 昂贵，不进 keystroke，但进战役终局 |
| D11 | `void loadName()` 试图消音 floating promise | web/api async | lint-rule | ETR（ignoreVoid:false）**应仍报**；BTR/OTR **验证后填**；若工具放过，记 gap 而非 cheat |
| D12 | `dangerouslySetInnerHTML={{__html: comment.body}}` | comments UI | lint-rule | BS、BTR（security.noDangerouslySetInnerHtml）。ESLint 无对等规则则 **test + human-review**，不记 ESLint FN |
| D13 | 只校验登录、不校验 workspace 成员即 PATCH task（IDOR） | api tasks | **test** + human-review | **无 preset 应作为 lint 成功条件**。可辅 SAST |
| D14 | 字符串拼接 SQL / 未参数化 | api repo | **sast** + test + human-review | 非通用 linter 职责（research 行「凭据、注入」） |
| D15 | `const AWS_SECRET = "AKIA..."` 硬编码 | 任意 | **sast / secret scan** | 非 lint 分子 |
| D16 | 过深嵌套回调 / 超认知复杂度 | api list handler | lint-rule（代理指标） | ES、ETR、BS、BTR、对应 oxlint。允许有理由的局部例外，但战役默认禁止 disable |
| D17 | `db.transaction(async tx => { update(); insertActivity() })` 内未 await 其中一个 | api service | lint-rule + **test**（事务回滚） | D01 同类；测试证明数据一致性，lint 只抓漏 await |
| D18 | `switch (task.status)` 漏 `cancelled` 且无 default | shared 状态机或 UI | lint-rule | ETR、OTR `switch-exhaustiveness-check`；Biome 若无对等记 gap；**tsc** 在 union+never 时也可抓 |
| D19 | 文件级 `eslint-disable` 或 `biome-ignore-all` 无理由 | 任意 | lint-rule（suppression governance） | EB+（eslint-comments/no-unlimited-disable、require-description）；Biome unused/all 由 harness 正则扫描全 cell |
| D20 | 过期 `eslint-disable`（规则已不触发） | 任意 | lint-rule | EB+ `reportUnusedDisableDirectives`；Biome unused suppression。none：harness 仍扫 disable 作为 cheat |

`expected_catch_layer` 枚举只许：`lint-rule` | `tsc` | `test` | `sast` | `human-review`。可多值，但 **lint 捕获率只统计 layer 含 lint-rule 的条目**。

静态战役：把 D01–D12、D16–D20 的最小样本注入工作树（不经 LLM），对 9 cell 跑 lint，生成 `capture_matrix.json`。这是 preset 能力表，与 Txx 模型实验分开报告。

### 8.5 指标

每个 cell×task 一行。分母/分子必须可脚本化。

| 指标 | 定义 | 备注 |
| --- | --- | --- |
| `lint_tp` / `lint_fn` / `lint_fp` | 对照缺陷目录与人工 gold（任务结束 diff 中仍存在的 Dxx 模式） | FP：诊断指向无缺陷行。金标在 `tasks/Txx/gold.json`（可选；无金标则只算「终局 lint error 数」不称 TP） |
| `lint_capture_rate` | `tp / (tp+fn)` 仅 `expected_catch_layer` 含 lint-rule | 缺口格的预期 FN 不进分母（`in_scope_for_cell=false`） |
| `false_positive_rate` | `fp / (fp+tp)` | 无 gold 时留空，不填 0 |
| `autofix_safe_success` | 跑工具官方 safe fix 后，测试仍绿且 diff 符合 allowlist 的比例 | 只允许 formatter + 规则声明的 safe fix |
| `autofix_unsafe_invoked` | 是否跑了 unsafe fix（删除 import、加 await、改 hook deps） | 一旦 invoked，需 `unsafe_reviewed=true` 否则记流程违规（不是 cheat，是 harness 配置错误） |
| `fix_iterations` | 模型看到诊断后的修改轮次 | 上限 3；连续 2 轮 error 集合不缩小则停（对齐 research 闭环） |
| `bypass_count` | disable 注释、新增 ignore、新增 `any`、非空断言、`as unknown as`、删测试、改 lint config | >0 且无 allow 则 `cheat=true` |
| `wall_time_ms` | harness 墙钟，含模型+lint+test | 分 `model_ms` `lint_ms` `test_ms` |
| `final_test_pass` | 基线测试 exit 0 | false 则任务失败，无论 lint 干净 |
| `diff_loc` | `git diff --numstat` 加+删 | 过大只作观察，不单独判失败 |
| `review_minutes_est` | `0.5 + 0.02*diff_loc + 2*bypass_count + 3*unsafe_fix` | 启发式，报告标明 heuristic |
| `tsc_pass` | `tsc --noEmit` | 与 lint 分开 |
| `cheat` | bool | true → 该 cell-task **失败**，仍保留其它指标供分析 |

**禁止**：把 D13–D15 的通过算进 `lint_capture_rate`。它们走 `test_pass` / `sast_pass` / `review_flag`。

### 8.6 结果报告格式

**JSON Lines**：`benchmarks/reports/<campaignId>.jsonl`，每行一个对象：

```json
{
  "campaign_id": "2026-08-22-gpt-x",
  "baseline_sha": "...",
  "preset_sha": "...",
  "node": "22.13.0",
  "pnpm": "11.22.0",
  "model": {"provider":"","name":"","temperature":0,"max_tokens":0},
  "cell": "eslint-typeAware+react",
  "task": "T03",
  "cheat": false,
  "cheat_reasons": [],
  "capability_gaps": [],
  "lint_tp": 0, "lint_fn": 0, "lint_fp": 0,
  "lint_capture_rate": null,
  "in_scope_defect_ids": ["D01"],
  "autofix_safe_success": true,
  "autofix_unsafe_invoked": false,
  "fix_iterations": 1,
  "bypass_count": 0,
  "wall_time_ms": 0, "model_ms": 0, "lint_ms": 0, "test_ms": 0,
  "final_test_pass": true,
  "tsc_pass": true,
  "diff_loc_added": 0, "diff_loc_deleted": 0,
  "review_minutes_est": 0,
  "diagnostics": [{"tool":"eslint","rule":"@typescript-eslint/no-floating-promises","file":"","line":0}],
  "ended_at": "RFC3339"
}
```

**Markdown 汇总模板**（由 JSONL 生成，字段固定）：

1. 战役头：baseline / preset SHA / 模型 / Node。
2. 主表：行=任务，列=cell，格内 `test / lint_in_scope / cheat / iters / loc`。
3. 缺口表：Biome/Oxlint 对 D01/D04/D11/D18 的 FN 标 `gap` 而非 `fail`。
4. 分层表：lint vs tsc vs test vs sast vs review 各解决哪些 Dxx。
5. 作弊清单：`cheat=true` 的 cell-task 与 reasons。
6. 附录：命令 `pnpm bench:report --in reports/x.jsonl --out reports/x.md`。

### 8.7 防作弊

Harneess `checkCheat({baseline, allowlist})` 在模型结束后、记分前运行：

1. `git diff --name-only` 必须 ⊆ allowlist，且 ∩ 全局 denylist = ∅。违规 → `cheat=true` reason=`path`。
2. diff 中新增匹配：`eslint-disable`、`biome-ignore`、`oxlint-disable`、`biome-ignore-all`。默认零容忍。reason=`suppression`。
3. 相对 baseline，**增量** `/: any\b/`、`as any`、`as unknown as`、`!` 非空断言（简单正则 + 排除测试文件）。reason=`escape_hatch`。
4. 删除 `**/*.{test,spec}.*` 或清空测试 → `cheat=true` reason=`deleted_test`。
5. 修改 lockfile / engines / CI 权限 → `cheat=true` reason=`supply_chain`。
6. unused disable：对该 cell 跑 linter 的 unused-directive 模式；命中 → cheat（或 lint fail，两者都记）。
7. `none` cell 仍执行 1、3、4、5（无 lint 不是无纪律）。

Agent 系统附加（版本化，所有任务相同）：

```
编辑后运行 pnpm format，再对 changed files 运行本 cell 的 fast lint。
不得新增 disable、ignore、any、非空断言或修改 lint 配置来通过检查。
交付前运行本 cell 的 lint（若有）、tsc、任务基线测试。unsafe fixes 必须审阅，本 harness 默认不启用 unsafe。
```

与 `docs/presets.md` Agent contract 对齐。

### 8.8 分层责任（禁止把一切算给 linter）

| 问题类 | 负责层 | 不负责 |
| --- | --- | --- |
| 漏 await、Promise 当条件、显式 any、条件 Hooks、eval、unused、复杂度、宽泛 disable | linter（按 cell 能力） | 测试可作回归锁，但战役主指标是 lint |
| 类型不成立、未穷尽 union（`never` 写法） | tsc（所有 cell 都跑） | 不能因 tsc 已抓就认为 lint 失败 |
| 状态机非法边、RBAC、IDOR、409、MIME、筛选语义 | **测试** | linter |
| SQL 注入、密钥、依赖 CVE | SAST / secret scan / SCA | 通用 ESLint/Biome/Oxlint |
| 产品是否好用、文案、a11y 细项、hook deps 的「正确数据流」 | human-review | 机械补 `exhaustive-deps` 可能制造 loop |
| format 漂移 | Biome format（全矩阵） | 不进 lint 对比 |

Research 原句落实：诊断数量下降 ≠ 语义正确；必须同时跑测试。CI 对确定性规则只接受 error、零 warning；本宿主开发分支遵循；战役 cell 按其 preset 的 error 集。

### 8.9 Harness 命令（脚手架规格，本 issue 不实现）

```
pnpm db:reset && pnpm db:seed
pnpm bench --cell eslint-typeAware+react --task T03
pnpm bench --campaign campaigns/default.json    # 9×16，可拆 matrix
pnpm bench:static-defects                       # Dxx 注入，无 LLM
pnpm bench:report --in reports/x.jsonl --out reports/x.md
```

退出码：cheat 或基线测试失败 → 非零。gap FN → 零（报告内标记）。

---

## 9. 分阶段实施计划

关键路径 MVP = 阶段 1–4 + 阶段 6 的最小 harness（能跑 1 cell × 1 task + cheat 检查）。阶段 5 可与阶段 6 最小集并行。

完成条件禁止「完善」「搞定」；下列均为可观察输出。

### 阶段 ① Monorepo / 脚手架 / CI

- **目标**：空应用可在干净机上 install、format、typecheck、起 Postgres。
- **输入**：本计划 §3；Node 22.13；pnpm 11.22。
- **工作**：建独立仓库目录树；workspace packages 空壳；`docker-compose.yml`（Postgres 16）；`biome.format.jsonc`；CI `pnpm install --frozen-lockfile && pnpm format:check && pnpm typecheck`；`engines` 与 preset 对齐。
- **输出**：仓库 SHA；compose 健康检查通过；CI 绿。
- **验证**：`docker compose up -d && pnpm install && pnpm format:check && pnpm typecheck` 退出 0；`node -v` 打印 22.x。
- **完成条件**：`apps/web` 能 `next build` 打出 Hello；`apps/api` `GET /health` 返回 200 `{ok:true}`；web 不依赖 db 包（grep 零命中）。

### 阶段 ② Auth + RBAC + DB

- **目标**：用户可注册登录；RBAC 纯函数 + session 中间件可用。
- **输入**：阶段 ①；§4 users/sessions/workspace_members。
- **工作**：Drizzle schema+首迁；argon2id；cookie session；workspace 创建（创建者 owner）；`authorize`；集成测试 §7.2 前 3 条。
- **输出**：migration 文件；`pnpm db:seed` 产出 Ada/Ben/Cara 三用户（workspace 行可在本阶段写入 alpha/beta 骨架，project/task 在阶段 ③ 补齐）。
- **验证**：`pnpm --filter api test` 含 login cookie 与 viewer 403；`GET /api/auth/me` 无 cookie 401。
- **完成条件**：seed 用户能 login；错误密码 401；cookie HttpOnly 在集成测试断言头里可见。

### 阶段 ③ Project / Task CRUD

- **目标**：API 完成 F04–F10、F12、F14（活动与 outbox 同步写，暂无 SSE drain）。
- **输入**：阶段 ② 表结构扩展。
- **工作**：projects/tasks/comments schema；状态机；version 409；列表 OFFSET 筛选；bulk 锁定 200 `{results[]}`；活动 + outbox 同事务 insert。
- **输出**：OpenAPI 或 zod 路由表与 §4.4 一致。
- **验证**：§7.2 筛选、409、非法 transition、slug 409、活动同事务。
- **完成条件**：用 seed token curl 可建 project+task+comment；viewer PATCH 403；Ben PATCH beta task 404；stale version 409 body 含 `version_conflict`；bulk 部分失败响应 status=200 且 `results` 为数组。

### 阶段 ④ 前端列表 / 表单 / 乐观更新

- **目标**：J1–J5 除附件与 SSE 外可在浏览器走通。
- **输入**：阶段 ③ API。
- **工作**：路由表 §5.1；TanStack Query；四态；StatusChip 乐观+409 Banner；键盘登录+创建。
- **输出**：Playwright J1/J2/J4/J5（无附件）。
- **验证**：`pnpm --filter web test` 组件三条 StatusChip；`pnpm e2e` 指定文件。
- **完成条件**：data-testid `conflict-banner` `empty-state` `forbidden-state` 存在且 e2e 断言；viewer UI 无提交按钮。

### 阶段 ⑤ 附件 + 活动流 + 异步

- **目标**：F13、F15、F16 活动页、**F21 outbox worker**。
- **输入**：阶段 ③/④。
- **工作**：FsStorage；MIME/大小；进程内 outbox drain；SSE hub；Last-Event-ID；活动页。
- **输出**：集成 SSE 测试；outbox hub-throw 重放测试；上传 415/413 测试。
- **验证**：Playwright J3；SSE 测试收到 `task.status_changed`；注入 hub throw 后 outbox 仍 `pending`，worker 再跑变为 `published`。
- **完成条件**：磁盘出现 `storage_key` 文件；GET 下载 `Content-Disposition: attachment`；未登录 EventSource 401；`activity_outbox` 无长期 pending（测试结束时 seed 路径均为 `published`）。

### 阶段 ⑥ Benchmark harness + 语料 + 报告

- **目标**：矩阵可跑；防作弊可执行；报告可生成。
- **输入**：阶段 ① 仓库；preset SHA；§8。
- **工作**：`packages/lint-cells` 9 格；T01–T16 目录（prompt/allowlist/baseline）；`catalog.json` D01–D20；harness CLI；静态缺陷矩阵；JSONL+MD 报告。
- **输出**：`pnpm bench --cell none --task T03` 与 `--cell eslint-typeAware+react --task T03` 均可在无 LLM 的 `--dry-run` 模式走完 cheat+lint+test（dry-run 跳过模型，用预置 diff fixture）。
- **验证**：用预置「故意 disable」diff，`cheat=true` 且退出非零；预置合法 diff `cheat=false`。
- **完成条件**：9 格配置 `pnpm bench:cells-smoke` 能对 `tests` 级小文件调用对应工具；Biome 组合格含 nursery Promise **且** react hooks，而不是只 extends `react.jsonc`。

阶段 ⑥ 最小 MVP：cells-smoke + cheat 检测 + 1 个任务目录 + JSONL 一行写出。全集语料可在 MVP 之后补。

---

## 10. Issue breakdown（25 条）

规模：**7 个模块**（auth, workspace, project-task, web-ia, attach-sse, nfr-test, bench-harness）/ **25 issues** / **6 阶段**。

图例：顺序 S 从小到大；P 组内可并行；**CP** = 关键路径 MVP。

| # | 标题 | 阶段 | 顺序 | 并行组 | 依赖 | 职责边界 | 验收（可观察） | CP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I01 | 独立仓库脚手架与 pnpm workspace | 1 | 1 | — | — | 目录树、engines、format 配置、compose Postgres | `pnpm install`+`format:check`+compose healthy | CP |
| I02 | 共享包 `shared`/`db` 空壳与依赖方向门禁 | 1 | 2 | P1 | I01 | zod 错误码占位；web 禁止 import db | grep 门禁进 CI | CP |
| I03 | CI：format/tsc/health | 1 | 2 | P1 | I01 | GHA frozen install | PR 模板绿 | CP |
| I04 | Drizzle 初迁：users/sessions | 2 | 3 | — | I02 | 迁移 up/down | `drizzle-kit migrate` 空库成功 | CP |
| I05 | 注册登录登出 /me + argon2 + cookie | 2 | 4 | — | I04 | 仅 auth 路由 | 集成：HttpOnly、401、409 邮箱 | CP |
| I06 | `authorize` 与 workspace 成员模型 | 2 | 5 | — | I05 | shared 策略 + members 表 | 单测 3 条 RBAC + 唯一 owner 约束 | CP |
| I07 | Workspace API CRUD | 2 | 6 | P2 | I06 | 非成员 404 | curl 201/404 | CP |
| I08 | 成员邀请与角色 PATCH | 2 | 6 | P2 | I06 | 不可拆唯一 owner | 409/403 用例 | CP |
| I09 | Project CRUD+归档+slug 409 | 3 | 7 | — | I07 | A+ 可写 | 集成 slug 409 | CP |
| I10 | Task schema、状态机、version | 3 | 8 | — | I09 | `canTransition` 共用 | 422/409 集成 | CP |
| I11 | Task 列表筛选分页排序 | 3 | 9 | P3 | I10 | query zod | pageSize>100 422 | CP |
| I12 | Comment 软删 API | 3 | 9 | P3 | I10 | 作者或 admin | GET 不含已删 body | CP |
| I13 | 活动 + outbox 同事务写入 | 3 | 10 | — | I10 | 尚不 drain SSE | 回滚后 activities=0 且 outbox=0 | CP |
| I14 | Next 受保护布局与 auth 页 | 4 | 7 | P2b | I05 | 无业务 Route Handler | `/w` 未登录跳转 | CP |
| I15 | Workspace/Project 列表页四态 | 4 | 11 | — | I07 I09 I14 | feature folder | data-testid 四态 | CP |
| I16 | Task 列表筛选 UI | 4 | 12 | P4 | I11 I15 | URL 同步 query | e2e J2 | CP |
| I17 | Task 详情+乐观 status+409 Banner | 4 | 13 | P4 | I10 I15 | 仅 tasks feature | 组件 3 条 StatusChip | CP |
| I18 | Playwright J1/J2/J5 | 4 | 14 | — | I16 I17 I08 | e2e 包 | 三条测试文件绿 | CP |
| I19 | FsStorage 附件 API | 5 | 15 | P5 | I10 | MIME/10MB | 413/415/下载头 | |
| I20 | 附件 UI | 5 | 16 | — | I19 I17 | 非乐观插入 | 失败 count 不变 | |
| I21 | Outbox worker + SSE hub + Last-Event-ID | 5 | 15 | P5 | I13 | 单进程 drain | hub throw 后 pending 可重放；SSE 续传 | |
| I22 | 活动页 + EventSource hook | 5 | 16 | — | I21 I15 | 切 workspace 关连接 | e2e J3 事件可见 | |
| I23 | 最小 harness：9 cell 包装 + cheat + JSONL | 6 | 11 | P4b | I01 | 不改 apps 业务 | 故意 disable fixture → cheat=true | CP |
| I24 | 语料 T01–T16 目录与 baseline 测试挂钩 | 6 | 15 | P5 | I18 I23 | 只写 benchmarks/tasks | 每 Txx 含 prompt/allowlist/done | |
| I25 | 缺陷目录 D01–D20 + 静态 capture 矩阵 + MD 报告 | 6 | 16 | — | I23 | catalog.json 字段齐全 | `bench:static-defects` 产出 9×20 表 | |

可并行组：P1={I02,I03}；P2={I07,I08} 且 I14 可在 I05 后与阶段 3 部分并行；P3={I11,I12}；P4={I16,I17} 与 P4b={I23}；P5={I19,I21,I24}。

**不做本 issue 内 `multica issue create`**——本 issue 只交付计划；上表可直接复制为后续 issue 标题与验收。

---

## 11. 风险、未决问题、术语

### 11.1 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Biome typed 子集导致与 ESLint 表面「谁更差」被误读 | 缺口列；FN 标 `gap`；主结论分工具组 |
| Oxlint 同名规则不等价 | 扩展列独立；静态矩阵先跑 fixtures 级样本 |
| 模型靠 disable/`any` 刷绿 | cheat 门禁；增量 escape hatch |
| e2e 抖动当成 lint 差异 | 任务判定用基线单测/集成；e2e 不进 wall time 主指标 |
| 产品范围膨胀 | must 表封闭；could 默认不做 |
| `exhaustive-deps` 诱导错误修复 | T04/T06 完成定义禁止机械补依赖；测试锁行为 |
| 把 IDOR 算 lint 失败 | §8.8；D13 层=test |
| 独立仓库与 unpublished preset 脱节 | 钉 SHA；报告头记录 `preset_sha` |
| React 19 Compiler 与 hooks lint 互动 | 阶段 1 记录是否开启 compiler；默认关 compiler，避免多一个变量 |
| Next rewrite 与 cookie 站点 | 同站 `/api` 代理，避免跨站 CORS 实验噪声 |

### 11.2 未决问题（≤5，均已给默认）

评审三问已关闭，不再待议：

| 问 | 锁定答案 |
| --- | --- |
| 非成员探测 | **404** `not_found`（J1 / F04 / §4.3 / T09 同一口径）。角色不足才 403 `forbidden` |
| 异步边界 | **F21 outbox worker 升 must**；不把 SSE 当作「后台任务」豁免。F29 webhook 仍 could |
| T09 第二 workspace | **F18 seed 的 `beta`**；测试不得现场创建 |

仍保留的实施默认（不挡开工）：

| # | 问题 | 默认（实施时直接用） |
| --- | --- | --- |
| U1 | Next.js 精确主版本 | 阶段 1 锁定当时与 React 19 兼容的稳定版，写入 lockfile；战役中途不升级 |
| U2 | 附件上限 / MIME | 10MB；png/jpeg/webp/pdf/plain |
| U3 | SSE 多实例 | 不做 Redis；单进程 EventEmitter。水平扩展 = could |
| U4 | preset 尚未 publish | benchmark 钉 `vibe-coding-preset` git SHA |
| U5 | done 任务重开 | should：owner/admin `done→todo`；cancelled 不重开。MVP 可推迟到 F22，状态机函数先返回 false |

无强烈反对锁定决策。宿主选独立仓库（锁定允许的二选一中的推荐项）。Formatter 锁定 Biome format，不用 Prettier。稿 B 不作实现源。

### 11.3 术语表

| 术语 | 含义 | 避免混用 |
| --- | --- | --- |
| **cell** | 矩阵一格，如 `eslint-strict` | 不要叫「preset」以免与 npm 包混淆 |
| **preset 包** | `@vibe-coding-preset/*` | |
| **base** | 快层：correctness、危险 API、import、suppression governance | 不是「没规则」 |
| **strict** | base + 复杂度、mutation、console、显式 any/非空断言、cycle | 仍 **不是** typed Promise |
| **typeAware / type-aware** | strict + Promise、unsafe any（ESLint）、条件、project/type inference。Biome 拼写带连字符 | 两套拼写指同一层语义 |
| **react 层（ESLint/Oxlint）** | 已包含 typeAware + Hooks | |
| **react 层（Biome 包内文件）** | **只** strict + React domain，**不含** type-aware | 矩阵格 `biome-type-aware+react` 是 **组合**，不是包内现成 export |
| **none** | 无 linter，仍 format + tsc + test | 不是「无质量门禁」 |
| **baseline SHA** | 战役开始的应用 git 提交 | 不是 ESLint bulk suppression baseline；若提到后者写 **suppression baseline** |
| **cheat** | harness 判定绕过，`cheat=true` 且任务失败 | 不是「lint error」 |
| **capture layer** | lint-rule / tsc / test / sast / human-review | 一条缺陷可多层，lint 分子只算 lint-rule |
| **gap** | 工具能力故意不对齐造成的 FN | 不是工具回归失败 |
| **campaign** | 一次固定模型+baseline 的全矩阵跑 | |
| **fast lint** | base/strict，changed files | |
| **typed lint** | typeAware/react，终局/CI | |
| **safe fix / unsafe fix** | 工具声明；unsafe 默认不自动跑 | |

---

## 12. 自检对照 KIT-893 验收条件

| 验收条件 | 状态 | 落点 |
| --- | --- | --- |
| 中等偏大真实全栈，非单页 demo；前后端、DB、测试、运行方式有完整边界 | 满足 | §1 §3 §7；Compose + 独立 Hono + Next + Postgres |
| 功能/阶段/子任务完成定义可观察，无「完成页面」类模糊词 | 满足 | §2.3 表、§9 每阶段「完成条件」、§10 验收列 |
| API、数据模型、页面、用户流程互相对应，无孤立模块 | 满足 | §2.2 旅程↔功能、§4.5/§5.4 映射 |
| 公平可复现：固定变量、任务集、矩阵、指标、结果格式、防绕过 | 满足 | §8.1–§8.7 |
| 明确 lint vs tsc vs test vs SAST vs review | 满足 | §8.4 层列、§8.8 |
| 规模估算：模块 / issue / 阶段 | 满足 | 7 模块 / 25 issues / 6 阶段；MVP=阶段 1–4+最小 harness |
| 术语一致、默认决策已给、矛盾已消除 | 满足 | 本文件为唯一终稿；稿 B 作废；J1/F04/§4.3/T09 非成员统一 404；Biome `react.jsonc` ≠ 矩阵组合格（§8.2 / §11.3） |
| FAST Squad 审阅 | 本修订待复审 | 已消化 request-changes：blocker 2 与 should-fix 4–7 |
| 只提交计划，不实现代码 | 满足 | 本文件；不向 `vibe-coding-preset` 提交应用代码 |

本修订相对稿 A 的可观察改动：

- 非成员探测锁 404，J1 完成定义不再写 403。
- F21 outbox worker 升 must（后台任务）；F29 webhook 仍 could。
- F10 部分失败锁 200 `{results[]}`，禁止 207。
- F18 seed 改为 2 workspace；T09 必须用 seed `beta`。
- §1.5 / member 角色改为 workspace 级写权限，不以 assignee 为限。

已知非缺口的刻意推迟（已标明 should/could，不挡本计划验收）：

- F19 登录限流、F20 轮询回退、F22 重开、OAuth、虚拟化、Redis、S3 适配器落地、F29 出站 webhook。
- T01–T16 的 `baseline.test.ts` 在实现阶段才写代码；本计划已规定用例名与完成定义。
- 独立仓库尚未创建——属于后续实施，不是本 issue 范围。

---

## 附录 A. 与 vibe-coding-preset 现状对齐备忘

- 三包四层：ESLint `base|strict|typeAware|react`；Biome `base|strict|type-aware|react`；Oxlint `base|strict|typeAware|react`。
- 现 fixtures：`invalid.ts` floating + `any`；`react-invalid.tsx` 条件 Hook。缺陷 D01/D03/D05 必须保持同构。
- ESLint `no-floating-promises`：`ignoreIIFE: false, ignoreVoid: false`。
- Oxlint typed 必须消费方 `options.typeAware: true`。
- 仓库脚本：`pnpm format` 已是 Biome format——benchmark 沿用，不引入 Prettier。
- Node `^22.13.0 || >=24`，pnpm `11.22.0`，Biome `2.5.9`，typescript-eslint `8.x`。战役钉死当时 SHA，不跟 floating tag。

## 附录 B. 开发期建议命令（实施阶段，非本 issue）

```
corepack enable
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm --filter api dev
pnpm --filter web dev
pnpm test
pnpm e2e
pnpm bench:static-defects
```

本 issue 不运行上述命令、不创建该仓库、不提交预设仓库以外的实现。
