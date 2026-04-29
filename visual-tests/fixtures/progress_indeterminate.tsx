import React from "react";
import { ProgressBar } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function ProgressIndeterminateFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <ProgressBar total={null} showEta={false} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
