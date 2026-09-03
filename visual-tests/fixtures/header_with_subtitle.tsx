import React from "react";
import { Header, Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  // Matches `TITLE` / `SUB_TITLE` on the Python fixture's App class.
  title: "My Application",
  subTitle: "Status: ready",
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function HeaderWithSubtitleFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Header />
      <Static content="Body content" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
