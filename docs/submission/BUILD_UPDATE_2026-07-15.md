# Build update: making Invoice Rail operationally verifiable

Invoice Rail began as a simple question: can an Arc stablecoin transfer identify exactly which invoice it settled without trusting screenshots or manual matching?

The public Alpha answered that with an Arc Memo transaction and an independent Indexer. This hardening sprint makes the surrounding system safer to operate:

- ordered PostgreSQL migrations with checksums, concurrency locking, and transactional rollback;
- database-backed rate limits for authentication, invoice, team, webhook, payment-link, and Indexer APIs;
- structured JSON logs with request IDs and credential redaction;
- protected operational metrics for schema, invoices, webhooks, rate-limit activity, cursor, and worker heartbeat;
- alert rules for stale or failed indexing, webhook backlog, database latency, and pending migrations;
- exact transaction-hash verification and RPC failover regression for the Memo, USDC, and EURC contracts.

The verified USDC invoice remains public:

- Invoice: `IR-260715-8747A0EB3759`
- Amount: `0.01 USDC`
- Arc block: `51956775`
- Transaction: https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1

This is Arc Testnet engineering evidence, not a customer, revenue, or mainnet claim. The next proof is a wallet-signed EURC invoice followed by three design-partner workflow reviews.

Live Alpha: https://invoice-rail-web.onrender.com

Source and architecture: https://github.com/xie8266509/invoice-rail
