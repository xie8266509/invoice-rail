# Arc ecosystem grant / Builders Fund proposal — Invoice Rail

## Executive summary

Invoice Rail is a non-custodial stablecoin invoicing and reconciliation application built around Arc's transaction Memo primitive. It converts a wallet transfer into a durable business record by atomically binding the token transfer to a deterministic invoice reference, then independently verifying and persisting settlement.

The public Alpha already runs as separate web and worker services with managed PostgreSQL. A live `0.01 USDC` transaction was confirmed in Arc block `51956775`; ArcScan reported success within `<= 0.51s`, and the worker indexed the Memo event and marked the invoice paid.

**Funding request:** `$50,000` milestone-based support over 16 weeks.

**Primary outcome:** a security-reviewed pilot release with three design partners, production operations, accounting-ready exception flows, and Circle App Kit source-chain collection settling to Arc.

## Problem

Businesses receiving stablecoins still reconcile payments with spreadsheets, transaction hashes, screenshots, and manual messages. A transfer does not reliably encode which invoice or obligation it settles. Repeated amounts, third-party payers, and multi-wallet operations make address-and-amount matching brittle.

This operational gap blocks stablecoin payments from feeling like dependable financial infrastructure.

## Solution

Invoice Rail creates a deterministic invoice ID and exact ERC-20 transfer calldata hash. The payer calls Arc's predeployed Memo contract with the token call and invoice memo. The transfer and Memo event are atomic. A cursor-based worker independently verifies the contract, memo ID, token target, recipient, amount, transaction hash, and log index before persisting payment.

The product wraps this proof in tools businesses need: payment links, wallet authentication, role-based workspaces, CSV export, signed webhooks, retries, receipts, and durable PostgreSQL records.

## Why Arc

- The predeployed Memo primitive is central to the reconciliation design.
- Deterministic fast finality removes reorg ambiguity from invoice state.
- USDC-native gas keeps settlement costs dollar-denominated.
- EVM compatibility enables mainstream browser-wallet workflows.
- Circle App Kit can extend payer reach while Arc remains the canonical ledger.

Without Arc's Memo and stablecoin-native execution model, Invoice Rail would need a custom settlement contract or an offchain reference database with weaker portability.

## Current progress

- Public application: https://invoice-rail-web.onrender.com
- Open source: https://github.com/xie8266509/invoice-rail
- Verified receipt: https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1
- Managed PostgreSQL 17, web service, and independent worker live on Render
- Wallet challenge authentication and role-based workspaces
- Idempotent event indexing and signed webhook outbox
- Multi-provider Arc RPC failover
- Automated tests, Docker release, health checks, and CI

No customer, revenue, or production-volume claims are made.

## Milestones and acceptance criteria

### Milestone 1 — Production operations and security baseline

**Weeks 1–4 · `$12,500`**

- Ordered database migrations and rollback procedure
- Structured logs, metrics, alerts, service-level dashboards, and RPC monitoring
- Application and API rate limits
- EURC funded-wallet regression and wallet compatibility matrix
- External security review scope and threat-model package

**Acceptance:** 30-day testnet environment with health monitoring, migration rehearsal, incident runbook, and reproducible USDC/EURC test evidence.

### Milestone 2 — Finance operations workflow

**Weeks 5–8 · `$12,500`**

- Search, filters, delivery history, and webhook dead-letter replay
- Partial-payment, overpayment, expiration, and refund state machine
- Immutable audit events for state changes
- Accounting-ready CSV and one initial integration format

**Acceptance:** automated tests and a recorded workflow covering normal payment, exception handling, export, and webhook recovery.

### Milestone 3 — Cross-chain collection to Arc

**Weeks 9–12 · `$15,000`**

- Circle App Kit source-chain route prototype
- Clear fee, timing, source-chain, and recovery UX
- Arc retained as canonical settlement and reconciliation source
- Failure and replay handling documented

**Acceptance:** two source-chain test flows that settle and reconcile to Arc with linked receipts.

### Milestone 4 — Pilots, SDK, and launch package

**Weeks 13–16 · `$10,000`**

- Three design-partner pilots or documented pilot commitments
- Embedded payment-link and webhook integration guide
- TypeScript SDK for invoice creation and webhook verification
- Public case-study template, production checklist, and final demo

**Acceptance:** three partner feedback reports, published SDK documentation, and a production-readiness review.

## Target outcomes

- Three design partners completing testnet workflows
- At least 100 testnet invoices across pilot scenarios
- 95% of finalized matching payments reflected in the application within five seconds
- 99% worker availability measured over a rolling 30-day pilot window
- USDC and EURC wallet regression across at least three EIP-1193 wallets
- Two Circle App Kit source-chain settlement demonstrations
- One scoped independent security assessment

These are goals, not current results.

## Budget

| Category | Amount | Use |
| --- | ---: | --- |
| Product and protocol engineering | `$30,000` | Milestones, SDK, exception flows, App Kit integration |
| Security review and remediation | `$8,000` | Threat review, external assessment, fixes |
| Design partner research and UX | `$5,000` | Workflow research, usability testing, pilot support |
| Infrastructure and RPC | `$4,000` | Managed services, monitoring, dedicated RPC experiments |
| Documentation and ecosystem enablement | `$3,000` | Guides, examples, workshops, launch material |
| **Total** | **`$50,000`** | |

## Sustainability

The proposed long-term model is workspace SaaS plus usage-based API pricing. Small teams can pay for reporting, exports, and operational controls; platforms can pay for embedded checkout, webhook volume, branded flows, and service guarantees. The core Arc Memo verification pattern and reference implementation will remain open for ecosystem reuse.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Public RPC limits | Multi-provider fallback now; dedicated RPC and monitoring in Milestone 1 |
| Wallet inconsistency | Compatibility matrix, actionable remediation, embedded-wallet investigation |
| Memo or network changes | Pin official addresses, startup checks, release checklist, Arc technical review |
| Incorrect reconciliation | Exact calldata-hash verification, event-source validation, idempotent payment keys |
| Webhook abuse | HMAC signatures, HTTPS-only endpoints, retry limits, network egress controls |
| Premature real-fund use | Persistent testnet labeling, security review before mainnet, staged pilots |

## Ecosystem benefit

The work produces more than one application: a reusable Arc Memo payment pattern, an idempotent indexer, a webhook verification example, wallet failure guidance, and an operational architecture that other stablecoin builders can adapt.

## Support requested beyond capital

- Arc Memo and account-abstraction technical review
- Circle App Kit integration guidance
- Dedicated or partner RPC introductions
- Stablecoin operations design partners
- Security-review and compliance ecosystem referrals

## Contact and links

- Project contact: https://github.com/xie8266509
- Demo video: https://www.youtube.com/watch?v=zqCK5EUnowc
- Live app: https://invoice-rail-web.onrender.com
- Repository: https://github.com/xie8266509/invoice-rail
- Architecture: https://github.com/xie8266509/invoice-rail/blob/main/docs/ARCHITECTURE.md
- Transaction proof: https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1
