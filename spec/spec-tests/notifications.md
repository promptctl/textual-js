# Notifications

The notification system provides transient messages (toasts) displayed to the user. Notifications have a message, optional title, a severity level, a timeout for automatic expiry, and a unique identity.

### Notification Object

A `Notification` is created with a required `message` string. It supports the following properties:

- **message**: The notification text. Stored exactly as provided.
- **title**: An optional string; defaults to `""` (empty string) when not specified.
- **severity**: One of the severity levels (see below); defaults to `"information"`.
- **timeout**: Duration in seconds before the notification expires. Has a class-level default (`Notification.timeout`). Can be overridden per notification.
- **identity**: A unique string identifier automatically assigned at creation. Every notification instance receives a distinct identity, even when constructed with identical arguments.
- **has_expired**: A boolean property that returns `True` once the notification's timeout has elapsed since creation, `False` otherwise.

### Severity Levels

The default severity level is `"information"`. Severity is specified via the `severity` parameter when calling `notify()` or constructing a `Notification`.

### The Notifications Collection

`Notifications` is a container that manages a set of active notifications. It supports:

- **len()**: Returns the count of non-expired notifications. Expired notifications are pruned automatically when the length is checked.
- **add(notification)**: Adds a `Notification` to the collection.
- **del collection[notification]**: Removes a specific notification. Removing the same notification multiple times does not raise an error.
- **in**: Membership testing (`notification in collection`).
- **iter()**: Iteration yields notifications in insertion order.
- **clear()**: Removes all notifications immediately.

Expired notifications are automatically excluded from length checks and iteration. Adding notifications with short timeouts causes them to disappear from the collection once the timeout elapses, without any explicit removal.

### app.notify()

`App.notify(message, *, timeout, severity)` is the primary interface for raising a notification. Calling it adds a `Notification` to the app's internal `_notifications` collection.

- An app starts with zero notifications.
- Each call to `notify()` adds exactly one notification to the collection.
- The `timeout` parameter controls how long the notification persists before automatic expiry.

### app.clear_notifications()

`App.clear_notifications()` removes all active notifications from the app immediately. After calling it, the notification count is zero regardless of how many were present or their remaining timeout.

### app._unnotify(notification)

Removes a single specific notification from the app's collection. After removal, the notification count decreases by one.

### Notification Through Screens, Widgets, and the DOM

`notify()` is available at every level of the DOM hierarchy: `App`, `Screen`, and `Widget`. All calls funnel into the same app-level notification collection.

- An `App` calling `self.notify()` adds to the app's notifications.
- A `Screen` calling `self.notify()` adds to the same app-level notifications.
- A `Widget` calling `self.notify()` adds to the same app-level notifications.

When an app mounts and pushes a screen that also mounts a widget, and all three call `notify()` during `on_mount`, the app accumulates one notification per call (three total in that scenario).

### Toast Display

Notifications are displayed as toasts. The timeout value controls how long the toast remains visible. Once the timeout elapses, the notification expires (`has_expired` becomes `True`) and it is pruned from the active collection.

## Constraints

- Every `Notification` instance has a globally unique `identity`. Constructing 1000 notifications with identical arguments produces 1000 distinct identities.
- The default severity is `"information"`.
- The default title is an empty string (`""`).
- Expired notifications are automatically excluded from the `Notifications` collection's length and iteration without explicit removal.
- Deleting a notification that is not (or is no longer) in the collection is a no-op; it does not raise an error.
- `notify()` is callable from `App`, `Screen`, and `Widget`; all contribute to the single app-level notification list.
- `clear_notifications()` removes all notifications unconditionally, regardless of their remaining timeout.
