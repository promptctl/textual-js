import React from "react";
import { Welcome } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  // The Python fixture sets `Screen { background: #121212; color: #e0e0e0 }`.
  // Only the foreground reaches anything here: Welcome declares its own
  // `background: #1e1e1e` (upstream's `$surface`), which is the more specific
  // match in both implementations, and welcome_default.ansi confirms it —
  // every painted cell in the baseline is on 48;2;30;30;30, not 18;18;18.
  css: `
    Screen {
      color: #e0e0e0;
    }
  `,
};

export default function WelcomeDefaultFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Welcome />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
