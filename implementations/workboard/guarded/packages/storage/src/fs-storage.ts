import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Storage, StorageObject } from "./types.ts";

function resolveSafe(root: string, key: string): string {
  if (
    key.includes("..") ||
    key.includes("/") ||
    key.includes("\\") ||
    key.length === 0
  ) {
    throw new Error("Invalid storage key");
  }
  const resolved = path.resolve(root, key);
  const rootResolved = path.resolve(root);
  if (
    !resolved.startsWith(`${rootResolved}${path.sep}`) &&
    resolved !== rootResolved
  ) {
    throw new Error("Invalid storage key");
  }
  return resolved;
}

export class FsStorage implements Storage {
  constructor(private readonly root: string) {}

  async delete(key: string): Promise<void> {
    await rm(resolveSafe(this.root, key), { force: true });
    await rm(`${resolveSafe(this.root, key)}.mime`, { force: true });
  }

  async get(key: string): Promise<StorageObject | undefined> {
    try {
      const filePath = resolveSafe(this.root, key);
      const body = await readFile(filePath);
      const mimeType = await readFile(`${filePath}.mime`, "utf8");
      return {
        body: new Uint8Array(body),
        mimeType,
      };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return undefined;
      }
      throw error;
    }
  }

  async put(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const filePath = resolveSafe(this.root, key);
    await writeFile(filePath, body);
    await writeFile(`${filePath}.mime`, mimeType);
  }
}
