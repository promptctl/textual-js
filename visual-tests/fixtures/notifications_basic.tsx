import React from "react";
import { Static } from "../../src/index.js";
import { FixtureScreen } from "../fixture-screen.tsx";
import { NotifyOnMount, type FixtureToast } from "../notify-on-mount.tsx";

export const appProps = {
  css: `
    Screen {
      color: #e0e0e0;
    }
  `,
};

const TOASTS: readonly FixtureToast[] = [
  { message: "File saved successfully", title: "Success", severity: "information" },
];

export default function NotificationsBasicFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="Background content" />
      <NotifyOnMount toasts={TOASTS} />
    </FixtureScreen>
  );
}

export const interactions = [{ type: "wait", ms: 100 }] as const;
