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

export default function SparklineSummaryMinFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Sparkline
        data={[5, 1, 4, 2, 8, 3, 9, 2, 7, 1, 6, 4, 8, 2, 9, 3]}
        summaryFunction="min"
      />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
