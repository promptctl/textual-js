import React from "react";
import { RadioSet } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = { autoFocus: null };

export default function RadioSetDefaultFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <RadioSet buttons={["Option A", "Option B", "Option C"]} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
