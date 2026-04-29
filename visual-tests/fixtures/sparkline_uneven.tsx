import React from "react";
import { Sparkline } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Sparkline {
      width: 40;
      height: 3;
    }
  `,
};

export default function SparklineUnevenFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Sparkline data={[1, 1, 2, 1, 2, 1, 2, 1, 50, 1, 2, 1, 2, 1, 1, 2]} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
