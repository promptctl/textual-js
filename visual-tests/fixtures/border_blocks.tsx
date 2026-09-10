import React from "react";
import { Placeholder } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

const STYLES = ["block", "hkey", "inner", "outer", "thick", "vkey", "hidden"] as const;

export const appProps = {
  css: `
    Placeholder {
      height: 3;
    }
    ${STYLES.map((style) => `#${style} { border: ${style} #0178D4; }`).join("\n")}
  `,
};

export default function BorderBlocksFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      {STYLES.map((style) => (
        <Placeholder key={style} id={style} label={style} />
      ))}
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
