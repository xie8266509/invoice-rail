const appUrl = (process.env.INVOICE_RAIL_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.METRICS_SECRET;
const failOnWarning = process.env.FAIL_ON_WARNING === "true";

function output(level, event, data = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "invoice-rail-operations-check",
    event,
    ...data,
  });
  if (level === "error") console.error(entry);
  else console.log(entry);
}

const headers = secret ? { authorization: `Bearer ${secret}` } : undefined;

try {
  const response = await fetch(`${appUrl}/api/metrics`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Metrics endpoint returned HTTP ${response.status}.`);
  const alerts = Array.isArray(body.alerts) ? body.alerts : [];
  const critical = alerts.filter((alert) => alert.severity === "critical");
  const warnings = alerts.filter((alert) => alert.severity === "warning");
  output(critical.length > 0 ? "error" : "info", "operations.checked", {
    status: body.status,
    alerts,
    schema: body.metrics?.schema,
    indexer: body.metrics?.indexer,
    webhooks: body.metrics?.webhooks,
  });
  if (critical.length > 0 || (failOnWarning && warnings.length > 0)) process.exitCode = 1;
} catch (error) {
  output("error", "operations.check_failed", {
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
  });
  process.exitCode = 1;
}
