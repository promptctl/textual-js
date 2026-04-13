# Driver

The driver is the abstraction layer between the application and the terminal. It is responsible for translating raw terminal input into Textual events and synthesizing higher-level events from sequences of lower-level ones.

## Accessing the Driver

The driver is available on the app instance as `app._driver`. In tests, it is used after entering an `app.run_test()` context.

### Processing Messages

The driver exposes a `process_message` method that accepts low-level terminal events (e.g., `MouseDown`, `MouseUp`) and feeds them into the application's event system.

```python
app._driver.process_message(MouseDown(None, 0, 0, 0, 0, 1, False, False, False))
```

### Click Synthesis from MouseDown and MouseUp

The driver synthesizes `Click` events from `MouseDown` / `MouseUp` pairs. When a `MouseDown` is followed by a `MouseUp`, the driver automatically produces a `Click` event after the `MouseUp`. The resulting message sequence is `MouseDown`, `MouseUp`, `Click` — always in that order.

### Click Targeting and Widget Boundaries

Click synthesis is sensitive to widget boundaries:

- If both `MouseDown` and `MouseUp` land on the **same widget**, a `Click` is produced (and the widget receives the interaction — e.g., a `Button` fires `ButtonPressed`).
- If `MouseDown` and `MouseUp` land on the same widget but at **different coordinates within it**, a `Click` is still produced. Movement within a single widget does not cancel the click.
- If the mouse moves **outside the original widget** between `MouseDown` and `MouseUp`, **no `Click` is produced**. This is a drag-away-to-cancel behavior.

## Constraints

- `Click` is always the **third** event in the sequence — it never arrives before or between `MouseDown` and `MouseUp`.
- Click synthesis requires both `MouseDown` and `MouseUp` to resolve to the same widget; the comparison is at the widget level, not at the coordinate level.
- The driver is accessed via `app._driver`; it is not instantiated independently of an app.
