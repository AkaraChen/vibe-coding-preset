export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type ErrorBody = {
  error?: { code?: unknown; message?: unknown };
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    init.body !== undefined &&
    !headers.has("content-type") &&
    !(init.body instanceof FormData)
  ) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    const errorBody = body as ErrorBody;
    const code =
      typeof errorBody.error?.code === "string"
        ? errorBody.error.code
        : "internal";
    const message =
      typeof errorBody.error?.message === "string"
        ? errorBody.error.message
        : "Request failed";
    throw new ApiError(response.status, code, message);
  }
  return body as T;
}
