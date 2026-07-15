import type { Address } from "viem";

export const ARC_CHAIN_ID = 5_042_002;
export const ARC_CHAIN_ID_HEX = "0x4cef52";
export const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";

export const MEMO_CONTRACT_ADDRESS =
  "0x5294E9927c3306DcBaDb03fe70b92e01cCede505" satisfies Address;

export const TOKENS = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000" as Address,
    decimals: 6,
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address,
    decimals: 6,
  },
} as const;

export type TokenSymbol = keyof typeof TOKENS;

export const INVOICE_STORAGE_KEY = "invoice-rail:invoices:v1";
export const THEME_STORAGE_KEY = "invoice-rail:theme";
