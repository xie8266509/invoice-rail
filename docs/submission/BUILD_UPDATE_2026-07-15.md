# Build update: making Invoice Rail operationally verifiable

Invoice Rail began as a simple question: can an Arc stablecoin transfer identify exactly which invoice it settled without trusting screenshots or manual matching?

The public Alpha answered that with an Arc Memo transaction and an independent Indexer. This hardening sprint makes the surrounding system safer to operate:

- ordered PostgreSQL migrations with checksums, concurrency locking, and transactional rollback;
- database-backed rate limits for authentication, invoice, team, webhook, payment-link, and Indexer APIs;
- structured JSON logs with request IDs and credential redaction;
- protected operational metrics for schema, invoices, webhooks, rate-limit activity, cursor, and worker heartbeat;
- alert rules for stale or failed indexing, webhook backlog, database latency, and pending migrations;
- exact transaction-hash verification and RPC failover regression for the Memo, USDC, and EURC contracts.

Two wallet-signed settlement proofs are now public:

- Invoice: `IR-260715-8747A0EB3759`
- Amount: `0.01 USDC`
- Arc block: `51956775`
- Transaction: https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1
- Invoice: `IR-260716-7511CB3256CF`
- Amount: `0.01 EURC`
- Paid at: `2026-07-16 09:53:06 UTC`
- Transaction: https://testnet.arcscan.app/tx/0xc877dd1382a0721c0805497ae475a64c204da107e5b3e80e725cb579d6e6a493

This is Arc Testnet engineering evidence, not a customer, revenue, or mainnet claim. The next proof is three design-partner workflow reviews covering scheduled payments, operational reconciliation, and milestone evidence.

Live Alpha: https://invoice-rail-web.onrender.com

Source and architecture: https://github.com/xie8266509/invoice-rail
