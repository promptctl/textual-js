import React from "react";
import { Digits } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

// Every character of the 3x3 font, split so each row fits 80 columns. Paired
// with digits_charset.py: Gate 4 diffing these two is what proves the glyph
// table was transcribed correctly, for the characters no other fixture draws.
export const appProps = {
  css: `
    Digits {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

// [LAW:one-source-of-truth] tests/digits.test.tsx checks the font against this
// fixture's committed Python baseline, so it reads the values from here rather
// than restating them. The Python fixture is the third copy and is checked by
// construction: change its strings and the regenerated baseline stops matching
// what these values draw.
export const CHARSET_VALUES = ["0123456789+-^x:", "ABCDEF $£€()"] as const;

export default function DigitsCharsetFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      {CHARSET_VALUES.map((value) => (
        <Digits key={value} value={value} />
      ))}
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
