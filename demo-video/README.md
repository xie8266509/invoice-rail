# Invoice Rail demo video

This Remotion project renders a 51-second reviewer-facing product film from a real Arc Testnet payment run and its verified ArcScan receipt. The film deliberately uses no synthetic narration: the story is carried by the product, proof, typography, music, and restrained UI sound.

## Install and preview

```bash
pnpm install
pnpm audio:fetch
pnpm dev
```

## Render

```bash
pnpm lint
pnpm still
pnpm render
```

The final video is written to `out/invoice-rail-demo.mp4`. Copy it to `../docs/assets/` for the repository submission package.

## Source evidence

- `public/v2/invoice-open.png`: real open-invoice state from the verified run
- `public/v2/dashboard-paid-wallet.png`: real Invoice Rail dashboard with the Arc wallet session
- `public/v2/invoice-paid.png`: real paid receipt for the verified invoice
- `public/v2/arcscan-receipt.png`: ArcScan transaction details
- `public/v2/audio/`: licensed music and UI sound effects; see `public/v2/audio/CREDITS.md`. The Mixkit music file is fetched locally and is not redistributed as a standalone stock asset.

Transaction: `0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1`
