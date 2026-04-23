import React from "react";

import { Content, Static } from "../../src/index.js";
import { FixtureScreen, VISUAL_SCREEN_FOREGROUND } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Static {
      color: ${VISUAL_SCREEN_FOREGROUND};
    }
  `,
};

export default function StyledContentFixture(): React.JSX.Element {
  const richLine = Content.assemble(
    ["Bright", "#ff5555"],
    " ",
    ["Gray", "#b3b3b3"],
    " ",
    ["RGB", "#112233 on rgb(10,20,30)"],
  );
  const attrsLine = Content.assemble(["Attrs", "bold italic underline reverse"]);

  return (
    <FixtureScreen>
      <Static content={richLine} />
      <Static content={attrsLine} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
