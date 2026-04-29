import React from "react";
import { RadioButton } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = { autoFocus: null };

export default function RadioButtonStatesFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <RadioButton label="Unselected option" value={false} />
      <RadioButton label="Selected option" value={true} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
