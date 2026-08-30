import React from "react";
import { Input, useTextual, type InputWidget } from "../../src/index.js";
import { NumberValidator } from "../../src/validation/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

const TARGET_ID = "target";

// Mirrors the Python fixture's `on_mount`: Textual validates on value
// *changes*, so an Input constructed with an initial value carries no verdict
// until something asks for one. Both fixtures ask at mount so the invalid
// state is part of the rendered frame rather than a post-render interaction.
function ValidateOnMount(): null {
  const app = useTextual();

  React.useEffect(() => {
    const input = app.getByCssId(TARGET_ID) as InputWidget | undefined;

    if (input === undefined) {
      throw new Error(`input_invalid fixture: no widget with id "${TARGET_ID}"`);
    }

    input.validate();
  }, [app]);

  return null;
}

export default function InputInvalidFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input
        id={TARGET_ID}
        value="abc"
        validators={[new NumberValidator()]}
        validateOn={["changed"]}
      />
      <ValidateOnMount />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
