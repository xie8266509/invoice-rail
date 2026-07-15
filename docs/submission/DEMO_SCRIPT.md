# Invoice Rail demo script

## Deliverable

- Length: approximately 75 seconds
- Format: 1920×1080, 30 fps, H.264 MP4
- Language: English narration with English on-screen copy
- Evidence: production UI and the verified ArcScan receipt

## Timeline

| Time | Visual | Narration |
| --- | --- | --- |
| 0–7s | Invoice Rail title and product promise | “Stablecoin settlement is fast. Reconciliation is manual. Invoice Rail makes Arc payments finance-ready.” |
| 7–18s | Problem statement and mismatched-transfer visual | “Wallet transfers normally show an address and amount, but not which invoice they settle—especially when amounts repeat or another wallet pays.” |
| 18–33s | Production invoice screen | “A merchant creates a USDC or EURC invoice, stores it in a team workspace, and shares a short payment link. Invoice Rail never receives private keys.” |
| 33–47s | Architecture flow | “The payer signs one Arc Memo transaction. The invoice ID and exact transfer calldata are bound to the token transfer atomically.” |
| 47–60s | Production Paid screen | “A separate worker verifies the Memo contract, token, recipient, amount, transaction hash, and log index before marking the invoice paid.” |
| 60–69s | ArcScan receipt | “This live test payment succeeded on Arc. ArcScan reported confirmation within point five one seconds.” |
| 69–76s | Closing card and links | “Invoice Rail is live on Arc: non-custodial invoicing with exact onchain reconciliation.” |

## Live demo sequence

1. Open https://invoice-rail-web.onrender.com.
2. Connect the funded test wallet and sign in.
3. Create a `0.01 USDC` invoice with a short memo.
4. Copy the short payment link and open it in a separate browser profile.
5. Connect the payer wallet, verify Arc Testnet, and sign the transaction.
6. Show the Paid state and click View receipt.
7. Return to the merchant workspace and refresh the invoice list.
8. Show the worker log or webhook delivery only if time permits.

## Fallback if the live network is rate-limited

- Use the rendered video, which contains the real production screens and receipt.
- The app read client automatically fails over across dRPC, Blockdaemon, and Circle.
- If a wallet's saved Arc network is rate-limited, update its RPC to `https://rpc.drpc.testnet.arc.network`.

## Verified transaction used in the video

- Invoice: `IR-260715-8747A0EB3759`
- Amount: `0.01 USDC`
- Transaction: `0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1`
- Block: `51956775`
- Explorer result: `Success`
- Reported confirmation: `<= 0.51s`
- Testnet fee: `0.002553726 USDC`
