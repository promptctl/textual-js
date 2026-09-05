import React from "react";
import { Pretty } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  // See pretty_basic.tsx — the Screen rule is written against Pretty, which is
  // the type that paints.
  css: `
    Pretty {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

// The Python fixture's object, key for key. `null` stands where the Python
// fixture writes `None`; both spell the same absence and both render `None`.
//
// `'[draft]'` is here to be seen rather than asserted about: a repr reaches the
// screen as a Content, and a Content built from a bare string is parsed as
// markup, which would swallow the brackets and seven visible characters with
// them.
export default function PrettyExpandedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Pretty
        object={{
          widgets: ["Header", "Footer", "Placeholder", "LoadingIndicator"],
          counts: {
            shipped: 6,
            remaining: 2,
            skipped: null,
            unverified: true,
          },
          note: "[draft]",
          complete: false,
        }}
      />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
