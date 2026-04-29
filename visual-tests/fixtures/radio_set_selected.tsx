import React from "react";
import { RadioSet } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = { autoFocus: null };

export default function RadioSetSelectedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <RadioSet
        buttons={[
          { label: "Option A" },
          { label: "Option B", value: true },
          { label: "Option C" },
        ]}
      />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
