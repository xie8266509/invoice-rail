import type { CSSProperties, ReactNode } from "react";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadSans } from "@remotion/google-fonts/InstrumentSans";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily: sans } = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: mono } = loadMono("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const FPS = 30;
const TRANSITION = 8;
const SCENES = [135, 240, 210, 240, 210, 210, 180, 150] as const;
const SFX: Array<{ from: number; name: string; volume: number }> = [
  { from: 127, name: "whoosh.wav", volume: 0.34 },
  { from: 342, name: "mouse-click.wav", volume: 0.42 },
  { from: 558, name: "switch.wav", volume: 0.38 },
  { from: 814, name: "whoosh.wav", volume: 0.32 },
  { from: 1015, name: "ding.wav", volume: 0.3 },
  { from: 1234, name: "switch.wav", volume: 0.34 },
  { from: 1390, name: "whoosh.wav", volume: 0.3 },
];
const TOTAL_FRAMES =
  SCENES.reduce((sum, duration) => sum + duration, 0) -
  TRANSITION * (SCENES.length - 1);

const COLORS = {
  ink: "#080d0b",
  paper: "#f2f3ed",
  mist: "#dfe8e2",
  mint: "#65f2b8",
  green: "#087760",
  amber: "#f2b84b",
  muted: "#93a39c",
  white: "#ffffff",
};

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.bezier(0.45, 0, 0.55, 1);

const progress = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    ...clamp,
    easing: easeOut,
  });

