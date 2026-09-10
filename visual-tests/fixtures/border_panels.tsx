import React from "react";
import { Placeholder } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

const STYLES = ["panel", "tab", "tall", "wide"] as const;

export const appProps = {
  css: `
    Placeholder {
      height: 5;
    }
    ${STYLES.map((style) => `#${style} { border: ${style} #0178D4; }`).join("\n")}
  `,
};

export default function BorderPanelsFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      {STYLES.map((style) => (
        <Placeholder key={style} id={style} label={style} />
      ))}
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
