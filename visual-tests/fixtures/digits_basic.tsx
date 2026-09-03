import React from "react";
import { Digits } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  // The Python fixture colours the Digits through `Screen { color: #e0e0e0 }`.
  // Digits is not a Static subclass, so the rule is written against the type
  // that actually paints here rather than inherited from one.
  css: `
    Digits {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function DigitsBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Digits value="3.14" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
