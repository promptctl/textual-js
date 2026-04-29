import React from "react";
import { Text } from "ink";
import { Rule } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function RuleHorizontalFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Text>Above the rule</Text>
      <Rule />
      <Text>Below the rule</Text>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
