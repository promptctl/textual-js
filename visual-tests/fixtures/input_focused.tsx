import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputFocusedFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input id="target" placeholder="Focused input" />
    </FixtureScreen>
  );
}

export const interactions = [
  { type: "key", keys: "Tab" },
  { type: "wait", ms: 50 },
] as const;
