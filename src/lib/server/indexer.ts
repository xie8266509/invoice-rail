import "server-only";

import { getAddress } from "viem";
import { publicClient } from "@/lib/arc";
import { memoAbi } from "@/lib/abis";
import { MEMO_CONTRACT_ADDRESS } from "@/lib/constants";
import {
  getIndexerCursor,
  getInvoiceVerificationByMemoId,
  markInvoicePaid,
  setIndexerCursor,
} from "@/lib/server/invoice-repository";

const MAX_LOG_RANGE = 9_999n;

export type IndexerResult = {
  fromBlock?: string;
  toBlock?: string;
  nextBlock: string;
  chunks: number;
  logs: number;
  payments: number;
  caughtUp: boolean;
};

type IndexerGlobal = typeof globalThis & {
  invoiceRailIndexerRun?: Promise<IndexerResult>;
};

const indexerGlobal = globalThis as IndexerGlobal;

async function executeIndexer(maxChunks: number): Promise<IndexerResult> {
  const latestBlock = await publicClient.getBlockNumber();
  const savedCursor = await getIndexerCursor();
  let cursor = savedCursor ?? latestBlock + 1n;
  if (savedCursor === null) {
    await setIndexerCursor(cursor);
  }

  const firstBlock = cursor;
  let lastProcessed: bigint | undefined;
  let chunks = 0;
  let logCount = 0;
  let paymentCount = 0;
  const blockTimestamps = new Map<bigint, string>();

  while (cursor <= latestBlock && chunks < maxChunks) {
    const toBlock = cursor + MAX_LOG_RANGE < latestBlock
      ? cursor + MAX_LOG_RANGE
      : latestBlock;
    const logs = await publicClient.getContractEvents({
      address: MEMO_CONTRACT_ADDRESS,
      abi: memoAbi,
      eventName: "Memo",
      fromBlock: cursor,
      toBlock,
    });

    for (const log of logs) {
      logCount += 1;
      if (
        !log.args.memoId ||
        !log.args.target ||
        !log.args.sender ||
        !log.args.callDataHash ||
        !log.transactionHash ||
        log.blockNumber === null ||
        log.logIndex === null
      ) {
        continue;
      }

      const stored = await getInvoiceVerificationByMemoId(log.args.memoId);
      if (!stored || stored.invoice.status === "paid") continue;
      if (
        getAddress(log.args.target) !== stored.tokenAddress ||
        log.args.callDataHash !== stored.callDataHash
      ) {
        continue;
      }

      let paidAt = blockTimestamps.get(log.blockNumber);
      if (!paidAt) {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
        paidAt = new Date(Number(block.timestamp) * 1000).toISOString();
        blockTimestamps.set(log.blockNumber, paidAt);
      }

      const inserted = await markInvoicePaid({
        invoiceId: stored.invoice.id,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        payer: getAddress(log.args.sender),
        blockNumber: log.blockNumber,
        paidAt,
      });
      if (inserted) paymentCount += 1;
    }

    lastProcessed = toBlock;
    cursor = toBlock + 1n;
    await setIndexerCursor(cursor);
    chunks += 1;
  }

  return {
    fromBlock: lastProcessed === undefined ? undefined : firstBlock.toString(),
    toBlock: lastProcessed?.toString(),
    nextBlock: cursor.toString(),
    chunks,
    logs: logCount,
    payments: paymentCount,
    caughtUp: cursor > latestBlock,
  };
}

export async function runArcIndexer(maxChunks = 4): Promise<IndexerResult> {
  if (!indexerGlobal.invoiceRailIndexerRun) {
    indexerGlobal.invoiceRailIndexerRun = executeIndexer(maxChunks).finally(() => {
      indexerGlobal.invoiceRailIndexerRun = undefined;
    });
  }
  return indexerGlobal.invoiceRailIndexerRun;
}
