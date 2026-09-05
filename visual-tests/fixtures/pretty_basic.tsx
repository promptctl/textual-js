import React from "react";
import { Pretty } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  // The Python fixture reaches the repr through `Screen { color: #e0e0e0 }`.
  // That colour paints the braces and the `, ` separators — the runs Rich's
  // highlighter leaves alone — while the quoted strings carry their own. The
  // rule is written against the type that actually paints here rather than
  // inherited from Screen.
  css: `
    Pretty {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function PrettyBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Pretty object={["alpha", "beta", "gamma"]} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
