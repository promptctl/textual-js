import React from "react";
import { Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function StaticMultilineFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content={"line one\nline two\nline three"} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
