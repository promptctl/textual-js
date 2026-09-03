import React from "react";
import { Placeholder } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  // The Python fixture's `Screen { color: #e0e0e0 }` never reaches the label:
  // Placeholder sets its own `color` from its palette entry, which is the more
  // specific rule in both implementations. Only the height carries over.
  css: `
    Placeholder {
      height: 5;
    }
  `,
};

export default function PlaceholderDefaultFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Placeholder />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
