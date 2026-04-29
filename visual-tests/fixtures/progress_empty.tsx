import React from "react";
import { ProgressBar } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function ProgressEmptyFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <ProgressBar total={100} progress={0} showEta={false} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
