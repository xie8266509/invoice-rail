"use client";

import { useCallback, useEffect, useState } from "react";
import { getAddress, type Address } from "viem";
import { signMerchantMessage } from "@/lib/arc";
import type { EthereumProvider } from "@/types/ethereum";

export type MerchantSessionStatus =
  | "idle"
  | "checking"
  | "unauthenticated"
  | "signing"
  | "authenticated";

type SessionState = {
  status: MerchantSessionStatus;
  address?: Address;
  error?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Wallet sign-in failed.";
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

export function useMerchantSession(account?: Address, provider?: EthereumProvider) {
  const [state, setState] = useState<SessionState>({ status: "idle" });

  const checkSession = useCallback(async (expectedAccount: Address) => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const body = await responseBody(response);
    const sessionAddress = typeof body.address === "string" ? getAddress(body.address) : undefined;
    const authenticated =
      response.ok &&
      body.authenticated === true &&
      sessionAddress?.toLowerCase() === expectedAccount.toLowerCase();
    return authenticated ? sessionAddress : undefined;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!account) {
      const timer = window.setTimeout(() => setState({ status: "idle" }), 0);
      return () => window.clearTimeout(timer);
    }

    const expectedAccount = account;
    const timer = window.setTimeout(() => {
      setState({ status: "checking" });
      checkSession(expectedAccount)
        .then((address) => {
          if (!cancelled) {
            setState(address ? { status: "authenticated", address } : { status: "unauthenticated" });
          }
        })
        .catch((error) => {
          if (!cancelled) setState({ status: "unauthenticated", error: errorMessage(error) });
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [account, checkSession]);

  const signIn = useCallback(async (): Promise<Address> => {
    if (!account) throw new Error("Connect a wallet before signing in.");
    setState({ status: "signing" });
    try {
      const existing = await checkSession(account);
      if (existing) {
        setState({ status: "authenticated", address: existing });
        return existing;
      }

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account }),
      });
      const challenge = await responseBody(challengeResponse);
      if (
        !challengeResponse.ok ||
        typeof challenge.challengeId !== "string" ||
        typeof challenge.message !== "string"
      ) {
        throw new Error(typeof challenge.error === "string" ? challenge.error : "Sign-in challenge failed.");
      }

      const signature = await signMerchantMessage(provider, account, challenge.message);
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: account,
          challengeId: challenge.challengeId,
          signature,
        }),
      });
      const verified = await responseBody(verifyResponse);
      if (!verifyResponse.ok || typeof verified.address !== "string") {
        throw new Error(typeof verified.error === "string" ? verified.error : "Wallet verification failed.");
      }
      const address = getAddress(verified.address);
      setState({ status: "authenticated", address });
      return address;
    } catch (error) {
      setState({ status: "unauthenticated", error: errorMessage(error) });
      throw error;
    }
  }, [account, checkSession, provider]);

  return {
    ...state,
    signIn,
    clearError: () => setState((current) => ({ ...current, error: undefined })),
  };
}
