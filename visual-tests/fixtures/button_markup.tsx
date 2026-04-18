import React from "react";

import { ButtonWidget } from "../../src/index.js";
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
      <ButtonWidget label="[italic #ff5555]Focused[/] Button" />
      <ButtonWidget label="[italic #ff5555]Blurred[/] Button" />
      <ButtonWidget label="[italic #ff5555]Disabled[/] Button" disabled />
    </FixtureScreen>
  );
}
