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

export default function SparklineBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Sparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
