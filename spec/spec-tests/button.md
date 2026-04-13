# Button

## Overview

A `Button` is a clickable widget that posts a `Button.Pressed` message when activated. Buttons support visual variants, rich-text labels, multiline labels, outline styling, and a disabled state.

### Variants

A button's `variant` parameter controls its visual style. The available variants are:

- `"default"` -- the standard button appearance (used when no variant is specified).
- `"primary"` -- indicates a primary action.
- `"success"` -- indicates a successful or positive action.
- `"warning"` -- indicates a cautionary action.
- `"error"` -- indicates a dangerous or destructive action.

`Button()` with no variant argument uses `"default"`. The variant is passed as a keyword: `Button("Quit", variant="error")`.

### Labels

- The first positional argument is the button label: `Button("Hello")`.
- When no label is provided, the button renders with an empty or default label: `Button(variant="primary")`.
- Labels support Rich markup: `Button("[italic red]Focused[/] Button")`.
- The `label` property can be reassigned at runtime to change the displayed text: `button.label = "Disabled"`.

### Multiline Labels

- Labels containing newline characters render across multiple lines: `Button("Button\nwith\nmulti-line\nlabel")`.
- The button's height grows to accommodate all lines of the label.
- When the button has an explicit CSS `height` larger than its label content, the label is vertically centered within the available space.

### Sizing

- Buttons have a natural width and height determined by their label content.
- CSS `height` overrides the natural height: setting `height: 9` makes the button taller and centers the label within.
- Buttons participate in standard layout: within a `Horizontal` container with `width: auto`, buttons take their natural width; with `width: 1fr`, buttons expand to fill equal fractions.
- Multiple buttons inside a `width: auto` container sit side by side, each at its natural width.

### Outline Style

- The CSS `outline` property can be applied to a button: `Button { outline: white; }`.
- The outline renders around the button border, outside the button's normal content area.

### Disabled State

- A button can be created disabled: `Button("Disabled", disabled=True)`.
- A button can be disabled programmatically at runtime: `button.disabled = True`.
- Re-enabling is symmetric: `button.disabled = False`.
- A disabled button does not respond to interaction and is visually distinct.
- Buttons inside a disabled container inherit the disabled state.

### Loading State

- Setting `button.loading = True` puts the button into a loading state, which makes it unclickable: click events are ignored and `Button.Pressed` is not posted.
- Setting `button.loading = False` restores normal click behavior.
- The loading state is distinct from (and independent of) the disabled state.

### Pressed Message

- When a button is clicked (and not disabled), it posts a `Button.Pressed` message.
- Handlers can be attached via the convention method `on_button_pressed(self, event: Button.Pressed)` or via the `@on(Button.Pressed)` decorator.
- The `@on` decorator supports CSS selectors to route presses from specific buttons: `@on(Button.Pressed, "#ok")`, `@on(Button.Pressed, ".exit")`.
- The `event` object identifies which button was pressed.

## Constraints

- `variant` must be one of `"default"`, `"primary"`, `"success"`, `"warning"`, or `"error"`. These are the single source of truth for button visual classification.
- A disabled button must never post `Button.Pressed`.
- A button in a loading state (`loading=True`) must never post `Button.Pressed`.
- Label content (including markup and newlines) is display-only; the label string is the single source of truth for what the button displays.
- Outline is applied via CSS, not via a widget parameter. Styling and structure remain separated.
- Disabling via `button.disabled` and disabling via a disabled ancestor container produce the same visual and interactive result.
