# Day One Architects application — Invoice Rail

This is a paste-ready nomination and builder-spotlight answer bank. Day One Architects is presented publicly as a spotlight and ecosystem series rather than a fixed open application form, so the sections below are designed for outreach, nomination, or an interview intake.

## Project

- **Name:** Invoice Rail
- **Category:** Stablecoin payments / invoicing / financial operations
- **Stage:** Public Arc Testnet Alpha
- **Live product:** https://invoice-rail-web.onrender.com
- **Source:** https://github.com/xie8266509/invoice-rail
- **Verified transaction:** https://testnet.arcscan.app/tx/0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1
- **Contact:** https://github.com/xie8266509

## What are you building?

Invoice Rail is a non-custodial stablecoin invoicing and reconciliation layer on Arc. A merchant creates a USDC or EURC payment request and shares a short link. The payer signs one Arc Memo transaction from their own wallet. Invoice Rail then verifies the Memo event, token contract, recipient, amount, and transfer calldata hash before marking the invoice paid and notifying downstream systems.

The product already includes wallet-signature authentication, role-based workspaces, managed PostgreSQL, an independent indexer, signed webhooks with retries, CSV export, receipt links, and multi-provider Arc RPC failover.

## What problem does it solve?

Stablecoin transfers lack the invoice-level context finance teams need. Manually matching amounts, addresses, screenshots, and transaction hashes is slow and error-prone, particularly when amounts repeat or a third party pays. Invoice Rail makes the invoice reference part of the settlement proof and turns it into a durable operational record.

## Why does this need Arc?

Arc is not a generic deployment target for Invoice Rail; its design is the product advantage:

- Arc's Memo primitive atomically connects settlement and invoice context.
- USDC-native gas keeps costs legible to finance teams.
- Deterministic sub-second finality lets the application treat settlement as an immediate operational fact.
- EVM compatibility preserves familiar wallets and TypeScript tooling.
- Arc can remain the canonical settlement and reconciliation layer as Circle App Kit adds source-chain flexibility.

## What has been demonstrated?

The complete production-shaped testnet loop is live:

- public Next.js web and API service;
- separate continuously running indexer and webhook worker;
- private managed PostgreSQL 17;
- a successful `0.01 USDC` payment in Arc block `51956775`;
- ArcScan confirmation within `<= 0.51s`;
- automatic detection of one Memo log and persistence of one matching payment;
- a paid invoice UI linked to the public transaction receipt.

No user, volume, or revenue traction is claimed yet.

## How would Invoice Rail contribute to the Arc ecosystem?

1. Provide a reference implementation for Arc Memo-based business payments.
2. Turn Arc settlement into a reusable invoice, webhook, and accounting workflow.
3. Publish practical guidance for wallet RPC failure handling, event indexing, and exact calldata verification.
4. Create an integration wedge for agencies, exporters, and software platforms that already use USDC.
5. Demonstrate how Circle App Kit collection can still reconcile to one canonical Arc ledger.

## What could you show in a Day One Architect session?

- Create and share an invoice live.
- Walk through the exact `Memo.memo(...)` call.
- Pay with a browser wallet and open the ArcScan receipt.
- Show the worker detecting the event and changing the invoice to Paid.
- Explain the security boundary, idempotency model, and webhook signature.
- Discuss the roadmap from a payment demo to production finance operations.

## 90-day build plan

- **Days 1–30:** versioned migrations, structured logs, metrics, alerts, rate limits, and EURC regression.
- **Days 31–60:** invoice search, delivery history, webhook replay, partial-payment and refund state design.
- **Days 61–90:** three design-partner workflows, accounting exports, and a Circle App Kit source-chain prototype settling to Arc.

## Support requested from Arc

- Technical review of Memo indexing and smart-account compatibility
- Introductions to Circle App Kit and wallet infrastructure teams
- Three design partners in stablecoin payments or financial operations
- RPC and testnet reliability guidance
- Feedback on the path to a security review and production launch

## Public spotlight blurb

Invoice Rail turns Arc stablecoin transfers into finance-ready invoices. Merchants issue USDC or EURC payment links, payers sign with their own wallets, and an independent worker verifies Arc Memo events before marking invoices paid. The public Alpha includes team roles, PostgreSQL, signed webhooks, CSV export, and a verified sub-second Arc Testnet payment—all without custodying funds or deploying a custom settlement contract.

## Short outreach message

Subject: Day One Architects nomination — Invoice Rail

Invoice Rail is a live Arc Testnet Alpha for non-custodial stablecoin invoicing and onchain reconciliation. We have completed a public end-to-end USDC payment using Arc Memo, with a separate indexer, managed PostgreSQL, signed webhooks, and a verifiable ArcScan receipt. We would like to contribute the implementation as a builder reference and present the product in a Day One Architect session. Live app, source, architecture, and demo are available in the project repository.
