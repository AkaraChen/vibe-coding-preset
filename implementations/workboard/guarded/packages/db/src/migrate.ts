import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUrl } from "./env.ts";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export async function migrate(url = databaseUrl()): Promise<void> {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const applied =
        await sql`SELECT 1 FROM schema_migrations WHERE id = ${file}`;
      if (applied.length > 0) {
        continue;
      }
      const contents = await readFile(path.join(migrationsDir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      });
    }
  } finally {
    await sql.end();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await migrate();
}
