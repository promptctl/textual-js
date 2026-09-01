import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputTabOutFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input id="first" placeholder="First input" />
      <Input id="second" placeholder="Second input" />
    </FixtureScreen>
  );
}

// The first Tab focuses the first Input; the second must leave it for the
// second Input. An Input that stopped every key would hold the focus ring here.
export const interactions = [
  { type: "key", keys: "Tab" },
  { type: "wait", ms: 50 },
  { type: "key", keys: "Tab" },
  { type: "wait", ms: 50 },
] as const;
