import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/Newsreader";
import { COLOR } from "./theme";
import { SG, INTER } from "./fonts";

const serif = loadSerif("normal", { weights: ["400", "500", "600"] });
const SERIF = serif.fontFamily;

// 9:16 social canvas for the daily "Prompt of the Day" — Claude Cowork interface.
export const POTD_W = 1080;
export const POTD_H = 1920;
export const POTD_FPS = 30;
export const POTD_TOTAL = 300; // 10s

export type PotdProps = {
  category: string; // small Academy tag, e.g. "Corporate Efficiency"
  task: string; // the agentic task typed into the composer
  steps: string[]; // what Claude does, shown executing
  result: string; // the finished-state summary
};

// Claude Cowork (light/paper) palette.
const CW = {
  paper: "#f1efe9",
  ink: "#23211d",
  inkSoft: "#6c685f",
  inkFaint: "#a39e93",
  card: "#ffffff",
  border: "#e4e0d8",
  rust: "#d4744f",
  green: "#3d9a6f",
  chip: "#ece9e2",
};

const clamp = (frame: number, a: number, b: number) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

// Claude sunburst mark.
const Burst: React.FC<{ size: number; color: string }> = ({ size, color }) => {
  const spokes = 12;
  const lines = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const r1 = size * 0.16;
    const r2 = size * (i % 2 === 0 ? 0.5 : 0.4);
    lines.push(
      <line
        key={i}
        x1={size / 2 + Math.cos(a) * r1}
        y1={size / 2 + Math.sin(a) * r1}
        x2={size / 2 + Math.cos(a) * r2}
        y2={size / 2 + Math.sin(a) * r2}
        stroke={color}
        strokeWidth={size * 0.052}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <svg width={size} height={size}>
      {lines}
    </svg>
  );
};

