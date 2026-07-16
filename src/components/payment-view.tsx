"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  CurrencyCircleDollar,
  ShieldCheck,
  Wallet,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Badge,
  Button,
  Callout,
  Heading,
  Text,
} from "@radix-ui/themes";
import type { Hex } from "viem";
import { findInvoicePayment, payInvoice } from "@/lib/arc";
import { arcErrorMessage } from "@/lib/arc-error";
import { ARC_EXPLORER_URL } from "@/lib/constants";
import {
  formatAddress,
  getMemoId,
  isInvoiceExpired,
  type Invoice,
} from "@/lib/invoice";
import type { ReturnTypeUseWallet } from "@/components/wallet-types";

type PaymentViewProps = {
  invoice: Invoice;
  wallet: ReturnTypeUseWallet;
  onPaid: (hash: Hex, paidAt: string) => void;
};

function readableDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function errorMessage(error: unknown): string {
  return arcErrorMessage(error, "The payment could not be completed.");
}

export function PaymentView({ invoice, wallet, onPaid }: PaymentViewProps) {
  const [status, setStatus] = useState<Invoice["status"]>(invoice.status);
  const [txHash, setTxHash] = useState<Hex | undefined>(invoice.txHash);
  const [checking, setChecking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const expired = isInvoiceExpired(invoice);

  const balanceState = useMemo(() => {
    if (!wallet.account || !wallet.balances) return { ready: false, sufficient: false };
    const assetBalance = Number(wallet.balances[invoice.token] ?? "0");
    const gasBalance = Number(wallet.balances.USDC ?? "0");
    return {
      ready: true,
      sufficient: assetBalance >= Number(invoice.amount) && gasBalance >= 0.01,
      assetBalance,
      gasBalance,
    };
  }, [invoice.amount, invoice.token, wallet.account, wallet.balances]);

  async function verifyPayment() {
    setChecking(true);
    setError(undefined);
    try {
      const payment = await findInvoicePayment(invoice);
      if (payment?.txHash && payment.paidAt) {
        setStatus("paid");
        setTxHash(payment.txHash);
        onPaid(payment.txHash, payment.paidAt);
      }
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    findInvoicePayment(invoice)
      .then((payment) => {
        if (cancelled || !payment?.txHash) return;
        setStatus("paid");
        setTxHash(payment.txHash);
      })
      .catch((nextError) => {
        if (!cancelled) setError(errorMessage(nextError));
      });
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  async function submitPayment() {
    if (!wallet.account) {
      await wallet.connect();
      return;
    }
    if (!wallet.isArc) {
      await wallet.switchNetwork();
      return;
    }
    setPaying(true);
    setStatus("processing");
    setError(undefined);
    try {
      const result = await payInvoice(wallet.provider, invoice);
      const paidAt = new Date().toISOString();
      setStatus("paid");
      setTxHash(result.hash);
      onPaid(result.hash, paidAt);
      await wallet.refreshBalances();
    } catch (nextError) {
      setStatus("open");
      setError(errorMessage(nextError));
    } finally {
      setPaying(false);
    }
  }

  async function copyMemoId() {
    await navigator.clipboard.writeText(getMemoId(invoice.id));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="payment-shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} />
        Back to invoices
      </Link>

      <section className="payment-card" aria-labelledby="payment-heading">
        <div className="payment-topline">
          <Badge color={status === "paid" ? "jade" : expired ? "gray" : "amber"} variant="soft">
            {status === "paid" ? "Paid" : expired ? "Expired" : "Payment requested"}
          </Badge>
          <Text size="1" color="gray" className="mono-text">
            {invoice.id}
          </Text>
        </div>

        {status === "paid" ? (
          <div className="success-mark" aria-hidden="true">
            <CheckCircle size={42} weight="duotone" />
          </div>
        ) : (
          <div className="payment-token-mark" aria-hidden="true">
            <CurrencyCircleDollar size={38} weight="duotone" />
          </div>
        )}

        <div className="payment-title">
          <Text size="2" color="gray">
            {status === "paid" ? "Payment confirmed for" : "Pay"} {invoice.merchantName}
          </Text>
          <Heading id="payment-heading" className="payment-amount-heading">
            {invoice.amount} <span>{invoice.token}</span>
          </Heading>
        </div>

        <div className="payment-details">
          <div>
            <Text size="1" color="gray">Recipient</Text>
            <Text size="2" weight="medium" className="mono-text">{formatAddress(invoice.recipient)}</Text>
          </div>
          <div>
            <Text size="1" color="gray">Due date</Text>
            <Text size="2" weight="medium">{readableDate(invoice.dueDate)}</Text>
          </div>
          <div className="payment-detail-wide">
            <Text size="1" color="gray">Memo</Text>
            <Text size="2" weight="medium">{invoice.memo || "No memo provided"}</Text>
          </div>
        </div>

        {error ? (
          <Callout.Root color="red" role="alert">
            <Callout.Icon><WarningCircle size={18} /></Callout.Icon>
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        ) : null}

        {wallet.account && balanceState.ready && !balanceState.sufficient && status !== "paid" ? (
          <Callout.Root color="amber" role="status">
            <Callout.Icon><WarningCircle size={18} /></Callout.Icon>
            <Callout.Text>
              This wallet needs {invoice.amount} {invoice.token} and at least 0.01 USDC for gas.
            </Callout.Text>
          </Callout.Root>
        ) : null}

        {status === "paid" && txHash ? (
          <Button asChild size="3" className="payment-primary">
            <a href={`${ARC_EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noreferrer">
              View receipt <ArrowSquareOut size={17} />
            </a>
          </Button>
        ) : (
          <Button
            size="3"
            className="payment-primary"
            onClick={submitPayment}
            disabled={expired || paying || (balanceState.ready && !balanceState.sufficient)}
          >
            {!wallet.account ? <Wallet size={18} /> : <ShieldCheck size={18} />}
            {!wallet.account
              ? "Connect wallet"
              : !wallet.isArc
                ? "Switch to Arc"
                : paying
                  ? "Confirming payment..."
                  : `Pay ${invoice.amount} ${invoice.token}`}
          </Button>
        )}

        <div className="payment-footer-actions">
          <button className="text-action" type="button" onClick={copyMemoId}>
            <Copy size={14} /> {copied ? "Memo ID copied" : "Copy memo ID"}
          </button>
          {status !== "paid" ? (
            <button className="text-action" type="button" onClick={verifyPayment} disabled={checking}>
              {checking ? "Checking Arc..." : "Check payment"}
            </button>
          ) : null}
        </div>
      </section>

      <div className="payment-trust-note">
        <ShieldCheck size={17} />
        <Text size="1" color="gray">
          Your wallet signs the transaction. Invoice Rail never receives private keys.
        </Text>
      </div>
    </main>
  );
}
