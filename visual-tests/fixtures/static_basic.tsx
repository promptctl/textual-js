import React from "react";
import { StaticWidget } from "../../src/index.js";

export default function StaticBasicFixture(): React.JSX.Element {
  return (
    <>
      <StaticWidget content="Hello World" />
      <StaticWidget content="Second line of text" />
      <StaticWidget content="" />
    </>
  );
}