export const PromptOfTheDay: React.FC<PotdProps> = ({ category, task, steps, result }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ---- timeline ----
  const typeStart = 32;
  const typeEnd = 150;
  const sendAt = 158;
  const stepBase = 176; // first step appears
  const stepGap = 20; // frames between steps
  const resultAt = stepBase + steps.length * stepGap + 6;

  const appIn = spring({ frame: frame - 2, fps, config: { damping: 200 } });
  const sent = frame >= sendAt;

  // typing into the composer
  const chars = Math.floor(
    interpolate(frame, [typeStart, typeEnd], [0, task.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typed = task.slice(0, chars);
  const composerActive = chars > 0;
  const caretOn = Math.floor(frame / 8) % 2 === 0;

  // hero fades out on send, working view fades in
  const heroO = interpolate(frame, [sendAt - 6, sendAt + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const workO = clamp(frame, sendAt + 2, sendAt + 16);

  return (
    <AbsoluteFill style={{ background: CW.paper, fontFamily: INTER }}>
      {/* subtle dot grid */}
      <svg width={POTD_W} height={POTD_H} style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {Array.from({ length: 34 }).map((_, y) =>
          Array.from({ length: 20 }).map((__, x) => (
            <circle key={`${x}-${y}`} cx={x * 56 + 28} cy={y * 56 + 30} r={1.6} fill="#d8d4cb" />
          )),
        )}
      </svg>

      <AbsoluteFill style={{ opacity: appIn }}>
        {/* Academy strip */}
        <div
          style={{
            height: 92,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <span style={{ color: COLOR.gold, fontSize: 26 }}>✦</span>
          <span
            style={{
              fontFamily: SG,
              fontWeight: 700,
              letterSpacing: 4,
              fontSize: 23,
              color: CW.ink,
              textTransform: "uppercase",
            }}
          >
            Taylormade Academy · Prompt of the Day
          </span>
        </div>

        {/* ===== HERO (compose) ===== */}
        <AbsoluteFill
          style={{
            opacity: heroO,
            justifyContent: "center",
            alignItems: "center",
            padding: "0 70px",
            display: frame < sendAt + 8 ? "flex" : "none",
          }}
        >
          <div style={{ marginTop: -120, marginBottom: 30 }}>
            <Burst size={120} color={CW.rust} />
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 78,
              lineHeight: 1.04,
              color: CW.ink,
              textAlign: "center",
              letterSpacing: -1,
            }}
          >
            Let's tackle
            <br />
            something together
          </div>
          <div style={{ marginTop: 22, fontSize: 28, color: CW.inkSoft }}>
            Ask Claude to actually <span style={{ color: CW.ink, fontWeight: 600 }}>do it</span> — not
            just explain it.
          </div>

          {/* composer */}
          <div
            style={{
              marginTop: 50,
              width: "100%",
              background: CW.card,
              border: `1.5px solid ${CW.border}`,
              borderRadius: 30,
              boxShadow: "0 24px 60px -34px rgba(0,0,0,0.30)",
              padding: "34px 34px 22px",
            }}
          >
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.4,
                color: typed ? CW.ink : CW.inkFaint,
                minHeight: 100,
                whiteSpace: "pre-wrap",
              }}
            >
              {typed || "How can I help you today?"}
              {composerActive && (
                <span
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: 34,
                    marginLeft: 2,
                    transform: "translateY(6px)",
                    background: CW.rust,
                    opacity: caretOn ? 1 : 0,
                  }}
                />
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 18,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  border: `1.5px solid ${CW.border}`,
                  color: CW.inkSoft,
                  fontSize: 30,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                +
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, color: CW.inkSoft, fontSize: 26 }}>
                <span style={{ fontWeight: 600, color: CW.ink }}>Opus 4.8</span>
                <span>High ⌄</span>
                <span style={{ fontSize: 28 }}>🎙️</span>
              </div>
            </div>
          </div>

          {/* action chips */}
          <div style={{ display: "flex", gap: 16, marginTop: 22, alignSelf: "flex-start" }}>
            {["▢ Work in a project ⌄", "✋ Ask ⌄"].map((c) => (
              <div
                key={c}
                style={{
                  background: CW.chip,
                  color: CW.inkSoft,
                  fontSize: 24,
                  padding: "12px 20px",
                  borderRadius: 14,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </AbsoluteFill>

        {/* ===== WORKING (execute) ===== */}
        <AbsoluteFill
          style={{
            opacity: workO,
            padding: "128px 64px 20px",
            display: sent ? "flex" : "none",
            flexDirection: "column",
          }}
        >
          {/* the task as a header */}
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ marginTop: 2 }}>
              <Burst size={44} color={CW.rust} />
            </div>
            <div style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 38, lineHeight: 1.25, color: CW.ink }}>
              {task}
            </div>
          </div>

          <div
            style={{
              marginTop: 34,
              fontFamily: SG,
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: CW.inkFaint,
            }}
          >
            Claude is working
          </div>

          {/* steps */}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 18 }}>
            {steps.map((s, i) => {
              const appear = clamp(frame, stepBase + i * stepGap, stepBase + i * stepGap + 10);
              const doneAt = stepBase + i * stepGap + 14;
              const isDone = frame >= doneAt;
              return (
                <div
                  key={i}
                  style={{
                    opacity: appear,
                    transform: `translateY(${interpolate(appear, [0, 1], [12, 0])}px)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    background: CW.card,
                    border: `1.5px solid ${CW.border}`,
                    borderRadius: 18,
                    padding: "20px 24px",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      flex: "0 0 auto",
                      background: isDone ? CW.green : "transparent",
                      border: isDone ? "none" : `3px solid ${CW.inkFaint}`,
                      borderTopColor: isDone ? "none" : CW.rust,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 22,
                      transform: isDone ? "none" : `rotate(${(frame * 12) % 360}deg)`,
                    }}
                  >
                    {isDone ? "✓" : ""}
                  </div>
                  <div style={{ fontSize: 30, color: CW.ink, fontWeight: 500 }}>{s}</div>
                </div>
              );
            })}
          </div>

          {/* result */}
          <div
            style={{
              marginTop: 26,
              opacity: clamp(frame, resultAt, resultAt + 12),
              transform: `translateY(${interpolate(clamp(frame, resultAt, resultAt + 12), [0, 1], [14, 0])}px)`,
              background: "#eef7f1",
              border: `1.5px solid #cfe9da`,
              borderRadius: 20,
              padding: "26px 28px",
              display: "flex",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                background: CW.green,
                color: "#fff",
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 31, color: CW.ink, fontWeight: 600, lineHeight: 1.3 }}>{result}</div>
          </div>
        </AbsoluteFill>

        {/* footer */}
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 70 }}>
          <div style={{ fontFamily: SG, fontWeight: 500, fontSize: 23, color: CW.inkSoft, letterSpacing: 0.5 }}>
            {category} · a new task every day at{" "}
            <span style={{ color: "#b8860b", fontWeight: 700 }}>Taylormade Academy</span>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
