import React from "react";
import { ProgressBar } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

// Textual's percentage and ETA readouts are Labels with no colour of their
// own; they inherit the screen foreground. The Python fixture gets that from
// `Screen { color: #e0e0e0 }`, so the widget needs the same rule here.
export const appProps = {
  css: `
    ProgressBar {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function ProgressEmptyFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <ProgressBar total={100} progress={0} showEta={false} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
