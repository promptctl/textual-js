import React from "react";
import { Box } from "ink";

import { Content, StaticWidget } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function ColorEnabledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box flexDirection="row">
        <StaticWidget content={Content.styled("same", "#ff5555 on #330000")} />
        <StaticWidget content={Content.styled(" ", "#e0e0e0")} />
        <StaticWidget content={Content.styled("same", "#55ff55 on #003300")} />
      </Box>
    </FixtureScreen>
  );
}
