import { observable } from "mobx";
import { autoObservable } from "../framework/auto-observable.js";

import type { Content } from "../content/index.js";

export type NotificationSeverity = "information" | "warning" | "error";
export type NotificationContent = string | Content;

export interface NotificationInit {
  title?: NotificationContent;
  severity?: NotificationSeverity;
  timeout?: number;
  createdAt?: number;
  markup?: boolean;
}

let nextNotificationId = 1;

export class Notification {
  static timeout = 5000;

  readonly identity = `notification-${nextNotificationId++}`;
  readonly title: NotificationContent;
  readonly severity: NotificationSeverity;
  readonly timeout: number;
  readonly createdAt: number;
  readonly markup: boolean;

  constructor(
    readonly message: NotificationContent,
    init: NotificationInit = {},
  ) {
    this.title = init.title ?? "";
    this.severity = init.severity ?? "information";
    this.timeout = init.timeout ?? Notification.timeout;
    this.createdAt = init.createdAt ?? Date.now();
    this.markup = init.markup ?? true;
  }

  get hasExpired(): boolean {
    return this.timeout > 0 && Date.now() >= this.createdAt + this.timeout;
  }

  get has_expired(): boolean {
    // [LAW:one-source-of-truth] hasExpired is the canonical expiration check;
    // the Stage 5 compatibility alias derives from it so expiry cannot drift.
    return this.hasExpired;
  }

  get severityClass(): string {
    return `-${this.severity}`;
  }
}

export class Notifications implements Iterable<Notification> {
  private readonly entries = observable.array<Notification>([]);
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    autoObservable(
      this,
      {
        entries: false,
        expiryTimers: false,
      },
      { autoBind: true },
    );
  }

  get length(): number {
    this.pruneExpired();
    return this.entries.length;
  }

  add(notification: Notification): Notification {
    this.pruneExpired();
    this.entries.push(notification);
    this.scheduleExpiry(notification);
    return notification;
  }

  delete(notification: Notification): void {
    const index = this.entries.findIndex((entry) => entry.identity === notification.identity);

    this.clearExpiry(notification);

    if (index >= 0) {
      this.entries.splice(index, 1);
    }
  }

  has(notification: Notification): boolean {
    this.pruneExpired();
    return this.entries.some((entry) => entry.identity === notification.identity);
  }

  clear(): void {
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }

    this.expiryTimers.clear();
    this.entries.clear();
  }

  list(): Notification[] {
    this.pruneExpired();
    return this.entries.slice();
  }

  [Symbol.iterator](): Iterator<Notification> {
    return this.list()[Symbol.iterator]();
  }

  private pruneExpired(): void {
    const nextEntries = this.entries.filter((entry) => !entry.hasExpired);

    if (nextEntries.length !== this.entries.length) {
      for (const entry of this.entries) {
        if (entry.hasExpired) {
          this.clearExpiry(entry);
        }
      }

      this.entries.replace(nextEntries);
    }
  }

  private scheduleExpiry(notification: Notification): void {
    this.clearExpiry(notification);

    if (notification.timeout <= 0) {
      return;
    }

    const delay = Math.max(0, notification.createdAt + notification.timeout - Date.now());
    const timer = setTimeout(() => {
      // [LAW:single-enforcer] Expiration removal flows through pruneExpired so
      // timer-driven and access-driven cleanup share one deletion rule.
      this.pruneExpired();
    }, delay);

    // Expiry is housekeeping for a toast that is already on screen; it is never a
    // reason for the program to stay alive. Un-unref'd, a pending timer holds
    // Node's event loop for the whole timeout, so an app that notifies with a long
    // timeout and then finishes hangs until the toast would have faded. Same
    // reasoning as the launcher timer in services/url-opener.ts.
    timer.unref();

    this.expiryTimers.set(notification.identity, timer);
  }

  private clearExpiry(notification: Notification): void {
    const timer = this.expiryTimers.get(notification.identity);

    if (timer !== undefined) {
      clearTimeout(timer);
      this.expiryTimers.delete(notification.identity);
    }
  }
}
