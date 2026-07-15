"use client";

import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { ARC_CHAIN_ID } from "@/lib/constants";
import {
  getTokenBalances,
  getWalletSnapshot,
  publicClient,
  switchToArcTestnet,
  type TokenBalances,
} from "@/lib/arc";

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
  if (error instanceof Error) return error.message;
  return "The wallet request could not be completed.";
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connecting: false,
    loadingBalances: false,
    rpcOnline: false,
  });

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
    async (requestAccess = false) => {
      try {
        const snapshot = await getWalletSnapshot(requestAccess);
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
    [refreshBalances],
  );

  const connect = useCallback(async () => {
    setState((current) => ({ ...current, connecting: true, error: undefined }));
    return syncWallet(true);
  }, [syncWallet]);

  const switchNetwork = useCallback(async () => {
    try {
      await switchToArcTestnet();
      await syncWallet(false);
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
    }
  }, [syncWallet]);

  useEffect(() => {
    publicClient
      .getBlockNumber()
      .then(() => setState((current) => ({ ...current, rpcOnline: true })))
      .catch(() => setState((current) => ({ ...current, rpcOnline: false })));

    if (!window.ethereum) return;
    syncWallet(false).catch(() => undefined);

    const handleAccounts = () => syncWallet(false).catch(() => undefined);
    const handleChain = () => syncWallet(false).catch(() => undefined);
    window.ethereum.on?.("accountsChanged", handleAccounts);
    window.ethereum.on?.("chainChanged", handleChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window.ethereum?.removeListener?.("chainChanged", handleChain);
    };
  }, [syncWallet]);

  return {
    ...state,
    isArc: state.chainId === ARC_CHAIN_ID,
    connect,
    switchNetwork,
    refreshBalances: () => refreshBalances(state.account),
    clearError: () => setState((current) => ({ ...current, error: undefined })),
  };
}