const FadeUp = ({
  children,
  frame,
  delay = 0,
  distance = 28,
  style,
}: {
  children: ReactNode;
  frame: number;
  delay?: number;
  distance?: number;
  style?: CSSProperties;
}) => {
  const enter = progress(frame, delay, delay + 22);
  return (
    <div
      style={{
        opacity: enter,
        translate: `0 ${interpolate(enter, [0, 1], [distance, 0])}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Grain = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: 0.12,
        mixBlendMode: "soft-light",
        pointerEvents: "none",
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,.45) 0 0.7px, transparent .8px)",
        backgroundSize: "5px 5px",
        backgroundPosition: `${frame % 5}px ${(frame * 2) % 5}px`,
      }}
    />
  );
};

const FrameMeta = ({ section, dark = true }: { section: string; dark?: boolean }) => (
  <div
    style={{
      position: "absolute",
      top: 54,
      left: 78,
      right: 78,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 20,
      color: dark ? COLORS.paper : COLORS.ink,
      fontFamily: mono,
      fontSize: 20,
      fontWeight: 500,
      letterSpacing: 1.8,
      textTransform: "uppercase",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
      <div
        style={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: COLORS.mint,
          boxShadow: `0 0 22px ${COLORS.mint}`,
        }}
      />
      Invoice Rail
    </div>
    <div style={{ display: "flex", gap: 28, opacity: 0.72 }}>
      <span>{section}</span>
      <span>Arc Testnet</span>
    </div>
  </div>
);

const DarkStage = ({ children, section }: { children: ReactNode; section: string }) => (
  <AbsoluteFill
    style={{
      background: COLORS.ink,
      color: COLORS.paper,
      fontFamily: sans,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(101,242,184,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(101,242,184,.035) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    />
    <FrameMeta section={section} />
    {children}
    <Grain />
  </AbsoluteFill>
);

const LightStage = ({ children, section }: { children: ReactNode; section: string }) => (
  <AbsoluteFill
    style={{
      background: COLORS.paper,
      color: COLORS.ink,
      fontFamily: sans,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 82% 12%, rgba(101,242,184,.18), transparent 29%), radial-gradient(circle at 8% 90%, rgba(242,184,75,.10), transparent 28%)",
      }}
    />
    <FrameMeta section={section} dark={false} />
    {children}
    <Grain />
  </AbsoluteFill>
);

const ProductWindow = ({
  src,
  style,
  imageStyle,
  children,
}: {
  src: string;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  children?: ReactNode;
}) => (
  <div
    style={{
      position: "relative",
      overflow: "hidden",
      background: "white",
      border: "1px solid rgba(8,13,11,.16)",
      boxShadow: "0 34px 90px rgba(8,25,19,.22)",
      ...style,
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        ...imageStyle,
      }}
    />
    {children}
  </div>
);

const Cursor = ({ x, y, click }: { x: number; y: number; click: number }) => {
  const ring = interpolate(click, [0, 0.35, 1], [0.2, 1, 1.8], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 26,
        height: 32,
        zIndex: 12,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -12,
          top: -12,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `2px solid ${COLORS.mint}`,
          opacity: interpolate(click, [0, 0.12, 1], [0, 0.8, 0], clamp),
          scale: ring,
        }}
      />
      <svg viewBox="0 0 26 32" width="26" height="32">
        <path
          d="M3 2L22 19L13 20L18 29L13.5 31L8.6 22L3 28Z"
          fill="white"
          stroke="#080d0b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const ColdOpen = () => {
  const frame = useCurrentFrame();
  const proof = progress(frame, 10, 42);
  const secondLine = progress(frame, 48, 72);
  return (
    <DarkStage section="00 / Result first">
      <ProductWindow
        src="v2/arcscan-receipt.png"
        style={{
          position: "absolute",
          top: 155,
          right: -120,
          width: 920,
          height: 790,
          opacity: interpolate(frame, [0, 30], [0, 0.62], clamp),
          rotate: "-2deg",
          scale: interpolate(frame, [0, SCENES[0]], [1.04, 1.13], {
            ...clamp,
            easing: easeInOut,
          }),
          filter: "saturate(.72) contrast(1.08)",
        }}
        imageStyle={{ objectPosition: "42% 35%" }}
      />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 235,
          width: 1080,
          zIndex: 8,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: 24,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: COLORS.mint,
            opacity: proof,
          }}
        >
          Live transaction · block 51956775
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: 116,
            fontWeight: 600,
            lineHeight: 0.96,
            letterSpacing: -6.5,
            opacity: proof,
            translate: `${interpolate(proof, [0, 1], [-35, 0])}px 0`,
          }}
        >
          Settlement:
          <br />
          <span style={{ color: COLORS.mint }}>≤ 0.51 seconds.</span>
        </div>
        <div
          style={{
            marginTop: 48,
            fontSize: 48,
            lineHeight: 1.14,
            maxWidth: 850,
            color: COLORS.mist,
            opacity: secondLine,
            translate: `0 ${interpolate(secondLine, [0, 1], [24, 0])}px`,
          }}
        >
          Reconciliation should not take the rest of the day.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          bottom: 70,
          height: 1,
          background: "rgba(242,243,237,.18)",
        }}
      />
    </DarkStage>
  );
};

const IssueScene = () => {
  const frame = useCurrentFrame();
  const cursorMove = progress(frame, 70, 168);
  const click = progress(frame, 165, 182);
  const scan = progress(frame, 26, 120);
  return (
    <LightStage section="01 / Issue">
      <FadeUp
        frame={frame}
        style={{ position: "absolute", left: 100, top: 130, zIndex: 8 }}
      >
        <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: -3.2 }}>
          One request. One link.
        </div>
        <div style={{ fontSize: 28, marginTop: 10, color: "#58655f" }}>
          Create once, then share the same verifiable payment context.
        </div>
      </FadeUp>
      <ProductWindow
        src="v2/dashboard-paid-wallet.png"
        style={{
          position: "absolute",
          left: 96,
          top: 265,
          width: 1728,
          height: 720,
          borderRadius: 18,
          scale: interpolate(frame, [0, SCENES[1]], [1.015, 1.055], {
            ...clamp,
            easing: easeInOut,
          }),
        }}
        imageStyle={{ objectPosition: "50% 49%" }}
      >
        <div
          style={{
            position: "absolute",
            left: 216,
            top: 276,
            width: 300,
            height: 410,
            border: `3px solid rgba(101,242,184,${interpolate(scan, [0, 1], [0, 0.95])})`,
            boxShadow: `0 0 0 999px rgba(8,13,11,${interpolate(scan, [0, 1], [0, 0.16])})`,
            borderRadius: 12,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 544,
            top: 346,
            width: 394,
            height: 132,
            border: `2px solid rgba(101,242,184,${interpolate(frame, [95, 135], [0, 0.95], clamp)})`,
            borderRadius: 10,
          }}
        />
        <Cursor
          x={interpolate(cursorMove, [0, 1], [485, 899])}
          y={interpolate(cursorMove, [0, 1], [590, 407])}
          click={click}
        />
      </ProductWindow>
      <div
        style={{
          position: "absolute",
          right: 86,
          bottom: 40,
          fontFamily: mono,
          fontSize: 18,
          letterSpacing: 1.2,
          color: COLORS.green,
        }}
      >
        IR-260715-8747A0EB3759
      </div>
    </LightStage>
  );
};

const PayScene = () => {
  const frame = useCurrentFrame();
  const bridge = progress(frame, 52, 138);
  const click = progress(frame, 120, 140);
  return (
    <DarkStage section="02 / Pay">
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 145,
          width: 780,
          zIndex: 6,
        }}
      >
        <FadeUp frame={frame}>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -3.8 }}>
            The payer signs.
          </div>
          <div style={{ fontSize: 34, color: COLORS.muted, marginTop: 10 }}>
            Invoice Rail never receives private keys.
          </div>
        </FadeUp>
      </div>
      <ProductWindow
        src="v2/invoice-open.png"
        style={{
          position: "absolute",
          left: 100,
          top: 300,
          width: 760,
          height: 690,
          borderRadius: 18,
          opacity: progress(frame, 10, 35),
          translate: `${interpolate(progress(frame, 10, 35), [0, 1], [-45, 0])}px 0`,
        }}
        imageStyle={{ objectFit: "contain", background: "#f3f7f5" }}
      />
      <ProductWindow
        src="v2/dashboard-paid-wallet.png"
        style={{
          position: "absolute",
          right: 92,
          top: 188,
          width: 820,
          height: 802,
          borderRadius: 18,
          opacity: progress(frame, 32, 66),
          translate: `${interpolate(progress(frame, 32, 66), [0, 1], [55, 0])}px 0`,
        }}
        imageStyle={{
          width: 1700,
          maxWidth: "none",
          objectFit: "cover",
          objectPosition: "right center",
          translate: "-880px 0",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 50,
            top: 120,
            width: 290,
            height: 118,
            border: `2px solid rgba(101,242,184,${bridge})`,
            borderRadius: 14,
            boxShadow: `0 0 45px rgba(101,242,184,${bridge * 0.22})`,
          }}
        />
        <Cursor x={610} y={176} click={click} />
      </ProductWindow>
      <div
        style={{
          position: "absolute",
          left: 860,
          top: 660,
          width: 190,
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.mint} ${bridge * 100}%, rgba(101,242,184,.16) ${bridge * 100}%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${bridge * 100}%`,
            top: -6,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: COLORS.mint,
            boxShadow: `0 0 24px ${COLORS.mint}`,
          }}
        />
      </div>
    </DarkStage>
  );
};

