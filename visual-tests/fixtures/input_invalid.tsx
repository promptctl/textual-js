import React from "react";
import { Input } from "../../src/index.js";
import { NumberValidator } from "../../src/validation/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: null,
};

export default function InputInvalidFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Input value="abc" validators={[new NumberValidator()]} validateOn={["changed"]} />
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
