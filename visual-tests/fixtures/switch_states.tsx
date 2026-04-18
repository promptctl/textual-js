import React from "react";
import { Box } from "ink";
import { StaticWidget, SwitchWidget } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function SwitchStatesFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <StaticWidget content="Switch states:" />
      <Box>
        <SwitchWidget value={false} />
        <SwitchWidget value />
      </Box>
    </FixtureScreen>
  );
}
