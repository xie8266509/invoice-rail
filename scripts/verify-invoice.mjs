import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  fallback,
  getAddress,
  http,
  keccak256,
  parseAbi,
  parseUnits,
  stringToHex,
} from "viem";
import { arcTestnet } from "viem/chains";

const RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.drpc.testnet.arc.network";
const RPC_URLS = Array.from(new Set([
  RPC_URL,
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.testnet.arc.network",
]));
const MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
};
const memoAbi = parseAbi([
  "event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)",
]);

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--") cliArgs.shift();
const [invoiceId, rawRecipient, amount, symbol = "USDC", transactionHash] = cliArgs;
if (!invoiceId || !rawRecipient || !amount || !(symbol in TOKENS)) {
  console.error(
    "Usage: pnpm verify:invoice -- <invoice-id> <recipient> <amount> [USDC|EURC] [transaction-hash]",
  );
  process.exit(1);
}
if (transactionHash && !/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
  console.error("Transaction hash must contain 32 bytes of hexadecimal data.");
  process.exit(1);
}

const recipient = getAddress(rawRecipient);
const tokenAddress = TOKENS[symbol];
const memoId = keccak256(stringToHex(invoiceId));
const transferData = encodeFunctionData({
  abi: erc20Abi,
  functionName: "transfer",
  args: [recipient, parseUnits(amount, 6)],
});
const callDataHash = keccak256(transferData);
const client = createPublicClient({
  chain: arcTestnet,
  transport: fallback(RPC_URLS.map((url) => http(url, { retryCount: 0, timeout: 5_000 }))),
});
const latestBlock = await client.getBlockNumber();
const oldestBlock = latestBlock > 100_000n ? latestBlock - 100_000n : 0n;
let toBlock = latestBlock;
let match;

if (transactionHash) {
  const receipt = await client.getTransactionReceipt({ hash: transactionHash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== MEMO_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: memoAbi, data: log.data, topics: log.topics });
      if (
        decoded.eventName === "Memo" &&
        decoded.args.memoId === memoId &&
        decoded.args.target.toLowerCase() === tokenAddress.toLowerCase() &&
        decoded.args.callDataHash === callDataHash
      ) {
        match = {
          ...log,
          args: decoded.args,
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.transactionHash,
        };
        break;
      }
    } catch {
      // Ignore unrelated logs in the same transaction.
    }
  }
}

while (!transactionHash && toBlock >= oldestBlock && !match) {
  const fromBlock = toBlock - oldestBlock > 9_999n ? toBlock - 9_999n : oldestBlock;
  const events = await client.getContractEvents({
    address: MEMO_ADDRESS,
    abi: memoAbi,
    eventName: "Memo",
    args: { memoId },
    fromBlock,
    toBlock,
  });
  match = events.find(
    (event) =>
      event.args.target?.toLowerCase() === tokenAddress.toLowerCase() &&
      event.args.callDataHash === callDataHash,
  );
  if (fromBlock === oldestBlock) break;
  toBlock = fromBlock - 1n;
}

if (!match?.transactionHash || !match.blockNumber) {
  console.error(`No exact Arc payment found for ${invoiceId}.`);
  process.exit(2);
}

const block = await client.getBlock({ blockNumber: match.blockNumber });
console.log(
  JSON.stringify(
    {
      invoiceId,
      status: "paid",
      token: symbol,
      amount,
      recipient,
      payer: match.args.sender,
      transactionHash: match.transactionHash,
      blockNumber: match.blockNumber.toString(),
      paidAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      explorer: `${arcTestnet.blockExplorers.default.url}/tx/${match.transactionHash}`,
    },
    null,
    2,
  ),
);
