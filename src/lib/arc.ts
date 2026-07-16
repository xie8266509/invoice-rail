import {
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  fallback,
  formatUnits,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { arcTestnet } from "viem/chains";
import { memoAbi } from "@/lib/abis";
import {
  ARC_CHAIN_ID_HEX,
  ARC_EXPLORER_URL,
  ARC_RPC_URLS,
  MEMO_CONTRACT_ADDRESS,
  TOKENS,
  type TokenSymbol,
} from "@/lib/constants";
import {
  getCallDataHash,
  getMemoData,
  getMemoId,
  getTransferData,
  type Invoice,
  type ShareableInvoice,
} from "@/lib/invoice";
import type { EthereumProvider } from "@/types/ethereum";

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: fallback(
    ARC_RPC_URLS.map((url) => http(url, { retryCount: 0, timeout: 5_000 })),
  ),
});

export type WalletSnapshot = {
  account?: Address;
  chainId?: number;
};

export type TokenBalances = Record<TokenSymbol, string | undefined>;

export type TokenBalanceSnapshot = {
  balances: TokenBalances;
  unavailable: TokenSymbol[];
};

function requireProvider(provider?: EthereumProvider): EthereumProvider {
  if (!provider) {
    throw new Error("Install MetaMask, Rabby, Coinbase Wallet, or Rainbow to continue.");
  }
  return provider;
}

export async function getWalletSnapshot(
  injectedProvider: EthereumProvider | undefined,
  requestAccess = false,
): Promise<WalletSnapshot> {
  const provider = requireProvider(injectedProvider);
  const accounts = (await provider.request({
    method: requestAccess ? "eth_requestAccounts" : "eth_accounts",
  })) as string[];
  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  return {
    account: accounts[0] ? getAddress(accounts[0]) : undefined,
    chainId: Number.parseInt(chainHex, 16),
  };
}

export async function switchToArcTestnet(injectedProvider?: EthereumProvider): Promise<void> {
  const provider = requireProvider(injectedProvider);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID_HEX }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ARC_CHAIN_ID_HEX,
          chainName: "Arc Testnet",
          nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
          rpcUrls: ARC_RPC_URLS,
          blockExplorerUrls: [ARC_EXPLORER_URL],
        },
      ],
    });
  }
}

export async function getTokenBalances(account: Address): Promise<TokenBalanceSnapshot> {
  const symbols = Object.keys(TOKENS) as TokenSymbol[];
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const token = TOKENS[symbol];
      const balance = await publicClient.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
      });
      return [symbol, formatUnits(balance, token.decimals)] as const;
    }),
  );
  const balances = Object.fromEntries(
    symbols.map((symbol) => [symbol, undefined]),
  ) as TokenBalances;
  const unavailable: TokenSymbol[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      balances[result.value[0]] = result.value[1];
    } else {
      unavailable.push(symbols[index]);
    }
  });
  return { balances, unavailable };
}

export async function getArcBlockNumber(): Promise<bigint> {
  return publicClient.getBlockNumber();
}

export async function signMerchantMessage(
  injectedProvider: EthereumProvider | undefined,
  account: Address,
  message: string,
): Promise<Hex> {
  const provider = requireProvider(injectedProvider);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(provider),
  });
  return walletClient.signMessage({ account, message });
}

export async function payInvoice(
  injectedProvider: EthereumProvider | undefined,
  invoice: ShareableInvoice,
): Promise<{
  hash: Hex;
  blockNumber: bigint;
}> {
  const provider = requireProvider(injectedProvider);
  await switchToArcTestnet(provider);
  const snapshot = await getWalletSnapshot(provider, true);
  if (!snapshot.account) throw new Error("Connect a wallet before paying.");

  const token = TOKENS[invoice.token];
  const transferData = getTransferData(invoice);
  const walletClient = createWalletClient({
    account: snapshot.account,
    chain: arcTestnet,
    transport: custom(provider),
  });

  const hash = await walletClient.writeContract({
    address: MEMO_CONTRACT_ADDRESS,
    abi: memoAbi,
    functionName: "memo",
    args: [token.address, transferData, getMemoId(invoice.id), getMemoData(invoice)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("The payment transaction reverted.");
  }
  return { hash, blockNumber: receipt.blockNumber };
}

export async function findInvoicePayment(
  invoice: ShareableInvoice,
): Promise<Pick<Invoice, "txHash" | "paidAt"> | null> {
  const latest = await publicClient.getBlockNumber();
  const fallbackStart = latest > 100_000n ? latest - 100_000n : 0n;
  const fromBlock = invoice.createdBlock ? BigInt(invoice.createdBlock) : fallbackStart;
  const expectedHash = getCallDataHash(invoice);
  const tokenAddress = TOKENS[invoice.token].address.toLowerCase();
  const maxRange = 9_999n;
  let toBlock = latest;

  while (toBlock >= fromBlock) {
    const chunkStart = toBlock - fromBlock > maxRange ? toBlock - maxRange : fromBlock;
    const logs = await publicClient.getContractEvents({
      address: MEMO_CONTRACT_ADDRESS,
      abi: memoAbi,
      eventName: "Memo",
      args: { memoId: getMemoId(invoice.id) },
      fromBlock: chunkStart,
      toBlock,
    });
    const match = logs.find(
      (log) =>
        log.args.target?.toLowerCase() === tokenAddress &&
        log.args.callDataHash === expectedHash,
    );

    if (match?.transactionHash && match.blockNumber) {
      const block = await publicClient.getBlock({ blockNumber: match.blockNumber });
      return {
        txHash: match.transactionHash,
        paidAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      };
    }
    if (chunkStart === fromBlock) break;
    toBlock = chunkStart - 1n;
  }

  return null;
}
