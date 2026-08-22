type LogLevel = "info" | "error";

type LogFields = {
  actorId?: string | undefined;
  durationMs?: number | undefined;
  method?: string | undefined;
  path?: string | undefined;
  requestId?: string | undefined;
  status?: number | undefined;
};

function write(level: LogLevel, message: string, fields: LogFields): void {
  const line = JSON.stringify({
    level,
    message,
    actorId: fields.actorId,
    durationMs: fields.durationMs,
    method: fields.method,
    path: fields.path,
    requestId: fields.requestId,
    status: fields.status,
    time: new Date().toISOString(),
  });
  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }
  process.stdout.write(`${line}\n`);
}

export const logger = {
  error(message: string, fields: LogFields = {}): void {
    write("error", message, fields);
  },
  info(message: string, fields: LogFields = {}): void {
    write("info", message, fields);
  },
};
