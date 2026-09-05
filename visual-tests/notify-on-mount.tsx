import React from "react";
import { useTextual, type NotificationSeverity } from "../src/index.js";

// [LAW:no-ambient-temporal-coupling] The mirror of TOAST_HELD_OPEN_SECONDS in the
// paired Python fixtures, in this side's units: `Notification.timeout` is
// milliseconds here and seconds there. Held open, the toast is the frame's resting
// state rather than a race between the dismissal timer and the screenshot.
export const TOAST_HELD_OPEN_MS = 3_600_000;

export interface FixtureToast {
  readonly message: string;
  readonly title: string;
  readonly severity: NotificationSeverity;
}

export interface NotifyOnMountProps {
  readonly toasts: readonly FixtureToast[];
}

/**
 * Mirrors the Python fixtures' `on_mount` calling `self.notify(...)`.
 *
 * [LAW:one-type-per-behavior] One toast and three toasts differ only in the data
 * they carry, so both fixtures instantiate this with a different array rather than
 * growing a second component.
 */
export function NotifyOnMount({ toasts }: NotifyOnMountProps): null {
  const app = useTextual();

  React.useEffect(() => {
    for (const toast of toasts) {
      app.notify(toast.message, {
        title: toast.title,
        severity: toast.severity,
        timeout: TOAST_HELD_OPEN_MS,
      });
    }
  }, [app, toasts]);

  return null;
}
