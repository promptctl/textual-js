# Digits Widget Spec

## Purpose

The `Digits` widget displays numerical values using tall, multi-line Unicode characters rendered in a 3x3 grid. Each supported character occupies 3 columns and 3 rows. The widget always renders at exactly 3 lines of height.

## Supported Characters

The following characters are rendered in the large 3x3 format:

- Digits: `0` through `9`
- Hex letters: `A` `B` `C` `D` `E` `F`
- Operators / symbols: `+` `-` `^` `x` `:`
- Currency: `$` `\u00a3` `\u20ac`
- Parentheses: `(` `)`

Any character not in the supported set is rendered in regular size (1 cell wide, placed on the third row).

The period (`.`) is replaced with a middle dot (`\u2022`) before rendering.

## Bold Variant

When the widget's resolved Rich style includes `bold`, a distinct set of heavier box-drawing glyphs is used for the 3x3 grid. This is selected automatically based on the computed style at render time.

## Properties

| Property | Type  | Description |
|----------|-------|-------------|
| `value`  | `str` | Read-only property returning the current displayed text. |

## Constructor

```python
Digits(
    value: str = "",
    *,
    name: str | None = None,
    id: str | None = None,
    classes: str | None = None,
    disabled: bool = False,
)
```

- `value` must be a `str`. A `TypeError` is raised if it is not.

## Methods

### `update(value: str) -> None`

Replaces the displayed text with `value`.

- Raises `TypeError` if `value` is not a `str`.
- Triggers a layout refresh only when the new value differs in length or rendered width from the current value. Otherwise only a repaint is triggered.

## Sizing Behavior

- **Width**: Determined by summing 3 cells per supported character and 1 cell per unsupported character. Reported via `get_content_width`.
- **Height**: Always 3 lines, unconditionally.

## Default CSS

```css
Digits {
    width: 1fr;
    height: auto;
    text-align: left;
    box-sizing: border-box;
}
```

## Text Alignment

The widget respects the `text-align` CSS rule. Valid values are `left`, `center`, and `right`. Any other value falls back to `left`.

## Focusable

No.

## Container

No.

## Reactive Attributes

None.

## Messages

None.

## Bindings

None.

## Component Classes

None.

## Selection Support

The widget implements `get_selection`, returning the raw `value` string when selected via text selection.

## Usage Patterns

### Static Display

Pass the value at construction time:

```python
yield Digits("3.141,592,653,5897", id="pi")
```

Unsupported characters (such as commas) render at regular size, providing natural formatting within the large digit display.

### Dynamic Updates

Mount with an empty or initial value, then call `update()` to change:

```python
def on_ready(self) -> None:
    self.set_interval(1, self.update_clock)

def update_clock(self) -> None:
    clock = datetime.now().time()
    self.query_one(Digits).update(f"{clock:%T}")
```

The colon (`:`) in time strings is a supported character, so `HH:MM:SS` renders entirely in the large format.
