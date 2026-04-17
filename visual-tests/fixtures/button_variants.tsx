import React from "react";
import { ButtonWidget } from "../../src/index.js";

export default function ButtonVariantsFixture(): React.JSX.Element {
  return (
    <>
      <ButtonWidget label="Default" variant="default" />
      <ButtonWidget label="Primary" variant="primary" />
      <ButtonWidget label="Success" variant="success" />
      <ButtonWidget label="Warning" variant="warning" />
      <ButtonWidget label="Error" variant="error" />
    </>
  );
}
