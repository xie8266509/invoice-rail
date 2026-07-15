# Invoice Rail demo video

This Remotion project renders the reviewer-facing Invoice Rail demo from real production screenshots and a verified ArcScan receipt.

## Install and preview

```bash
npm install
npm run dev
```

## Render

```bash
npm run lint
npm run still
npm run render
```

The final video is written to `out/invoice-rail-demo.mp4`. Copy it to `../docs/assets/` for the repository submission package.

## Source evidence

- `public/production-home.png`: deployed invoice creation UI
- `public/production-paid.png`: deployed Paid state for the verified invoice
- `public/arcscan-receipt.png`: ArcScan transaction details
- `public/captions.json`: frame-aligned reviewer captions
- `public/voiceover/`: locally generated English narration, one file per scene

Transaction: `0x8c931d33318139415076fd52230d0a05cff2ebdc287ae964d10732d6980218c1`
