import React from "react";
import { Switch } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function SwitchFocusedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Switch id="target" value={false} />
    </FixtureScreen>
  );
}

export const interactions = [
  { type: "key", keys: "Tab" },
  { type: "wait", ms: 50 },
] as const;
