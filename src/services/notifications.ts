import { makeAutoObservable, observable } from "mobx";

export type NotificationSeverity = "information" | "warning" | "error";

export interface NotificationInit {
  title?: string;
  severity?: NotificationSeverity;
  timeout?: number;
  createdAt?: number;
}

let nextNotificationId = 1;

export class Notification {
  static timeout = 5000;

  readonly identity = `notification-${nextNotificationId++}`;
  readonly title: string;
  readonly severity: NotificationSeverity;
  readonly timeout: number;
  readonly createdAt: number;

  constructor(
    readonly message: string,
    init: NotificationInit = {},
  ) {
    this.title = init.title ?? "";
    this.severity = init.severity ?? "information";
    this.timeout = init.timeout ?? Notification.timeout;
    this.createdAt = init.createdAt ?? Date.now();
  }

  get hasExpired(): boolean {
    return this.timeout > 0 && Date.now() >= this.createdAt + this.timeout;
  }
}

export class Notifications implements Iterable<Notification> {
  private readonly entries = observable.array<Notification>([]);

  constructor() {
    makeAutoObservable(
      this,
      {
        entries: false,
      } as never,
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
    return notification;
  }

  delete(notification: Notification): void {
    const index = this.entries.findIndex((entry) => entry.identity === notification.identity);

    if (index >= 0) {
      this.entries.splice(index, 1);
    }
  }

  has(notification: Notification): boolean {
    this.pruneExpired();
    return this.entries.some((entry) => entry.identity === notification.identity);
  }

  clear(): void {
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
      this.entries.replace(nextEntries);
    }
  }
}
