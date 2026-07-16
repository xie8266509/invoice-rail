import { describe, expect, it } from "vitest";
import {
  evaluateOperationalAlerts,
  type OperationalMetrics,
} from "@/lib/server/metrics";

function metrics(overrides: Partial<OperationalMetrics> = {}): OperationalMetrics {
  return {
    databaseLatencyMs: 10,
    schema: { currentVersion: 4, latestVersion: 4, pending: 0 },
    invoices: {},
    webhooks: {},
    activeRateLimitBuckets: 0,
    indexer: {},
    ...overrides,
  };
}

describe("operational alert rules", () => {
  it("reports healthy metrics without alerts", () => {
    expect(evaluateOperationalAlerts(metrics())).toEqual([]);
  });

  it("escalates stale workers and large webhook backlogs", () => {
    const alerts = evaluateOperationalAlerts(metrics({
      webhooks: { pending: 250, failed: 10 },
      indexer: {
        heartbeat: {
          status: "ok",
          observedAt: "2026-07-15T19:50:00.000Z",
          details: {},
        },
      },
    }), new Date("2026-07-15T20:00:00.000Z"));

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "indexer_stale", severity: "critical" }),
      expect.objectContaining({ code: "webhook_failures", severity: "critical" }),
      expect.objectContaining({ code: "webhook_backlog", severity: "critical" }),
    ]));
  });
});
