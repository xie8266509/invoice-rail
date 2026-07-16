import type { EIP1193Provider } from "viem";

export type EthereumRequestArguments = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type EthereumProvider = EIP1193Provider & {
  isCoinbaseWallet?: boolean;
  isMetaMask?: boolean;
  isOkxWallet?: boolean;
  on?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
};

export type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon?: string;
  rdns?: string;
};

export type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: EthereumProvider;
  }
}

export {};
