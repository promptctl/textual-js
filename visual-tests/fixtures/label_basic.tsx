import React from "react";
import { Label } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Label {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function LabelBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Label content="Hello Label" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
