import React from "react";
import { Composition } from "remotion";
import { PromptOfTheDay, POTD_W, POTD_H, POTD_FPS, POTD_TOTAL } from "./PromptOfTheDay";

// Props come from --props=./props.json at render time (the day's task).
export const RemotionRoot: React.FC = () => (
  <Composition
    id="PromptOfTheDay"
    component={PromptOfTheDay}
    durationInFrames={POTD_TOTAL}
    fps={POTD_FPS}
    width={POTD_W}
    height={POTD_H}
    defaultProps={{
      category: "Corporate Efficiency",
      task: "Go through my unread inbox, group everything by urgency, draft replies to the urgent ones, and flag anything I'm about to drop.",
      steps: [
        "Reading your unread inbox — 47 emails",
        "Sorting into Urgent · This Week · Delegate",
        "Drafting replies to the 6 urgent ones",
        "Flagging what you're about to drop",
      ],
      result: "Done — 6 replies drafted and ready to send, 1 at-risk item flagged.",
    }}
  />
);
