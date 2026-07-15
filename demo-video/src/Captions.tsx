import { useEffect, useState } from "react";
import type { Caption } from "@remotion/captions";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const CaptionOverlay = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [handle] = useState(() => delayRender("Loading Invoice Rail captions"));

  useEffect(() => {
    fetch(staticFile("captions.json"))
      .then((response) => response.json() as Promise<Caption[]>)
      .then((data) => {
        setCaptions(data);
        continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [handle]);

  if (!captions) return null;
  const currentMs = frame / fps * 1000;
  const caption = captions.find((item) => currentMs >= item.startMs && currentMs < item.endMs);
  if (!caption) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 130px 44px", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1540, padding: "15px 26px 17px", borderRadius: 16, background: "rgba(10, 25, 21, 0.90)", color: "white", fontSize: 34, fontWeight: 650, lineHeight: 1.25, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
        {caption.text}
      </div>
    </AbsoluteFill>
  );
};
