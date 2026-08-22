export function readEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value.length > 0) {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`${name} is required`);
}

export function cookieSecure(): boolean {
  return readEnv("COOKIE_SECURE", "false") === "true";
}

export function storageDir(): string {
  return readEnv("STORAGE_DIR", "./data/attachments");
}

export function webOrigin(): string {
  return readEnv("WEB_ORIGIN", "http://127.0.0.1:3000");
}

export function apiPort(): number {
  return Number.parseInt(readEnv("API_PORT", "3001"), 10);
}
