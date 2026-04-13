# Toast Widget Spec

## Purpose

Toast is a widget for displaying short-lived notification messages. It is not intended for direct use in applications. Instead, it is used internally by `App.notify()` as part of Textual's built-in notification system.

Added in version 0.30.0.

## Characteristics

- Not focusable
- Not a container
- Inherits from `Static` with `inherit_css=False`
- Has `DEFAULT_CLASSES = "-textual-system"`

## Constructor

```python
Toast(notification: Notification)
```

Takes a `Notification` object. The notification's `severity` is applied as a CSS class (e.g., `-information`, `-warning`, `-error`). The toast auto-expires based on `notification.time_left`.

## Rendering

The toast renders its notification's `message`. If `notification.markup` is `True`, the message is parsed as markup via `Content.from_markup`; otherwise it is treated as plain text.

If the notification has a `title`, it is prepended above the message using the `toast--title` component class style, separated by a newline.

## Behavior

- On mount, a timer is set for `notification.time_left` seconds. When the timer fires, the toast removes itself.
- Clicking the toast also removes it immediately (same expiry handler).
- On removal, the toast calls `app._unnotify()` to clear the notification from the app's notification list.

## Severity Levels

Three severity levels, each applied as a CSS class on the Toast widget:

| Severity | CSS Class | Border Color | Title Color |
|---|---|---|---|
| Information | `-information` | `$success` (left outer) | `$text-success` |
| Warning | `-warning` | `$warning` (left outer) | `$text-warning` |
| Error | `-error` | `$error` (left outer) | `$text-error` |

## Component Classes

| Class | Description |
|---|---|
| `toast--title` | Targets the title of the toast. |

Default styling for `toast--title`: bold text, `$foreground` color.

## Default CSS

- Width: 60 columns, max-width 50%
- Height: auto
- Top margin: 1
- Padding: 1 1
- Background: `$panel-lighten-1`
- Link styles configured for foreground color with underline; hover uses `$primary` background and bold style

## ToastRack

`ToastRack` is the container that holds all active toasts. It is also not intended for direct use.

- Docked to the bottom of the screen
- Aligned right-bottom by default
- Uses a dedicated layer `_toastrack`
- Vertical layout with `overflow-y: scroll`
- Display is toggled based on whether there are active notifications
- Has `DEFAULT_CLASSES = "-textual-system"`

### Customizing Toast Position

Target `ToastRack` in CSS to change where toasts appear:

```scss
ToastRack {
    align: right top;
}
```

## ToastHolder

`ToastHolder` is an intermediate container wrapping each individual `Toast`, used to control per-toast alignment.

- Aligned right horizontally by default
- Width: 1fr, height: auto
- Visibility: hidden (the Toast itself sets visibility: visible)

## Reactive Attributes

None.

## Messages

None.

## Bindings

None.

## Styling Examples

Target all toasts:

```scss
Toast {
    padding: 3;
}
```

Target a specific severity:

```scss
Toast.-information {
    /* custom styling */
}

Toast.-warning {
    /* custom styling */
}

Toast.-error {
    /* custom styling */
}
```

Target the title within a severity:

```scss
Toast.-information .toast--title {
    text-style: italic;
}
```
