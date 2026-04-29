import React from "react";
import { Text } from "ink";
import { Rule } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function RuleLineStylesFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Text>solid</Text>
      <Rule lineStyle="solid" />
      <Text>dashed</Text>
      <Rule lineStyle="dashed" />
      <Text>heavy</Text>
      <Rule lineStyle="heavy" />
      <Text>double</Text>
      <Rule lineStyle="double" />
      <Text>ascii</Text>
      <Rule lineStyle="ascii" />
      <Text>thick</Text>
      <Rule lineStyle="thick" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
