import React from "react";
import { Box } from "ink";
import { Button } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: "*",
};

export default function ButtonVariantsFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box>
        <Button label="Default" variant="default" />
        <Button label="Primary" variant="primary" />
        <Button label="Success" variant="success" />
        <Button label="Warning" variant="warning" />
        <Button label="Error" variant="error" />
      </Box>
    </FixtureScreen>
  );
}

export const interactions: never[] = [];
