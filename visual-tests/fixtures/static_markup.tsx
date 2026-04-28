import React from "react";
import { Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function StaticMarkupFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="[bold]Bold[/] plain [italic]italic[/] text" />
      <Static content="[#ff5555]Red[/] and [#55ff55]green[/] words" />
      <Static content="[bold #ffaa00]Warning:[/] combined styles" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
