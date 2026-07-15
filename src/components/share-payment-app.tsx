"use client";

import { AppHeader } from "@/components/app-header";
import { PaymentView } from "@/components/payment-view";
import { useWallet } from "@/hooks/use-wallet";
import type { Invoice } from "@/lib/invoice";

export function SharePaymentApp({ invoice }: { invoice: Invoice }) {
  const wallet = useWallet();

  function requestIndexing() {
    fetch("/api/indexer", { method: "POST" }).catch(() => undefined);
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
        onConnect={() => wallet.connect().catch(() => undefined)}
        onSwitchNetwork={wallet.switchNetwork}
      />
      <PaymentView invoice={invoice} wallet={wallet} onPaid={requestIndexing} />
    </div>
  );
}
