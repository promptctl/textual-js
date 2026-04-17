import React from "react";
import { StaticWidget, SwitchWidget } from "../../src/index.js";

export default function SwitchStatesFixture(): React.JSX.Element {
  return (
    <>
      <StaticWidget content="Switch states:" />
      <SwitchWidget value={false} />
      <SwitchWidget value />
    </>
  );
}
