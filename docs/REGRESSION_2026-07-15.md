# Milestone 1 regression evidence — 2026-07-15

This record separates automated evidence from wallet-signed evidence. It does not claim production customers, revenue, or mainnet use.

## Engineering baseline

- `pnpm check`: 24 tests passed, ESLint passed, TypeScript passed, and the Next.js production build completed.
- Fresh PGlite database migrated from version 0 to version 4.
- Re-running migrations was idempotent.
- A deliberately failing version 5 migration rolled back its DDL and version record.
- An existing Alpha invoice row survived adoption into the migration ledger.

## API and operational controls

- `/api/health` returned HTTP `200`, schema version `4`, and no alerts after a healthy worker cycle.
- `/api/metrics` rejected a request without its bearer secret and returned metrics with the correct secret.
- The first 10 authentication challenge requests in a one-minute bucket succeeded; request 11 returned HTTP `429`.
- Structured logs included request IDs and did not print authorization values, cookies, signatures, webhook secrets, or session tokens.
- The Indexer wrote a persistent healthy heartbeat with cursor block `52039440`.
- After a web-process restart, the migration version, cursor, heartbeat, and rate-limit cleanup state remained readable.
- A stale heartbeat produced `indexer_stale`; a later healthy Indexer cycle cleared the alert.

## Arc and stablecoin evidence

- `pnpm verify:assets` succeeded with the preferred RPC deliberately pointed at `127.0.0.1:1`, proving fallback to another configured Arc provider.
- Verified Arc Testnet chain ID: `5042002`.
- Verified the Memo predeploy contains contract bytecode.
- Verified USDC and EURC contracts contain bytecode, report the expected symbols, and use 6 decimals.
- Asset preflight block: `52039365`.
- Re-verified invoice `IR-260715-8747A0EB3759` directly from transaction `0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1`.
- The exact Memo event matched the USDC token target, invoice memo ID, recipient/amount calldata hash, and block `51956775`.

## Remaining wallet-signed evidence

The known wallet has public USDC payment evidence. A real EURC Memo payment still requires Arc Testnet EURC in a user-controlled wallet and an explicit wallet signature. Contract preflight is complete, but this document does not mislabel contract availability as a completed EURC payment.
