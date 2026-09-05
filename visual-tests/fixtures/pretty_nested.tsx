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

// The Python fixture's dict, key for key and in the same order. A JavaScript
// object is the counterpart of a Python dict here, so it renders with Python's
// braces and quoting — the repr is what the baseline measures.
export default function PrettyNestedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Pretty
        object={{
          name: "widget",
          counts: { hits: 1, misses: 2 },
          tags: ["a", "b", "c"],
        }}
      />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
