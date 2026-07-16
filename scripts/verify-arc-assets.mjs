import {
  createPublicClient,
  erc20Abi,
  fallback,
  http,
} from "viem";
import { arcTestnet } from "viem/chains";

const configured = process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim();
const rpcUrls = Array.from(new Set([
  configured,
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.testnet.arc.network",
].filter(Boolean)));
const memoAddress = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const tokens = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
};
const client = createPublicClient({
  chain: arcTestnet,
  transport: fallback(rpcUrls.map((url) => http(url, { retryCount: 0, timeout: 5_000 }))),
});

const [chainId, blockNumber, memoCode, tokenResults] = await Promise.all([
  client.getChainId(),
  client.getBlockNumber(),
  client.getCode({ address: memoAddress }),
  Promise.all(Object.entries(tokens).map(async ([expectedSymbol, address]) => {
    const [symbol, decimals, code] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
      client.getCode({ address }),
    ]);
    return {
      expectedSymbol,
      address,
      symbol,
      decimals,
      contractDeployed: Boolean(code && code !== "0x"),
    };
  })),
]);

const result = {
  status: "ok",
  chainId,
  blockNumber: blockNumber.toString(),
  memo: {
    address: memoAddress,
    contractDeployed: Boolean(memoCode && memoCode !== "0x"),
  },
  tokens: tokenResults,
  rpcFallbacksConfigured: rpcUrls.length,
};

if (
  chainId !== 5_042_002 ||
  !result.memo.contractDeployed ||
  tokenResults.some((token) =>
    !token.contractDeployed || token.symbol !== token.expectedSymbol || token.decimals !== 6
  )
) {
  result.status = "failed";
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
