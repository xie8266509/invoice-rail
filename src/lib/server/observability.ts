import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";
export type LogData = Record<string, unknown>;

const REDACTED_KEY = /(authorization|cookie|password|secret|signature|token|private.?key)/i;

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (REDACTED_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message.slice(0, 500) };
  }
  if (value === undefined) return undefined;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.slice(0, 2_000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 100).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey, depth + 1),
      ]),
    );
  }
  return String(value);
}

export function sanitizeLogData(data: LogData): LogData {
  return sanitize(data) as LogData;
}

export function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
}

export function requestLogData(request: Request, id: string): LogData {
  const url = new URL(request.url);
  return {
    requestId: id,
    method: request.method,
    path: url.pathname,
  };
}

export function logEvent(level: LogLevel, event: string, data: LogData = {}): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "invoice-rail-web",
    event,
    ...sanitizeLogData(data),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function withRequestId(response: Response, id: string): Response {
  response.headers.set("x-request-id", id);
  return response;
}
