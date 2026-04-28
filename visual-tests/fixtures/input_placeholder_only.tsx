import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputPlaceholderOnlyFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input placeholder="Enter your name" />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
