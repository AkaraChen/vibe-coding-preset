import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "./env.ts";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

export function createSql(url = databaseUrl()): ReturnType<typeof postgres> {
  return postgres(url, { max: 10, prepare: false });
}

export function createDatabase(sql: ReturnType<typeof postgres>) {
  return drizzle(sql, { schema });
}
