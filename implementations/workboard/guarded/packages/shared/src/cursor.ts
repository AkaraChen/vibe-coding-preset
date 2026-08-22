export type ActivityCursor = {
  createdAt: string;
  id: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64UrlToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function encodeCursor(cursor: ActivityCursor): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(cursor)));
}

export function decodeCursor(value: string): ActivityCursor | undefined {
  try {
    const parsed: unknown = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(value)),
    );
    if (typeof parsed !== "object" || parsed === null) {
      return undefined;
    }
    const record = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof record.createdAt !== "string" || typeof record.id !== "string") {
      return undefined;
    }
    return { createdAt: record.createdAt, id: record.id };
  } catch {
    return undefined;
  }
}
