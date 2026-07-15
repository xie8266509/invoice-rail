"use client";

import { useState } from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  Copy,
  FileText,
} from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Heading,
  IconButton,
  Skeleton,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { ARC_EXPLORER_URL } from "@/lib/constants";
import { encodeInvoice, formatAddress, isInvoiceExpired, type Invoice } from "@/lib/invoice";

type InvoiceListProps = {
  invoices: Invoice[];
  loading: boolean;
  verifyingId?: string;
  onVerify: (invoice: Invoice) => void;
};

const statusColor = {
  open: "amber",
  processing: "blue",
  paid: "jade",
  expired: "gray",
} as const;

function statusFor(invoice: Invoice): Invoice["status"] {
  if (invoice.status === "paid") return "paid";
  return isInvoiceExpired(invoice) ? "expired" : invoice.status;
}

function paymentUrl(invoice: Invoice): string {
  if (invoice.shareId) {
    return `${window.location.origin}/pay/${encodeURIComponent(invoice.shareId)}`;
  }
  return `${window.location.origin}/?invoice=${encodeInvoice(invoice)}`;
}

export function InvoiceList({ invoices, loading, verifyingId, onVerify }: InvoiceListProps) {
  const [copiedId, setCopiedId] = useState<string>();

  async function copyLink(invoice: Invoice) {
    await navigator.clipboard.writeText(paymentUrl(invoice));
    setCopiedId(invoice.id);
    window.setTimeout(() => setCopiedId(undefined), 1800);
  }

  return (
    <section className="invoice-list-panel" aria-labelledby="invoice-list-heading">
      <div className="panel-heading list-heading">
        <div>
          <Heading id="invoice-list-heading" size="6">
            Your invoices
          </Heading>
          <Text size="2" color="gray">
            Synced to this server and verified against Arc.
          </Text>
        </div>
        <Badge color="gray" variant="soft" size="2">
          {invoices.length} total
        </Badge>
      </div>

      {loading ? (
        <div className="invoice-skeletons" aria-label="Loading invoices">
          {[0, 1, 2].map((item) => (
            <div className="invoice-skeleton" key={item}>
              <Skeleton height="18px" width="42%" />
              <Skeleton height="28px" width="70%" />
              <Skeleton height="14px" width="58%" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            <FileText size={28} weight="duotone" />
          </span>
          <Heading size="3">No invoices yet</Heading>
          <Text size="2" color="gray">
            Create a request to generate your first payment link.
          </Text>
        </div>
      ) : (
        <div className="invoice-stack">
          {invoices.map((invoice) => {
            const status = statusFor(invoice);
            return (
              <article className="invoice-row" key={invoice.id}>
                <div className="invoice-row-main">
                  <div className="invoice-title-line">
                    <Text size="2" weight="bold" className="mono-text">
                      {invoice.id}
                    </Text>
                    <Badge color={statusColor[status]} variant="soft">
                      {status}
                    </Badge>
                  </div>
                  <div className="invoice-amount">
                    <span>{invoice.amount}</span>
                    <Text size="2" color="gray" weight="medium">
                      {invoice.token}
                    </Text>
                  </div>
                  <Text size="1" color="gray">
                    To {formatAddress(invoice.recipient)} for {invoice.merchantName}
                  </Text>
                </div>

                <div className="invoice-actions">
                  <Button variant="soft" color="gray" onClick={() => copyLink(invoice)}>
                    {copiedId === invoice.id ? <Check size={16} /> : <Copy size={16} />}
                    {copiedId === invoice.id ? "Copied" : "Copy link"}
                  </Button>
                  {invoice.txHash ? (
                    <Tooltip content="View transaction">
                      <IconButton
                        asChild
                        variant="soft"
                        color="gray"
                        aria-label="View transaction"
                      >
                        <a
                          href={`${ARC_EXPLORER_URL}/tx/${invoice.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ArrowSquareOut size={17} />
                        </a>
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip content="Verify on Arc">
                      <IconButton
                        variant="soft"
                        color="gray"
                        aria-label="Verify invoice on Arc"
                        disabled={verifyingId === invoice.id}
                        onClick={() => onVerify(invoice)}
                      >
                        <ArrowClockwise
                          size={17}
                          className={verifyingId === invoice.id ? "is-rotating" : undefined}
                        />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
