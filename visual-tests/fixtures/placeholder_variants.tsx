import React from "react";
import { Placeholder } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Placeholder {
      height: 5;
    }
  `,
};

export default function PlaceholderVariantsFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Placeholder variant="default" label="Default" />
      <Placeholder variant="size" label="Size" />
      <Placeholder variant="text" label="Text" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
