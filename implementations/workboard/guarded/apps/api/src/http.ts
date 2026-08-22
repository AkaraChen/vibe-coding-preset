import type { Context } from "hono";
import type { ZodType } from "zod";
import { AppError, ERROR_CODES, unprocessable } from "@workboard/shared";
import type { Actor, AppVariables } from "./types.ts";

export function requestIdOf(c: Context<{ Variables: AppVariables }>): string {
  return c.get("requestId");
}

export function requireActor(c: Context<{ Variables: AppVariables }>): Actor {
  const actor = c.get("actor");
  if (actor === undefined) {
    throw new AppError(
      401,
      ERROR_CODES.unauthenticated,
      "Authentication required",
    );
  }
  return actor;
}

export async function parseJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw unprocessable(ERROR_CODES.validation, "Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw unprocessable(ERROR_CODES.validation, "Invalid request", {
      issues: parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    });
  }
  return parsed.data;
}

export function errorEnvelope(error: AppError, requestId: string) {
  return {
    error: {
      code: error.code,
      details: error.details,
      message: error.message,
      requestId,
    },
  };
}

export function readVersion(
  c: Context,
  bodyVersion: number | undefined,
): number {
  const match = c.req.header("If-Match");
  if (match !== undefined && match.length > 0) {
    const parsed = Number.parseInt(match.replaceAll('"', ""), 10);
    if (Number.isNaN(parsed)) {
      throw new AppError(
        409,
        ERROR_CODES.versionConflict,
        "Invalid If-Match version",
      );
    }
    return parsed;
  }
  if (bodyVersion !== undefined) {
    return bodyVersion;
  }
  throw new AppError(409, ERROR_CODES.versionConflict, "Version required");
}
