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

// The rack stacks in notify order, so this array reads top-to-bottom on screen.
const TOASTS: readonly FixtureToast[] = [
  { message: "Informational message", title: "Info", severity: "information" },
  { message: "Heads up about something", title: "Warning", severity: "warning" },
  { message: "Something failed", title: "Error", severity: "error" },
];

export default function NotificationsSeverityFixture(): React.JSX.Element {
  return (
    <FixtureScreen>
      <Static content="Background content" />
      <NotifyOnMount toasts={TOASTS} />
    </FixtureScreen>
  );
}

export const interactions = [{ type: "wait", ms: 100 }] as const;
