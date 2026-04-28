// [LAW:single-enforcer] NotificationService is the sole owner of the
// in-flight notifications collection, the showNotifications display gate, and
// the option-normalization rule that bridges the (severity-or-options-object)
// caller surface to the canonical NotificationInit shape.
// [LAW:one-source-of-truth] notifications + showNotifications live in exactly
// one place: this service. Framework methods are thin delegators that read
// through it.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { makeAutoObservable } from "mobx";

import {
  Notification,
  Notifications,
  type NotificationContent,
  type NotificationInit,
  type NotificationSeverity,
} from "../services/notifications.js";
import { Notify } from "../events/events.js";
import type { Message } from "../events/message.js";

export interface NotifyOptions extends Pick<NotificationInit, "severity" | "timeout" | "title" | "markup"> {}

// [LAW:one-way-deps] Narrow capability interface. The service publishes a
// Notify message through the host's app-message pump; nothing else.
export interface NotificationServiceDeps {
  postAppMessage(message: Message): void;
}

export class NotificationService {
  readonly notifications = new Notifications();
  showNotifications = true;
  private readonly deps: NotificationServiceDeps;

  constructor(deps: NotificationServiceDeps) {
    this.deps = deps;

    makeAutoObservable(
      this,
      {
        deps: false,
        notifications: false,
      } as never,
      { autoBind: true },
    );
  }

  notify(
    message: NotificationContent,
    severityOrOptions: NotificationSeverity | NotifyOptions = "information",
    timeout = Notification.timeout,
    title: NotificationContent = "",
    markup = true,
  ): Notification {
    const options = normalizeNotifyOptions(severityOrOptions, timeout, title, markup);
    const notification = new Notification(message, options);

    // [LAW:single-enforcer] Notification recording is gated at this boundary so
    // mount effects, widget helpers, and app calls all share the same transient policy.
    const storedNotification = this.showNotifications ? this.notifications.add(notification) : notification;
    this.deps.postAppMessage(new Notify(notification));
    return storedNotification;
  }

  dismissNotification(identity: string): void {
    const notification = this.notifications.list().find((entry) => entry.identity === identity);

    if (notification !== undefined) {
      this.notifications.delete(notification);
    }
  }

  clearNotifications(): void {
    this.notifications.clear();
  }

  unnotify(notification: Notification): void {
    // [LAW:one-source-of-truth] Object-based notification removal delegates to
    // the collection identity rule used by dismissNotification and expiry.
    this.notifications.delete(notification);
  }

  setShowNotifications(enabled: boolean | null | undefined): void {
    this.showNotifications = enabled ?? true;
  }
}

function normalizeNotifyOptions(
  severityOrOptions: NotificationSeverity | NotifyOptions,
  timeout: number,
  title: NotificationContent,
  markup: boolean,
): NotificationInit {
  if (typeof severityOrOptions === "object") {
    return {
      severity: severityOrOptions.severity,
      timeout: severityOrOptions.timeout,
      title: severityOrOptions.title,
      markup: severityOrOptions.markup,
    };
  }

  return { severity: severityOrOptions, timeout, title, markup };
}
