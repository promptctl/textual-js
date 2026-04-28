import React from "react";
import { Button } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function ButtonFocusedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Button id="target" label="Focus me" variant="primary" />
    </FixtureScreen>
  );
}

export const interactions = [
  { type: "key", keys: "Tab" },
  { type: "wait", ms: 50 },
] as const;
