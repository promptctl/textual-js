import React from "react";
import { Digits } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

// Matches `Digits { color: #55ffff; }` on the Python fixture, and is the whole
// difference between this fixture and digits_basic: same widget, same font,
// a value with a colon in it and a colour of its own.
const DIGITS_COLOR = "#55ffff";

export const appProps = {
  css: `
    Digits {
      color: ${DIGITS_COLOR};
    }
  `,
};

export default function DigitsLargeFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Digits value="12:34" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
