import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputEmptyFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input placeholder="Type something..." />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
