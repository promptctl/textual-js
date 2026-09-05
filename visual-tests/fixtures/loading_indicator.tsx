import React from "react";
import { LoadingIndicator } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  // The Python fixture's `Screen { color: #e0e0e0 }` never reaches the caption:
  // LoadingIndicator sets its own `color` from its default rules, which is the
  // more specific match in both implementations. Only the height carries over,
  // and it is what bounds the region the indicator paints.
  css: `
    LoadingIndicator {
      height: 3;
    }
  `,
};

export default function LoadingIndicatorFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <LoadingIndicator />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
