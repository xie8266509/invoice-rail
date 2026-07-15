# Invoice Rail — project overview

## One-line pitch

Invoice Rail turns stablecoin transfers into finance-ready invoices by binding USDC or EURC payment data to a verifiable invoice reference in one Arc transaction.

## 50-word description

Invoice Rail is a non-custodial stablecoin invoicing and reconciliation application on Arc. Merchants issue payment links, payers sign with their own wallets, and an independent worker verifies Arc Memo events before marking invoices paid. Teams get role-based access, CSV exports, signed webhooks, and durable PostgreSQL records.

## The problem

Stablecoin payment settlement is fast; operational reconciliation is not. A transfer normally tells a business the sender, recipient, asset, and amount, but not reliably which invoice, order, milestone, or customer obligation it settled. Amount-and-address matching breaks when payments repeat or come from a different wallet.

## The solution

Invoice Rail derives a deterministic `memoId` from the invoice ID and hashes the exact ERC-20 transfer calldata. The payer sends both through Arc's predeployed Memo contract. The token transfer and invoice reference are atomic, while the indexer independently verifies the memo ID, token contract, recipient, and amount before changing the invoice state.

## Product flow

1. Merchant signs in with a wallet.
2. Merchant creates a USDC or EURC invoice.
3. Invoice Rail returns a random short payment link.
4. Payer opens the link and signs one Arc transaction.
5. The app displays the finalized ArcScan receipt.
6. The worker persists the payment and can send a signed webhook.

## Who it is for

- Freelancers and agencies collecting stablecoin milestone payments
- Exporters and remote service businesses that need invoice-level references
- Stablecoin-native platforms that need a payment-link and webhook primitive
- Finance and operations teams reconciling wallets with internal systems

## Why it is different

- **Onchain reconciliation, not a note in a database:** settlement proof is recoverable from Arc.
- **Exact payment verification:** the indexer verifies the token target and transfer calldata hash, not only an invoice label.
- **Non-custodial:** Invoice Rail never handles keys or signs for users.
- **Operationally useful:** PostgreSQL, teams, CSV, webhooks, idempotent indexing, and retry queues are already implemented.
- **No custom settlement contract:** the Alpha reuses Arc's Memo primitive and keeps the audit surface small.

## Why Arc

Arc combines the properties this workflow needs in one place: USDC-denominated gas, deterministic fast finality, EVM wallet compatibility, and a native Memo primitive designed for transaction context. The same chain can become the canonical reconciliation layer when future Circle App Kit flows collect USDC from other networks.

## Verifiable progress

- Public web, API, worker, and managed PostgreSQL deployment
- Live `0.01 USDC` Arc Testnet payment
- Successful transaction in block `51956775`
- Explorer-reported confirmation within `<= 0.51s`
- Worker observed one matching log and persisted one payment
- Automated tests for domain validation, authentication boundaries, roles, webhook lifecycle, CSV safety, and RPC error handling
- GitHub Actions, Docker deployment, health checks, and multi-provider RPC fallback

Verified receipt: https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1

## Business model hypothesis

The Alpha is free and testnet-only. A production model can combine:

- A subscription for workspaces, reporting, accounting exports, and support
- Usage-based pricing for settled invoices and webhook volume
- Platform pricing for embedded payment links, APIs, and branded checkout
- Enterprise plans for dedicated RPC, compliance integrations, SLAs, and data retention

No revenue or customer traction is claimed at this stage.

## Go-to-market wedge

Start with small agencies, exporters, and crypto-native service firms already receiving USDC manually. Their pain is visible and measurable: time spent asking for transaction hashes, matching transfers, and updating invoices. Use three design partners to validate workflow, exports, webhook integrations, and willingness to pay before expanding into embedded platform APIs.

## Twelve-month direction

- Months 1–3: operational hardening, search, delivery history, webhook replay, and design partners
- Months 4–6: partial payments, refunds, accounting exports, and embedded API documentation
- Months 7–9: Circle App Kit source-chain collection with Arc settlement
- Months 10–12: security review, production pilot, SDKs, and enterprise deployment controls

## 中文摘要

Invoice Rail 是一个部署在 Arc 上的非托管稳定币发票与链上对账系统。商户创建 USDC/EURC 发票并分享付款链接；付款人通过自己的钱包签名；系统使用 Arc Memo 合约把发票编号和精确转账数据原子绑定，再由独立 Worker 验证事件、更新发票并发送 Webhook。
