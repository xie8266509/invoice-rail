import type { CSSProperties, ReactNode } from "react";
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionOverlay } from "./Captions";

const FPS = 30;
const SCENES = [
  { id: "title", frames: 210, audio: "voiceover/scene-01.mp3" },
  { id: "problem", frames: 330, audio: "voiceover/scene-02.mp3" },
  { id: "product", frames: 420, audio: "voiceover/scene-03.mp3" },
  { id: "architecture", frames: 420, audio: "voiceover/scene-04.mp3" },
  { id: "paid", frames: 390, audio: "voiceover/scene-05.mp3" },
  { id: "receipt", frames: 300, audio: "voiceover/scene-06.mp3" },
  { id: "outro", frames: 210, audio: "voiceover/scene-07.mp3" },
] as const;

const TOTAL_FRAMES = SCENES.reduce((sum, scene) => sum + scene.frames, 0);
const INK = "#10231e";
const GREEN = "#087760";
const MINT = "#d9eee8";
const PAPER = "#f3f7f5";
const MUTED = "#62736e";

const enter = (frame: number) => ({
  opacity: interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }),
  transform: `translateY(${interpolate(frame, [0, 22], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })}px)`,
});

const SceneBackground = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${78 + frame * 0.01}% 18%, rgba(104, 211, 178, 0.22), transparent 30%), linear-gradient(135deg, ${PAPER}, #eaf2ef)`,
        color: INK,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: "50%",
          right: -260,
          bottom: -310,
          background: "rgba(8, 119, 96, 0.09)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 280,
          height: 280,
          borderRadius: 80,
          rotate: "18deg",
          left: -160,
          top: 90,
          background: "rgba(241, 183, 74, 0.10)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

const Brand = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 16,
        background: MINT,
        border: "2px solid rgba(8,119,96,.22)",
        display: "grid",
        placeItems: "center",
        color: GREEN,
        fontWeight: 900,
        fontSize: 28,
      }}
    >
      IR
    </div>
    <div style={{ fontSize: 34, fontWeight: 850, letterSpacing: -1 }}>Invoice Rail</div>
  </div>
);

const Header = ({ label }: { label: string }) => (
  <div
    style={{
      position: "absolute",
      top: 54,
      left: 92,
      right: 92,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 5,
    }}
  >
    <Brand />
    <div style={{ fontSize: 27, fontWeight: 750, color: GREEN, letterSpacing: 2.2 }}>{label}</div>
  </div>
);

const ScreenshotFrame = ({
  src,
  style,
  objectFit = "contain",
}: {
  src: string;
  style?: CSSProperties;
  objectFit?: "contain" | "cover";
}) => (
  <div
    style={{
      overflow: "hidden",
      borderRadius: 34,
      border: "2px solid rgba(16,35,30,.11)",
      background: "white",
      boxShadow: "0 34px 80px rgba(24, 64, 53, 0.16)",
      ...style,
    }}
  >
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit }} />
  </div>
);

const TitleScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <div
        style={{
          padding: "140px 150px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 34,
          ...enter(frame),
        }}
      >
        <div style={{ color: GREEN, fontWeight: 850, fontSize: 34, letterSpacing: 5 }}>ARC TESTNET · LIVE ALPHA</div>
        <div style={{ fontSize: 150, fontWeight: 900, lineHeight: 0.9, letterSpacing: -9 }}>Invoice Rail</div>
        <div style={{ fontSize: 66, fontWeight: 650, lineHeight: 1.08, maxWidth: 1360 }}>
          Stablecoin invoicing with verifiable onchain reconciliation.
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 24 }}>
          {['Non-custodial', 'USDC + EURC', 'Arc Memo'].map((item) => (
            <div key={item} style={{ padding: "17px 27px", borderRadius: 999, background: "white", fontSize: 30, fontWeight: 720, boxShadow: "0 12px 34px rgba(16,35,30,.08)" }}>{item}</div>
          ))}
        </div>
      </div>
    </SceneBackground>
  );
};

const ProblemScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <Header label="THE RECONCILIATION GAP" />
      <div style={{ padding: "185px 120px 180px", display: "grid", gridTemplateColumns: "1.05fr .95fr", gap: 110, height: "100%", alignItems: "center", ...enter(frame) }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 0.98, letterSpacing: -5 }}>A transfer is not an invoice.</div>
          <div style={{ fontSize: 43, lineHeight: 1.3, color: MUTED, maxWidth: 780 }}>
            Addresses and amounts do not reliably explain which customer obligation was settled.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            ['Same amount', 'Repeated payments collide'],
            ['Different payer', 'Third parties can settle'],
            ['Manual evidence', 'Screenshots and hashes do not scale'],
          ].map(([title, detail], index) => (
            <div key={title} style={{ padding: "34px 40px", borderRadius: 28, background: index === 1 ? MINT : "white", border: "2px solid rgba(16,35,30,.08)", boxShadow: "0 18px 42px rgba(16,35,30,.08)" }}>
              <div style={{ fontSize: 39, fontWeight: 850 }}>{title}</div>
              <div style={{ fontSize: 31, color: MUTED, marginTop: 8 }}>{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </SceneBackground>
  );
};

const ProductScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <Header label="ISSUE ONCE" />
      <div style={{ padding: "160px 92px 175px", height: "100%", display: "grid", gridTemplateColumns: "1fr 440px", gap: 54, alignItems: "center", ...enter(frame) }}>
        <ScreenshotFrame src="production-home.png" style={{ height: 720 }} objectFit="cover" />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 74, fontWeight: 900, lineHeight: 1, letterSpacing: -3 }}>One request. One payment link.</div>
          {['Wallet-signed merchant session', 'USDC or EURC settlement', 'Team roles, CSV, webhooks'].map((item) => (
            <div key={item} style={{ display: "flex", gap: 18, alignItems: "flex-start", fontSize: 31, fontWeight: 650, lineHeight: 1.25 }}>
              <span style={{ width: 30, height: 30, marginTop: 3, borderRadius: "50%", background: GREEN, color: "white", display: "grid", placeItems: "center", fontSize: 19 }}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </SceneBackground>
  );
};

const ArchitectureScene = () => {
  const frame = useCurrentFrame();
  const nodes = [
    ['Merchant', 'Create invoice'],
    ['Payment link', 'Share safely'],
    ['Arc Memo', 'Atomic context'],
    ['Worker', 'Exact verification'],
    ['PostgreSQL', 'Finance record'],
  ];
  return (
    <SceneBackground>
      <Header label="RECONCILE ONCHAIN" />
      <div style={{ padding: "175px 90px 180px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 72, ...enter(frame) }}>
        <div style={{ textAlign: "center", fontSize: 82, fontWeight: 900, letterSpacing: -4 }}>Arc makes the invoice reference atomic.</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          {nodes.map(([title, detail], index) => (
            <div key={title} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 280, minHeight: 180, borderRadius: 28, padding: "34px 28px", background: index === 2 ? GREEN : "white", color: index === 2 ? "white" : INK, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", boxShadow: "0 20px 50px rgba(16,35,30,.10)" }}>
                <div style={{ fontSize: 36, fontWeight: 900 }}>{title}</div>
                <div style={{ fontSize: 27, opacity: 0.72, marginTop: 10 }}>{detail}</div>
              </div>
              {index < nodes.length - 1 ? <div style={{ fontSize: 46, color: GREEN, fontWeight: 900 }}>→</div> : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 26 }}>
          {['memoId', 'token target', 'recipient + amount', 'txHash + logIndex'].map((item) => (
            <div key={item} style={{ fontSize: 28, fontWeight: 740, padding: "15px 23px", borderRadius: 12, background: MINT, color: GREEN }}>{item}</div>
          ))}
        </div>
      </div>
    </SceneBackground>
  );
};

const PaidScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <Header label="VERIFIED PAYMENT" />
      <div style={{ padding: "150px 94px 165px", height: "100%", display: "grid", gridTemplateColumns: "1fr 520px", gap: 64, alignItems: "center", ...enter(frame) }}>
        <ScreenshotFrame src="production-paid.png" style={{ height: 760 }} objectFit="contain" />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ color: GREEN, fontSize: 34, fontWeight: 900, letterSpacing: 3 }}>PAID</div>
          <div style={{ fontSize: 98, fontWeight: 900, letterSpacing: -5 }}>0.01 <span style={{ fontSize: 46 }}>USDC</span></div>
          <div style={{ fontSize: 36, color: MUTED, lineHeight: 1.35 }}>The worker observed one Memo log and persisted one exact matching payment.</div>
          <div style={{ padding: "25px 28px", borderRadius: 22, background: "white", fontSize: 27, lineHeight: 1.5, boxShadow: "0 16px 40px rgba(16,35,30,.08)" }}>
            <b>Invoice</b><br />IR-260715-8747A0EB3759
          </div>
        </div>
      </div>
    </SceneBackground>
  );
};

const ReceiptScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <Header label="PUBLIC PROOF" />
      <div style={{ padding: "155px 92px 165px", height: "100%", display: "grid", gridTemplateColumns: "1fr 500px", gap: 58, alignItems: "center", ...enter(frame) }}>
        <ScreenshotFrame src="arcscan-receipt.png" style={{ height: 730 }} objectFit="cover" />
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ fontSize: 34, color: GREEN, fontWeight: 900, letterSpacing: 3 }}>ARCSCAN · SUCCESS</div>
          <div style={{ fontSize: 78, fontWeight: 900, lineHeight: 1.02, letterSpacing: -3 }}>Confirmed in ≤ 0.51 seconds.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {[['Block', '51956775'], ['Fee', '0.002553726 USDC']].map(([label, value]) => (
              <div key={label} style={{ background: "white", borderRadius: 20, padding: "24px 22px", boxShadow: "0 14px 34px rgba(16,35,30,.08)" }}>
                <div style={{ fontSize: 24, color: MUTED }}>{label}</div>
                <div style={{ fontSize: 30, fontWeight: 850, marginTop: 8 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneBackground>
  );
};

const OutroScene = () => {
  const frame = useCurrentFrame();
  return (
    <SceneBackground>
      <div style={{ padding: "130px 160px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 34, ...enter(frame) }}>
        <Brand />
        <div style={{ fontSize: 104, fontWeight: 900, lineHeight: 0.98, letterSpacing: -5, maxWidth: 1500 }}>Issue once. Reconcile onchain.</div>
        <div style={{ fontSize: 42, color: MUTED }}>Non-custodial invoicing · exact Memo verification · operational webhooks</div>
        <div style={{ marginTop: 18, padding: "23px 38px", borderRadius: 999, background: GREEN, color: "white", fontSize: 34, fontWeight: 820 }}>invoice-rail-web.onrender.com</div>
        <div style={{ fontSize: 27, color: MUTED }}>github.com/xie8266509/invoice-rail</div>
      </div>
    </SceneBackground>
  );
};

const components = [TitleScene, ProblemScene, ProductScene, ArchitectureScene, PaidScene, ReceiptScene, OutroScene];

export const InvoiceRailVideo = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      {SCENES.map((scene, index) => {
        const from = SCENES.slice(0, index).reduce(
          (sum, precedingScene) => sum + precedingScene.frames,
          0,
        );
        const Scene = components[index];
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.frames}>
            <Scene />
            <Audio src={staticFile(scene.audio)} volume={0.96} />
          </Sequence>
        );
      })}
      <CaptionOverlay />
      <div style={{ position: "absolute", top: 0, left: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, background: GREEN }} />
    </AbsoluteFill>
  );
};

export const MyComposition = () => (
  <Composition
    id="InvoiceRailDemo"
    component={InvoiceRailVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
