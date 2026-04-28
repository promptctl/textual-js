import React from "react";
import { Footer, Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  bindings: [],
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function FooterEmptyFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="Body content" />
      <Footer />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
