import { describe, expect, it } from "vitest";
import { requestId, sanitizeLogData } from "@/lib/server/observability";

describe("structured observability", () => {
  it("redacts credentials recursively", () => {
    expect(sanitizeLogData({
      authorization: "Bearer secret",
      nested: { webhookSecret: "whsec_value", value: "safe" },
      error: new Error("failed"),
    })).toEqual({
      authorization: "[REDACTED]",
      nested: { webhookSecret: "[REDACTED]", value: "safe" },
      error: { name: "Error", message: "failed" },
    });
  });

  it("accepts bounded request IDs and rejects unsafe values", () => {
    expect(requestId(new Request("https://example.com", {
      headers: { "x-request-id": "request-1234" },
    }))).toBe("request-1234");
    expect(requestId(new Request("https://example.com", {
      headers: { "x-request-id": "bad value" },
    }))).toMatch(/^[a-f0-9-]{36}$/);
  });
});