const MemoScene = () => {
  const frame = useCurrentFrame();
  const typed = Math.floor(interpolate(frame, [20, 120], [0, 98], clamp));
  const bound = progress(frame, 84, 126);
  const code =
    "memo(USDC, transfer(0xe118…5b06, 0.01), IR-260715-8747A0EB3759)";
  const fields = [
    ["TOKEN", "USDC · 0x3600…0000"],
    ["RECIPIENT", "0xe118…5b06"],
    ["AMOUNT", "0.01"],
    ["MEMO ID", "IR-260715-8747A0EB3759"],
  ];
  return (
    <DarkStage section="03 / Bind">
      <div style={{ position: "absolute", left: 105, top: 145, right: 105 }}>
        <FadeUp frame={frame}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 22,
              letterSpacing: 2,
              color: COLORS.mint,
            }}
          >
            THE DIFFERENCE IS NOT ANOTHER DATABASE FIELD
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 600,
              letterSpacing: -4.2,
              marginTop: 22,
              maxWidth: 1280,
              lineHeight: 1,
            }}
          >
            The invoice reference travels with the money.
          </div>
        </FadeUp>
      </div>
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 430,
          width: 1710,
          height: 420,
          borderTop: "1px solid rgba(242,243,237,.16)",
          borderBottom: "1px solid rgba(242,243,237,.16)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            height: "100%",
          }}
        >
          <div
            style={{
              padding: "42px 48px 40px 0",
              borderRight: "1px solid rgba(242,243,237,.16)",
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            {fields.map(([label, value], index) => {
              const item = progress(frame, 28 + index * 15, 48 + index * 15);
              return (
                <div key={label} style={{ opacity: item, translate: `${(1 - item) * -18}px 0` }}>
                  <div
                    style={{
                      fontFamily: mono,
                      fontSize: 16,
                      letterSpacing: 1.6,
                      color: COLORS.muted,
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 22, marginTop: 5 }}>
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              padding: "46px 0 40px 58px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ fontFamily: mono, fontSize: 29, color: COLORS.mist }}>
              {code.slice(0, typed)}
              <span style={{ color: COLORS.mint }}>|</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 58,
                right: 0,
                top: 150,
                height: 2,
                background: "rgba(101,242,184,.15)",
              }}
            >
              <div
                style={{
                  width: `${bound * 100}%`,
                  height: "100%",
                  background: COLORS.mint,
                  boxShadow: `0 0 26px ${COLORS.mint}`,
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: 58,
                top: 194,
                fontSize: 50,
                fontWeight: 600,
                letterSpacing: -2,
                opacity: bound,
                color: COLORS.mint,
              }}
            >
              One atomic Arc transaction.
            </div>
            <div
              style={{
                position: "absolute",
                left: 58,
                top: 265,
                fontSize: 28,
                color: COLORS.muted,
                opacity: bound,
              }}
            >
              Token transfer and business context succeed—or fail—together.
            </div>
          </div>
        </div>
      </div>
    </DarkStage>
  );
};

const PaidScene = () => {
  const frame = useCurrentFrame();
  const match = progress(frame, 45, 90);
  const paid = progress(frame, 70, 114);
  return (
    <LightStage section="04 / Verify">
      <div
        style={{
          position: "absolute",
          left: 105,
          top: 148,
          width: 630,
          zIndex: 8,
        }}
      >
        <FadeUp frame={frame}>
          <div style={{ fontSize: 72, fontWeight: 600, letterSpacing: -4 }}>
            Open becomes paid.
          </div>
          <div style={{ fontSize: 32, color: "#596760", marginTop: 12 }}>
            Only after an exact onchain match.
          </div>
        </FadeUp>
      </div>
      <ProductWindow
        src="v2/invoice-open.png"
        style={{
          position: "absolute",
          left: 100,
          top: 325,
          width: 820,
          height: 650,
          borderRadius: 18,
          opacity: interpolate(match, [0, 1], [1, 0.32]),
          translate: `${interpolate(match, [0, 1], [0, -110])}px 0`,
          scale: interpolate(match, [0, 1], [1, 0.94]),
        }}
        imageStyle={{ objectPosition: "50% 12%" }}
      />
      <div
        style={{
          position: "absolute",
          left: 848,
          top: 580,
          width: 238,
          height: 2,
          background: "rgba(8,119,96,.18)",
        }}
      >
        <div
          style={{
            width: `${match * 100}%`,
            height: "100%",
            background: COLORS.green,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${match * 100}%`,
            top: -7,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: COLORS.green,
            boxShadow: "0 0 24px rgba(8,119,96,.5)",
          }}
        />
      </div>
      <ProductWindow
        src="v2/invoice-paid.png"
        style={{
          position: "absolute",
          right: 118,
          top: 172,
          width: 690,
          height: 790,
          borderRadius: 18,
          opacity: paid,
          translate: `${interpolate(paid, [0, 1], [85, 0])}px 0`,
          scale: interpolate(paid, [0, 1], [0.92, 1]),
        }}
        imageStyle={{ objectFit: "contain", background: "#f3f7f5" }}
      />
      <div
        style={{
          position: "absolute",
          left: 104,
          bottom: 50,
          fontFamily: mono,
          fontSize: 20,
          color: COLORS.green,
          letterSpacing: 1.4,
          opacity: paid,
        }}
      >
        OBSERVED · VERIFIED · PERSISTED
      </div>
    </LightStage>
  );
};

const ProofScene = () => {
  const frame = useCurrentFrame();
  const zoom = progress(frame, 18, 182);
  const metric = progress(frame, 62, 102);
  return (
    <DarkStage section="05 / Proof">
      <ProductWindow
        src="v2/arcscan-receipt.png"
        style={{
          position: "absolute",
          left: 70,
          top: 160,
          width: 1080,
          height: 800,
          borderRadius: 16,
          scale: interpolate(zoom, [0, 1], [1.01, 1.055]),
          translate: `${interpolate(zoom, [0, 1], [0, -16])}px ${interpolate(zoom, [0, 1], [0, -10])}px`,
          filter: "saturate(.8) contrast(1.06)",
        }}
        imageStyle={{ objectPosition: "38% 33%" }}
      />
      <div
        style={{
          position: "absolute",
          left: 1235,
          right: 80,
          top: 235,
          zIndex: 8,
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: 22,
            color: COLORS.mint,
            letterSpacing: 1.8,
            opacity: metric,
          }}
        >
          ARCSCAN · SUCCESS
        </div>
        <div
          style={{
            fontSize: 148,
            fontWeight: 600,
            lineHeight: 0.86,
            letterSpacing: -8,
            marginTop: 34,
            color: COLORS.paper,
            opacity: metric,
            translate: `${interpolate(metric, [0, 1], [45, 0])}px 0`,
          }}
        >
          0.51
          <span style={{ display: "block", fontSize: 60, letterSpacing: -2, marginTop: 28 }}>
            seconds
          </span>
        </div>
        <div
          style={{
            marginTop: 54,
            paddingTop: 28,
            borderTop: "1px solid rgba(242,243,237,.18)",
            display: "grid",
            gap: 16,
            fontFamily: mono,
            fontSize: 20,
            color: COLORS.muted,
            opacity: progress(frame, 92, 126),
          }}
        >
          <div>BLOCK 51956775</div>
          <div>FEE 0.002553726 USDC</div>
          <div>TX 0x8c93…18c1</div>
        </div>
      </div>
    </DarkStage>
  );
};

const OpsScene = () => {
  const frame = useCurrentFrame();
  const lines = [
    ["08:32:18.104", "memo log detected", "51956775"],
    ["08:32:18.127", "token · recipient · amount", "match"],
    ["08:32:18.149", "payment persisted", "idempotent"],
    ["08:32:18.183", "invoice.paid", "delivered"],
  ];
  return (
    <DarkStage section="06 / Operate">
      <div style={{ position: "absolute", left: 110, top: 150, width: 940 }}>
        <FadeUp frame={frame}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -4 }}>
            A payment your software can act on.
          </div>
        </FadeUp>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          right: 110,
          top: 395,
          height: 430,
          borderTop: "1px solid rgba(242,243,237,.16)",
          borderBottom: "1px solid rgba(242,243,237,.16)",
          display: "grid",
          gridTemplateColumns: "1.25fr .75fr",
        }}
      >
        <div style={{ padding: "42px 60px 42px 0", borderRight: "1px solid rgba(242,243,237,.16)" }}>
          {lines.map(([time, label, result], index) => {
            const line = progress(frame, 25 + index * 18, 45 + index * 18);
            return (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "190px 1fr 160px",
                  alignItems: "center",
                  height: 82,
                  borderBottom: "1px solid rgba(242,243,237,.08)",
                  fontFamily: mono,
                  fontSize: 21,
                  opacity: line,
                  translate: `${interpolate(line, [0, 1], [-26, 0])}px 0`,
                }}
              >
                <span style={{ color: COLORS.muted }}>{time}</span>
                <span>{label}</span>
                <span style={{ color: COLORS.mint, textAlign: "right" }}>{result}</span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            padding: "50px 0 40px 66px",
            display: "flex",
            flexDirection: "column",
            gap: 34,
          }}
        >
          {[
            ["LOGS", "1"],
            ["PAYMENTS", "1"],
            ["FALSE MATCHES", "0"],
          ].map(([label, value], index) => {
            const stat = progress(frame, 48 + index * 16, 68 + index * 16);
            return (
              <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 24, opacity: stat }}>
                <div style={{ fontSize: 64, fontWeight: 600, color: COLORS.mint }}>{value}</div>
                <div style={{ fontFamily: mono, fontSize: 19, letterSpacing: 1.4, color: COLORS.muted }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 110,
          bottom: 70,
          fontSize: 28,
          color: COLORS.muted,
          opacity: progress(frame, 104, 132),
        }}
      >
        Signed webhooks · CSV export · PostgreSQL record
      </div>
    </DarkStage>
  );
};

const EndScene = () => {
  const frame = useCurrentFrame();
  const reveal = progress(frame, 8, 38);
  const url = progress(frame, 54, 82);
  return (
    <DarkStage section="07 / Live alpha">
      <ProductWindow
        src="v2/dashboard-paid-wallet.png"
        style={{
          position: "absolute",
          left: 610,
          top: 120,
          width: 1410,
          height: 900,
          opacity: 0.42,
          scale: interpolate(frame, [0, SCENES[7]], [1.05, 1.11], {
            ...clamp,
            easing: easeInOut,
          }),
          filter: "saturate(.55) contrast(1.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg, #080d0b 0%, #080d0b 42%, rgba(8,13,11,.78) 62%, rgba(8,13,11,.15) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 110, top: 245, width: 1160, zIndex: 8 }}>
        <div
          style={{
            fontSize: 112,
            lineHeight: 0.94,
            fontWeight: 600,
            letterSpacing: -6.5,
            opacity: reveal,
            translate: `${interpolate(reveal, [0, 1], [-36, 0])}px 0`,
          }}
        >
          Issue once.
          <br />
          Reconcile <span style={{ color: COLORS.mint }}>onchain.</span>
        </div>
        <div
          style={{
            marginTop: 58,
            display: "flex",
            alignItems: "center",
            gap: 20,
            opacity: url,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: COLORS.mint,
              boxShadow: `0 0 22px ${COLORS.mint}`,
            }}
          />
          <div style={{ fontFamily: mono, fontSize: 25, letterSpacing: 0.6 }}>
            invoice-rail-web.onrender.com
          </div>
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: mono,
            fontSize: 20,
            color: COLORS.muted,
            opacity: url,
          }}
        >
          LIVE ON ARC TESTNET · OPEN SOURCE
        </div>
      </div>
    </DarkStage>
  );
};

const FilmAudio = () => (
  <>
    <Audio
      src={staticFile("v2/audio/digital-clouds.mp3")}
      trimBefore={8 * FPS}
      volume={(frame) =>
        interpolate(
          frame,
          [0, 42, 360, 560, 800, 995, 1200, 1370, TOTAL_FRAMES - 80, TOTAL_FRAMES],
          [0, 0.46, 0.46, 0.38, 0.45, 0.5, 0.52, 0.56, 0.56, 0],
          clamp,
        )
      }
    />
    {SFX.map(({ from, name, volume }) => (
      <Sequence key={`${name}-${from}`} from={from} layout="none">
        <Audio src={staticFile(`v2/audio/${name}`)} volume={volume} />
      </Sequence>
    ))}
  </>
);

const GlobalProgress = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: `${(frame / durationInFrames) * 100}%`,
        height: 5,
        background: COLORS.mint,
        zIndex: 50,
        boxShadow: "0 0 16px rgba(101,242,184,.46)",
      }}
    />
  );
};

export const InvoiceRailFilm = () => {
  const timing = linearTiming({ durationInFrames: TRANSITION });
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
          <ColdOpen />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
          <IssueScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
          <PayScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[3]}>
          <MemoScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[4]}>
          <PaidScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[5]}>
          <ProofScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[6]}>
          <OpsScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCENES[7]}>
          <EndScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <FilmAudio />
      <GlobalProgress />
    </AbsoluteFill>
  );
};

export const MyComposition = () => (
  <Composition
    id="InvoiceRailDemo"
    component={InvoiceRailFilm}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
