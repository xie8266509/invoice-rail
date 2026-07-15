export function normalizeWebhookUrl(value: string, allowLocalhost = false): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid webhook URL.");
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Webhook URLs cannot include credentials or fragments.");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  if (localHostnames.has(hostname) && !allowLocalhost) {
    throw new Error("Webhook URLs cannot target localhost.");
  }
  if (
    /^(10\.|127\.|169\.254\.|192\.168\.)/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    hostname.endsWith(".local")
  ) {
    if (!allowLocalhost || !localHostnames.has(hostname)) {
      throw new Error("Webhook URLs cannot target a private network.");
    }
  }
  const localHttp = allowLocalhost && url.protocol === "http:" && localHostnames.has(hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error("Webhook URLs must use HTTPS.");
  }
  return url.toString();
}

export function webhookRetryDelayMs(attempt: number): number {
  const schedule = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000];
  return schedule[Math.min(Math.max(attempt - 1, 0), schedule.length - 1)];
}
