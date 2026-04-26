import React from "react";
import { Box } from "ink";
import { Static, Switch } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: "*",
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function SwitchStatesFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="Switch states:" />
      <Box>
        <Switch value={false} />
        <Switch value />
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
