import React from "react";
import { Box, Text } from "ink";
import { Rule } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function RuleVerticalFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box flexDirection="row" height={5}>
        <Text>Left side</Text>
        <Rule orientation="vertical" />
        <Text>Right side</Text>
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
