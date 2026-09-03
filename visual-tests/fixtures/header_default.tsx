import React from "react";
import { Header, Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  // Matches `TITLE = "My Application"` on the Python fixture's App class.
  title: "My Application",
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function HeaderDefaultFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Header />
      <Static content="Body content" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
