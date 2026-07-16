# Invoice Rail design-partner outreach kit

## First three profiles

1. A small agency or independent studio invoicing international clients and already receiving USDC manually.
2. A crypto-native service business using spreadsheets or chat messages to match transfers to invoices.
3. A platform or marketplace that needs payment links, signed webhooks, and accounting-ready settlement evidence.

Do not present these as customers until they explicitly agree to participate.

## Short outreach message

> I am building Invoice Rail, a non-custodial USDC/EURC invoicing workflow on Arc. It binds an invoice reference to the token transfer through Arc Memo, then independently verifies settlement and can send a signed webhook. The public Alpha now has wallet-signed USDC and EURC settlement proofs on Arc Testnet. I am looking for three design partners for a 30-minute workflow review—no purchase or wallet deposit required. Would you be open to showing me how you currently issue and reconcile stablecoin invoices?

## Interview guide

1. How do you issue an invoice and tell the payer which wallet and network to use?
2. How do you identify which obligation a transfer settled?
3. What breaks when amounts repeat, another wallet pays, or payment is partial?
4. Which evidence does finance or accounting need?
5. Do you need CSV, webhook, API, or accounting-system delivery?
6. How do you handle expiration, overpayment, refund, and failed delivery?
7. What security or compliance review blocks adoption?
8. Which part of the current Alpha would prevent a real pilot?
9. What would make a four-week pilot successful?
10. Would you pay for workspace controls, reporting, webhook volume, or an embedded API?

## Evidence tracker

| Slot | Profile | Contact | Status | Main pain | Pilot condition |
| --- | --- | --- | --- | --- | --- |
| 1 | Scheduled-payment builder | Beyaz D. / PayWhen | Outreach prepared | Scheduling vs. invoice obligation IDs | Test scheduling/cancellation and review Memo receipt evidence |
| 2 | Operations / treasury builder | Victor Okeke / Sweep Console | Outreach prepared | Idempotent settlement events and accounting evidence | Review webhook and reconciliation workflow |
| 3 | Business milestone builder | Fatih Karaca / ArcBusiness | Outreach prepared | Milestone IDs, partial payments, and bilateral evidence | Review milestone-to-invoice mapping and receipt UX |

These are prospective reviewers discovered in the Arc builder community. They are not customers or design partners unless they explicitly opt in.
