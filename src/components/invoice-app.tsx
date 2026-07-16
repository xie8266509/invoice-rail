"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Fingerprint, Lightning, WarningCircle } from "@phosphor-icons/react";
import { Callout, Text } from "@radix-ui/themes";
import type { Address, Hex } from "viem";
import { AppHeader } from "@/components/app-header";
import { CreateInvoiceForm } from "@/components/create-invoice-form";
import { InvoiceList } from "@/components/invoice-list";
import { MerchantTools } from "@/components/merchant-tools";
import { PaymentView } from "@/components/payment-view";
import { useMerchantSession } from "@/hooks/use-merchant-session";
import { useWallet } from "@/hooks/use-wallet";
import { findInvoicePayment } from "@/lib/arc";
import { decodeInvoice, type Invoice } from "@/lib/invoice";
import { loadInvoices, saveInvoices } from "@/lib/storage";
import type { WorkspaceAccess } from "@/lib/workspace";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The request could not be completed.";
}

async function persistInvoiceOnServer(
  invoice: Invoice,
  workspaceAddress: Address,
): Promise<Invoice> {
  const response = await fetch(
    `/api/invoices?workspace=${encodeURIComponent(workspaceAddress)}`,
    {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invoice }),
    },
  );
  const body = await response.json() as { invoice?: Invoice; error?: string };
  if (!response.ok || !body.invoice) {
    throw new Error(body.error ?? "The invoice could not be stored on the server.");
  }
  return body.invoice;
}

