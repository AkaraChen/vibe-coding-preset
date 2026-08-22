export const ERROR_CODES = {
  alreadyMember: "already_member",
  csrf: "csrf",
  forbidden: "forbidden",
  internal: "internal",
  invalidTransition: "invalid_transition",
  notFound: "not_found",
  ownerTransferRequired: "owner_transfer_required",
  payloadTooLarge: "payload_too_large",
  slugConflict: "slug_conflict",
  unauthenticated: "unauthenticated",
  unsupportedMediaType: "unsupported_media_type",
  validation: "validation",
  versionConflict: "version_conflict",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function unauthenticated(): AppError {
  return new AppError(
    401,
    ERROR_CODES.unauthenticated,
    "Authentication required",
  );
}

export function forbidden(message = "Forbidden"): AppError {
  return new AppError(403, ERROR_CODES.forbidden, message);
}

export function notFound(message = "Not found"): AppError {
  return new AppError(404, ERROR_CODES.notFound, message);
}

export function conflict(code: ErrorCode, message: string): AppError {
  return new AppError(409, code, message);
}

export function unprocessable(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(422, code, message, details ?? {});
}
