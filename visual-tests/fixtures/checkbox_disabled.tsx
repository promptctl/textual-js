import React from "react";
import { Checkbox } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = { autoFocus: null };

export default function CheckboxDisabledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Checkbox label="Disabled option" value={false} disabled />
      <Checkbox label="Disabled checked" value={true} disabled />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
