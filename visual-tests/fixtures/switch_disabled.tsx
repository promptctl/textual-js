import React from "react";
import { Box } from "ink";
import { Switch } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: "*",
};

export default function SwitchDisabledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box>
        <Switch value={false} disabled />
        <Switch value disabled />
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
