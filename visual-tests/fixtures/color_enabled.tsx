import React from "react";
import { Box } from "ink";

import { Content, Static } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function ColorEnabledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box flexDirection="row">
        <Static content={Content.styled("same", "#ff5555 on #330000")} />
        <Static content={Content.styled(" ", "#e0e0e0")} />
        <Static content={Content.styled("same", "#55ff55 on #003300")} />
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
