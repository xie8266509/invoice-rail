import { describe, expect, it, vi } from "vitest";
import {
  createInvoice,
  decodeInvoice,
  encodeInvoice,
  getMemoId,
  getTransferData,
  validateInvoiceInput,
} from "@/lib/invoice";

const recipient = "0x1111111111111111111111111111111111111111";

describe("invoice domain", () => {
  it("validates amount precision and recipient addresses", () => {
    expect(
      validateInvoiceInput({
        merchantName: "Northstar Labs",
        recipient: "0x123",
        amount: "1.0000001",
        token: "USDC",
        memo: "",
        dueDate: "",
      }),
    ).toMatchObject({
      recipient: expect.any(String),
      amount: expect.any(String),
      dueDate: expect.any(String),
    });
  });

  it("round trips a shareable invoice", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "abc123ff-0000-0000-0000-000000000000" });
    const invoice = createInvoice(
      {
        merchantName: "Northstar Labs",
        recipient,
        amount: "42.50",
        token: "USDC",
        memo: "Design milestone",
        dueDate: "2027-08-01",
      },
      123n,
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(decodeInvoice(encodeInvoice(invoice))).toMatchObject({
      id: "IR-260715-ABC123FF0000",
      recipient,
      amount: "42.50",
      token: "USDC",
      createdBlock: "123",
      status: "open",
    });
  });

  it("produces stable memo and transfer calldata", () => {
    const invoice = createInvoice(
      {
        merchantName: "Northstar Labs",
        recipient,
        amount: "1.25",
        token: "EURC",
        memo: "Invoice test",
        dueDate: "2027-08-01",
      },
      400n,
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(getMemoId(invoice.id)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(getTransferData(invoice)).toMatch(/^0xa9059cbb/);
  });

  it("rejects malformed payment links with a safe message", () => {
    expect(() => decodeInvoice("invalid")).toThrow(
      "This payment link is incomplete or invalid.",
    );
  });
});