export function InvoiceApp() {
  const searchParams = useSearchParams();
  const encodedInvoice = searchParams.get("invoice");
  const wallet = useWallet();
  const merchantSession = useMerchantSession(wallet.account, wallet.provider);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceAccess[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Address>();
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const { sharedInvoice, linkError } = useMemo(() => {
    if (!encodedInvoice) return {};
    try {
      return { sharedInvoice: decodeInvoice(encodedInvoice) };
    } catch (error) {
      return { linkError: errorMessage(error) };
    }
  }, [encodedInvoice]);

  useEffect(() => {
    if (
      !wallet.account ||
      merchantSession.status !== "authenticated" ||
      merchantSession.address?.toLowerCase() !== wallet.account.toLowerCase()
    ) {
      const timer = window.setTimeout(() => {
        setWorkspaces([]);
        setSelectedWorkspace(undefined);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    fetch("/api/workspaces", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { workspaces?: WorkspaceAccess[]; error?: string };
        if (!response.ok || !body.workspaces?.length) {
          throw new Error(body.error ?? "Workspaces could not be loaded.");
        }
        if (!cancelled) {
          setWorkspaces(body.workspaces);
          setSelectedWorkspace((current) =>
            current && body.workspaces?.some(
              (workspace) => workspace.workspaceAddress.toLowerCase() === current.toLowerCase(),
            )
              ? current
              : body.workspaces?.[0].workspaceAddress,
          );
        }
      })
      .catch((error) => {
        if (!cancelled) setNotice(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [merchantSession.address, merchantSession.status, wallet.account]);

  const activeWorkspace = workspaces.find(
    (workspace) =>
      workspace.workspaceAddress.toLowerCase() === selectedWorkspace?.toLowerCase(),
  );
  const activeWorkspaceAddress = activeWorkspace?.workspaceAddress;
  const activeWorkspaceRole = activeWorkspace?.role;

  useEffect(() => {
    if (
      !wallet.account ||
      !activeWorkspaceAddress ||
      !activeWorkspaceRole ||
      merchantSession.status !== "authenticated" ||
      merchantSession.address?.toLowerCase() !== wallet.account.toLowerCase()
    ) {
      const timer = window.setTimeout(() => {
        setInvoices([]);
        setLoadingInvoices(merchantSession.status === "checking");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    const workspaceAddress = activeWorkspaceAddress;

    async function syncServerInvoices() {
      setLoadingInvoices(true);
      const cached = loadInvoices(workspaceAddress);
      if (!cancelled) setInvoices(cached);
      if (activeWorkspaceRole === "owner") {
        for (const invoice of cached) {
          if (!invoice.shareId) {
            await persistInvoiceOnServer(invoice, workspaceAddress);
          }
        }
      }

      const response = await fetch(
        `/api/invoices?workspace=${encodeURIComponent(workspaceAddress)}`,
        { cache: "no-store" },
      );
      const body = await response.json() as { invoices?: Invoice[]; error?: string };
      if (!response.ok || !body.invoices) {
        throw new Error(body.error ?? "Server invoice sync failed.");
      }
      if (!cancelled) {
        setInvoices(body.invoices);
        saveInvoices(body.invoices, workspaceAddress);
        setLoadingInvoices(false);
      }
    }

    syncServerInvoices().catch((error) => {
      if (!cancelled) {
        setLoadingInvoices(false);
        setNotice(errorMessage(error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeWorkspaceAddress,
    activeWorkspaceRole,
    merchantSession.address,
    merchantSession.status,
    wallet.account,
  ]);

  function updateInvoices(next: Invoice[], merchantAddress?: Address) {
    setInvoices(next);
    if (merchantAddress) saveInvoices(next, merchantAddress);
  }

  async function addInvoice(invoice: Invoice) {
    if (!wallet.account) throw new Error("Connect a wallet before creating an invoice.");
    const merchantAddress =
      merchantSession.status === "authenticated" && merchantSession.address
        ? merchantSession.address
        : await merchantSession.signIn();
    const workspaceAddress = activeWorkspace?.workspaceAddress ?? merchantAddress;
    if (activeWorkspace?.role === "viewer") {
      throw new Error("Viewer access is read-only.");
    }
    const stored = await persistInvoiceOnServer(invoice, workspaceAddress);
    const next = [stored, ...invoices.filter((item) => item.id !== stored.id)];
    updateInvoices(next, workspaceAddress);
    setNotice(`Invoice ${stored.id} is synced and ready to share.`);
    window.setTimeout(() => setNotice(undefined), 3000);
  }

  function markPaid(id: string, txHash: Hex, paidAt: string) {
    const next = invoices.map((invoice) =>
      invoice.id === id ? { ...invoice, status: "paid" as const, txHash, paidAt } : invoice,
    );
    updateInvoices(
      next,
      merchantSession.status === "authenticated"
        ? activeWorkspace?.workspaceAddress
        : undefined,
    );
  }

  async function verifyInvoice(invoice: Invoice) {
    setVerifyingId(invoice.id);
    setNotice(undefined);
    try {
      const result = await findInvoicePayment(invoice);
      if (result?.txHash && result.paidAt) {
        markPaid(invoice.id, result.txHash, result.paidAt);
        setNotice(`Payment confirmed for ${invoice.id}.`);
      } else {
        setNotice(`No matching payment found for ${invoice.id}.`);
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setVerifyingId(undefined);
    }
  }

  if (sharedInvoice) {
    return (
      <div className="app-frame">
        <AppHeader
          account={wallet.account}
          balances={wallet.balances}
          connecting={wallet.connecting}
          loadingBalances={wallet.loadingBalances}
          isArc={wallet.isArc}
          rpcOnline={wallet.rpcOnline}
          balanceWarning={wallet.balanceWarning}
          wallets={wallet.wallets}
          selectedWalletId={wallet.selectedWalletId}
          onConnect={() => wallet.connect().catch(() => undefined)}
          onSelectWallet={(id) => wallet.selectWallet(id).catch(() => undefined)}
          onSwitchNetwork={wallet.switchNetwork}
        />
        <PaymentView
          invoice={sharedInvoice}
          wallet={wallet}
          onPaid={(hash, paidAt) => markPaid(sharedInvoice.id, hash, paidAt)}
        />
      </div>
    );
  }

  return (
    <div className="app-frame">
      <AppHeader
        account={wallet.account}
        balances={wallet.balances}
        connecting={wallet.connecting}
        loadingBalances={wallet.loadingBalances}
        isArc={wallet.isArc}
        rpcOnline={wallet.rpcOnline}
        balanceWarning={wallet.balanceWarning}
        wallets={wallet.wallets}
        selectedWalletId={wallet.selectedWalletId}
        onConnect={() => wallet.connect().catch(() => undefined)}
        onSelectWallet={(id) => wallet.selectWallet(id).catch(() => undefined)}
        onSwitchNetwork={wallet.switchNetwork}
        authStatus={merchantSession.status}
        onSignIn={() => {
          setNotice(undefined);
          merchantSession.signIn().catch((error) => setNotice(errorMessage(error)));
        }}
      />

      <main className="dashboard-shell">
        <section className="product-intro">
          <div>
            <Text className="intro-kicker">Stablecoin settlement</Text>
            <h1>Issue once. Reconcile onchain.</h1>
            <p>
              Create USDC or EURC payment requests with a verifiable invoice reference on Arc Testnet.
            </p>
          </div>
          <div className="rail-facts" aria-label="Product capabilities">
            <div>
              <Lightning size={19} weight="duotone" />
              <Text size="2" weight="medium">Sub-second finality</Text>
            </div>
            <div>
              <Fingerprint size={19} weight="duotone" />
              <Text size="2" weight="medium">Memo reconciliation</Text>
            </div>
          </div>
        </section>

        {linkError || wallet.error || merchantSession.error ? (
          <Callout.Root color="red" role="alert" className="global-callout">
            <Callout.Icon><WarningCircle size={18} /></Callout.Icon>
            <Callout.Text>{linkError ?? wallet.error ?? merchantSession.error}</Callout.Text>
          </Callout.Root>
        ) : notice ? (
          <Callout.Root color="jade" role="status" className="global-callout">
            <Callout.Text>{notice}</Callout.Text>
          </Callout.Root>
        ) : null}

        {wallet.account && activeWorkspace ? (
          <MerchantTools
            account={wallet.account}
            workspace={activeWorkspace}
            workspaces={workspaces}
            onWorkspaceChange={(address) => {
              setSelectedWorkspace(address);
              setNotice(undefined);
            }}
          />
        ) : null}

        <div className="dashboard-grid">
          <CreateInvoiceForm
            account={wallet.account}
            defaultRecipient={activeWorkspace?.workspaceAddress}
            canCreate={activeWorkspace?.role !== "viewer"}
            onCreated={addInvoice}
          />
          <InvoiceList
            invoices={invoices}
            loading={loadingInvoices}
            verifyingId={verifyingId}
            onVerify={verifyInvoice}
          />
        </div>
      </main>

      <footer className="app-footer">
        <Text size="1" color="gray">
          Testnet only. USDC and EURC have no real-world value here.
        </Text>
        <a href="https://docs.arc.io" target="_blank" rel="noreferrer">
          Arc developer docs
        </a>
      </footer>
    </div>
  );
}
