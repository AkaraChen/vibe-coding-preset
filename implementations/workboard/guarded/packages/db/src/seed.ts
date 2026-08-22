import path from "node:path";
import argon2 from "argon2";
import { sql } from "drizzle-orm";
import {
  SEED_PASSWORD,
  SEED_PROJECT_IDS,
  SEED_USER_IDS,
  SEED_WORKSPACE_IDS,
  seedTaskId,
  TASK_STATUSES,
  type TaskStatus,
} from "@workboard/shared";
import { createDatabase, createSql } from "./client.ts";
import { databaseUrl } from "./env.ts";
import {
  projects,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "./schema.ts";

const STATUSES: TaskStatus[] = [...TASK_STATUSES];

function statusForIndex(index: number): TaskStatus {
  const status = STATUSES[index % STATUSES.length];
  if (status === undefined) {
    return "todo";
  }
  return status;
}

export async function seed(url = databaseUrl()): Promise<void> {
  const client = createSql(url);
  const db = createDatabase(client);
  const passwordHash = await argon2.hash(SEED_PASSWORD, {
    memoryCost: 4096,
    parallelism: 1,
    timeCost: 1,
    type: argon2.argon2id,
  });

  await db.execute(sql`
    TRUNCATE TABLE
      activity_outbox,
      activities,
      attachments,
      comments,
      tasks,
      projects,
      workspace_members,
      sessions,
      workspaces,
      users
    RESTART IDENTITY CASCADE
  `);

  await db.insert(users).values([
    {
      id: SEED_USER_IDS.ada,
      email: "ada@seed.test",
      name: "Ada",
      passwordHash,
    },
    {
      id: SEED_USER_IDS.ben,
      email: "ben@seed.test",
      name: "Ben",
      passwordHash,
    },
    {
      id: SEED_USER_IDS.cara,
      email: "cara@seed.test",
      name: "Cara",
      passwordHash,
    },
  ]);

  await db.insert(workspaces).values([
    { id: SEED_WORKSPACE_IDS.alpha, name: "Alpha", slug: "alpha" },
    { id: SEED_WORKSPACE_IDS.beta, name: "Beta", slug: "beta" },
  ]);

  await db.insert(workspaceMembers).values([
    {
      workspaceId: SEED_WORKSPACE_IDS.alpha,
      userId: SEED_USER_IDS.ada,
      role: "owner",
    },
    {
      workspaceId: SEED_WORKSPACE_IDS.alpha,
      userId: SEED_USER_IDS.ben,
      role: "member",
    },
    {
      workspaceId: SEED_WORKSPACE_IDS.alpha,
      userId: SEED_USER_IDS.cara,
      role: "viewer",
    },
    {
      workspaceId: SEED_WORKSPACE_IDS.beta,
      userId: SEED_USER_IDS.ada,
      role: "owner",
    },
  ]);

  await db.insert(projects).values([
    {
      id: SEED_PROJECT_IDS.alphaRoadmap,
      workspaceId: SEED_WORKSPACE_IDS.alpha,
      name: "Roadmap",
      slug: "roadmap",
      description: "Alpha roadmap",
    },
    {
      id: SEED_PROJECT_IDS.alphaOps,
      workspaceId: SEED_WORKSPACE_IDS.alpha,
      name: "Ops",
      slug: "ops",
      description: "Alpha operations",
    },
    {
      id: SEED_PROJECT_IDS.betaLaunch,
      workspaceId: SEED_WORKSPACE_IDS.beta,
      name: "Launch",
      slug: "launch",
      description: "Beta launch",
    },
  ]);

  const alphaTasks = Array.from({ length: 30 }, (_, index) => {
    const n = index + 1;
    const projectId =
      n <= 15 ? SEED_PROJECT_IDS.alphaRoadmap : SEED_PROJECT_IDS.alphaOps;
    return {
      id: seedTaskId("alpha", n),
      projectId,
      title: `Alpha task ${String(n)}`,
      description: "",
      status: statusForIndex(index),
      priority: "none" as const,
      assigneeId: n % 3 === 0 ? SEED_USER_IDS.ben : null,
      createdBy: SEED_USER_IDS.ada,
      version: 1,
    };
  });

  const betaTasks = [1, 2].map((n) => ({
    id: seedTaskId("beta", n),
    projectId: SEED_PROJECT_IDS.betaLaunch,
    title: `Beta task ${String(n)}`,
    description: "",
    status: statusForIndex(n),
    priority: "none" as const,
    assigneeId: null,
    createdBy: SEED_USER_IDS.ada,
    version: 1,
  }));

  await db.insert(tasks).values([...alphaTasks, ...betaTasks]);
  await client.end();
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]).includes("seed.ts");

if (isMain) {
  await seed();
}
