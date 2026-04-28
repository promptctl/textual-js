import React from "react";
import { Input } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputPasswordFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input value="supersecret" password />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
