"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { arcErrorMessage } from "@/lib/arc-error";
import { ARC_CHAIN_ID } from "@/lib/constants";
import {
  getTokenBalances,
  getWalletSnapshot,
  publicClient,
  switchToArcTestnet,
  type TokenBalances,
} from "@/lib/arc";
import type { Eip6963ProviderDetail, EthereumProvider } from "@/types/ethereum";

const WALLET_PROVIDER_STORAGE_KEY = "invoice-rail:wallet-provider:v1";

type WalletProviderOption = {
  id: string;
  name: string;
  provider: EthereumProvider;
};

export type WalletProviderSummary = Omit<WalletProviderOption, "provider">;

type WalletState = {
  account?: Address;
  chainId?: number;
  balances?: TokenBalances;
  connecting: boolean;
  loadingBalances: boolean;
  rpcOnline: boolean;
  error?: string;
  balanceWarning?: string;
};

function errorMessage(error: unknown): string {
  return arcErrorMessage(error, "The wallet request could not be completed.");
}

export function useWallet() {
  const [walletOptions, setWalletOptions] = useState<WalletProviderOption[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>();
  const [state, setState] = useState<WalletState>({
    connecting: false,
    loadingBalances: false,
    rpcOnline: false,
  });
  const selectedWallet = useMemo(
    () => walletOptions.find((wallet) => wallet.id === selectedWalletId),
    [selectedWalletId, walletOptions],
  );

  const refreshBalances = useCallback(async (account?: Address) => {
    if (!account) {
      setState((current) => ({ ...current, balances: undefined }));
      return;
    }
    setState((current) => ({ ...current, loadingBalances: true }));
    try {
      const { balances, unavailable } = await getTokenBalances(account);
      setState((current) => ({
        ...current,
        balances,
        loadingBalances: false,
        balanceWarning: unavailable.length > 0
          ? `${unavailable.join(" and ")} balance temporarily unavailable.`
          : undefined,
      }));
    } catch {
      setState((current) => ({
        ...current,
        balances: undefined,
        loadingBalances: false,
        balanceWarning: "Token balances are temporarily unavailable.",
      }));
    }
  }, []);

  const syncWallet = useCallback(
    async (requestAccess = false, provider = selectedWallet?.provider) => {
      try {
        const snapshot = await getWalletSnapshot(provider, requestAccess);
        setState((current) => ({ ...current, ...snapshot, connecting: false, error: undefined }));
        await refreshBalances(snapshot.account);
        return snapshot;
      } catch (error) {
        setState((current) => ({
          ...current,
          connecting: false,
          error: errorMessage(error),
        }));
        throw error;
      }
    },
    [refreshBalances, selectedWallet?.provider],
  );

  const connect = useCallback(async () => {
    setState((current) => ({ ...current, connecting: true, error: undefined }));
    return syncWallet(true);
  }, [syncWallet]);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToArcTestnet(selectedWallet?.provider);
      await syncWallet(false, selectedWallet?.provider);
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
    }
  }, [selectedWallet?.provider, syncWallet]);

  const selectWallet = useCallback(async (id: string) => {
    const wallet = walletOptions.find((option) => option.id === id);
    if (!wallet) throw new Error("The selected wallet is no longer available.");
    window.localStorage.setItem(WALLET_PROVIDER_STORAGE_KEY, id);
    setSelectedWalletId(id);
    setState((current) => ({
      ...current,
      account: undefined,
      balances: undefined,
      connecting: true,
      error: undefined,
    }));
    return syncWallet(true, wallet.provider);
  }, [syncWallet, walletOptions]);

  useEffect(() => {
    const providers = new Map<string, WalletProviderOption>();

    function publish() {
      const next = Array.from(providers.values());
      setWalletOptions(next);
      setSelectedWalletId((current) => {
        if (current && next.some((wallet) => wallet.id === current)) return current;
        const stored = window.localStorage.getItem(WALLET_PROVIDER_STORAGE_KEY);
        if (stored && next.some((wallet) => wallet.id === stored)) return stored;
        return next[0]?.id;
      });
    }

    function addWallet(option: WalletProviderOption) {
      const key = option.name.trim().toLowerCase();
      if (providers.has(key)) return;
      providers.set(key, option);
      publish();
    }

    function announce(event: Event) {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.provider || !detail.info?.uuid || !detail.info?.name) return;
      addWallet({ id: detail.info.uuid, name: detail.info.name, provider: detail.provider });
    }

    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const timer = window.setTimeout(() => {
      if (window.okxwallet) {
        addWallet({ id: "legacy:okx", name: "OKX Wallet", provider: window.okxwallet });
      }
      const injected = window.ethereum?.providers?.length
        ? window.ethereum.providers
        : window.ethereum
          ? [window.ethereum]
          : [];
      injected.forEach((provider, index) => {
        const name = provider.isOkxWallet
          ? "OKX Wallet"
          : provider.isMetaMask
            ? "MetaMask"
            : provider.isCoinbaseWallet
              ? "Coinbase Wallet"
              : `Browser wallet ${index + 1}`;
        addWallet({ id: `legacy:${name.toLowerCase().replaceAll(" ", "-")}:${index}`, name, provider });
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("eip6963:announceProvider", announce);
    };
  }, []);

  useEffect(() => {
    publicClient
      .getBlockNumber()
      .then(() => setState((current) => ({ ...current, rpcOnline: true })))
      .catch(() => setState((current) => ({ ...current, rpcOnline: false })));

    const provider = selectedWallet?.provider;
    if (!provider) return;
    syncWallet(false, provider).catch(() => undefined);

    const handleAccounts = () => syncWallet(false, provider).catch(() => undefined);
    const handleChain = () => syncWallet(false, provider).catch(() => undefined);
    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [selectedWallet?.provider, syncWallet]);

  return {
    ...state,
    provider: selectedWallet?.provider,
    wallets: walletOptions.map(({ id, name }) => ({ id, name })),
    selectedWalletId,
    isArc: state.chainId === ARC_CHAIN_ID,
    connect,
    selectWallet,
    switchNetwork,
    refreshBalances: () => refreshBalances(state.account),
    clearError: () => setState((current) => ({ ...current, error: undefined })),
  };
}
