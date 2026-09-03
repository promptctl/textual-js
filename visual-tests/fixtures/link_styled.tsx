import React from "react";
import { Link } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  css: `
    Link {
      color: #ff55ff;
      text-style: bold underline;
    }
  `,
};

export default function LinkStyledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Link text="Styled link" url="https://example.com" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
