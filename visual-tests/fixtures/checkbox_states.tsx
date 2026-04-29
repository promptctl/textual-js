import React from "react";
import { Checkbox } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = { autoFocus: null };

export default function CheckboxStatesFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Checkbox label="Unchecked option" value={false} />
      <Checkbox label="Checked option" value={true} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
