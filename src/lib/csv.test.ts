import { describe, expect, it } from "vitest";
import { invoicesToCsv } from "@/lib/csv";
import type { Invoice } from "@/lib/invoice";

const invoice: Invoice = {
  id: "IR-260715-ABC123FF0000",
  merchantName: "Studio, Inc.",
  recipient: "0xe118311A862aAf12e70390385B349c9eCeF75b06",
  amount: "12.50",
  token: "USDC",
  memo: '=HYPERLINK("https://example.com")',
  dueDate: "2026-07-22",
  createdAt: "2026-07-15T12:00:00.000Z",
  status: "open",
};

describe("invoice CSV export", () => {
  it("quotes delimiters and neutralizes spreadsheet formulas", () => {
    const csv = invoicesToCsv([invoice]);
    expect(csv).toContain('"Studio, Inc."');
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
