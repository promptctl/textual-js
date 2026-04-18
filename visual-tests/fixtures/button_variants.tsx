import React from "react";
import { Box } from "ink";
import { ButtonWidget } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";

export const appProps = {
  autoFocus: "*",
};

export default function ButtonVariantsFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Box>
        <ButtonWidget label="Default" variant="default" />
        <ButtonWidget label="Primary" variant="primary" />
        <ButtonWidget label="Success" variant="success" />
        <ButtonWidget label="Warning" variant="warning" />
        <ButtonWidget label="Error" variant="error" />
      </Box>
    </FixtureScreen>
  );
}
