import React from "react";
import { Link } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export default function LinkBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Link text="Textual docs" url="https://textual.textualize.io" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
