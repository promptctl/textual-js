import React from "react";
import { Box } from "ink";
import { Button } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: "*",
};

export default function ButtonDisabledFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box>
        <Button label="Default" variant="default" disabled />
        <Button label="Primary" variant="primary" disabled />
        <Button label="Success" variant="success" disabled />
        <Button label="Warning" variant="warning" disabled />
        <Button label="Error" variant="error" disabled />
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
