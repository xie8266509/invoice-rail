# Invoice Rail demo film

## Deliverable

- Length: 50.64 seconds
- Format: 1920×1080, 30 fps, H.264 video with stereo AAC audio
- Language: concise English on-screen copy; no synthetic narration
- Evidence: real Invoice Rail states, the connected Arc wallet, and the verified ArcScan receipt

## Editorial structure

| Time | Chapter | Reviewer takeaway |
| --- | --- | --- |
| 0–4s | Result first | A real Arc transaction settled in `<= 0.51s`; proof appears before the pitch. |
| 4–12s | Issue | A merchant creates a shareable USDC invoice with a deterministic reference. |
| 12–19s | Pay | The payer signs in their own wallet; Invoice Rail never receives private keys. |
| 19–27s | Bind | The Memo call binds token, recipient, amount, and invoice ID in one atomic transaction. |
| 27–34s | Verify | The invoice moves from open to paid only after the exact onchain match. |
| 34–41s | Proof | The ArcScan receipt exposes status, Memo method, block, fee, hash, and finality. |
| 41–46s | Stablecoins | Two real receipts show both USDC and EURC settling through the same verified flow. |
| 46–51s | Live alpha | Product promise, public URL, Arc Testnet status, and open-source close. |

## Creative rules

- Every product claim is paired with a real product or chain artifact.
- The film opens with proof instead of a logo animation.
- Motion is functional: it follows signing, binding, verification, and persistence.
- Music provides momentum; UI sounds mark state changes without turning the demo into a trailer.
- The UI remains readable at normal playback speed and in a silent reviewer environment.

## Live demo sequence

1. Open https://invoice-rail-web.onrender.com.
2. Connect the funded test wallet and sign in.
3. Create a `0.01 USDC` invoice with a short memo.
4. Copy the payment link and open it in a separate browser profile.
5. Connect the payer wallet, verify Arc Testnet, and sign the transaction.
6. Show the Paid state and click **View receipt**.
7. Return to the merchant workspace and refresh the invoice list.
8. Show the worker delivery only if the reviewer wants the implementation detail.

## Fallback if the live network is rate-limited

- Play the rendered film, which contains the real payment run and receipt.
- The app read client automatically fails over across dRPC, Blockdaemon, and Circle.
- If a wallet's saved Arc network is rate-limited, update its RPC to `https://rpc.drpc.testnet.arc.network`.

## Verified transaction used in the film

- Invoice: `IR-260715-8747A0EB3759`
- Amount: `0.01 USDC`
- Transaction: `0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1`
- Block: `51956775`
- Explorer result: `Success`
- Reported confirmation: `<= 0.51s`
- Testnet fee: `0.002553726 USDC`

## Second verified transaction used in the film

- Invoice: `IR-260716-7511CB3256CF`
- Amount: `0.01 EURC`
- Transaction: `0xc877dd1382a0721c0805497ae475a64c204da107e5b3e80e725cb579d6e6a493`
- Explorer result: `Success`
