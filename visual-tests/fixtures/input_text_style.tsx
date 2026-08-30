import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

// Pins that the cascade's `text-style` reaches the Input's value and renders
// the same weight Textual gives it — dropping it moves 748 pixels.
//
// It does not pin the other half of the rule, that the style stays off the
// ▔ ▁ ▊ ▎ border glyphs: those are solid block characters, which xterm draws
// identically bold or not. That half is asserted at the escape-sequence level
// by "scopes a text-style rule to the value" in tests/input-render.test.tsx.
export const appProps = {
  autoFocus: null,
  css: `
    Input {
      text-style: bold;
    }
  `,
};

export default function InputTextStyleFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input value="hello world" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
