import React from "react";

import { Button } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Button {
      border: none;
      height: 1;
      min-width: 0;
      padding: 0 0;
      color: ${VISUAL_SCREEN_FOREGROUND};
      background: transparent;
    }
  `,
};

export default function ButtonMarkupFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Button label="[italic #ff5555]Focused[/] Button" />
      <Button label="[italic #ff5555]Blurred[/] Button" />
      <Button label="[italic #ff5555]Disabled[/] Button" disabled />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
