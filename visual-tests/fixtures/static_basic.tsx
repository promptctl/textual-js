import React from "react";
import { StaticWidget } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function StaticBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <StaticWidget content="Hello World" />
      <StaticWidget content="Second line of text" />
      <StaticWidget content="" />
    </FixtureScreen>
  );
}
