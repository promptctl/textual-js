# Widget Component Template

This file is the canonical implementation template for built-in widgets.

// [LAW:one-type-per-behavior] Shared widget behavior follows this single React/Ink component pattern. Do not introduce per-widget registration, styling, action, or fixture conventions.

## Public Shape

- Export user-facing widgets by Textual name: `Button`, `Input`, `ProgressBar`, `Static`, `Switch`.
- Do not export `ButtonWidget` / `InputWidget` component aliases. One public name per widget; a second name for the same component is a second source of truth for what to import.
- A widget that installs public instance members on its handle (Textual's public widget methods — `Input.validate`, and so on) exports one `WidgetNameHandle` interface describing exactly that surface, e.g. `InputHandle`. This is not the aliasing the rule above forbids: it names the *handle* a query returns, not the component. Without it every caller restates the same structural cast. Export it only when the widget really does install such members — never as a decorative synonym for the component.
- Keep backing state helpers internal to implementation modules and name them `WidgetNameModel`.
- Re-export only completed public widgets from `src/widgets/index.ts` and `src/index.ts`.

## File Set

For a widget named `Example`, add or update this complete set:

- `src/widgets/example.ts` - message types, model helpers, validation helpers.
- `src/widgets/example-component.tsx` - the React/Ink widget component.
- `tests/example.test.tsx` - behavior tests for rendering, focus, bindings, messages, and state.
- `visual-tests/fixtures/example.py` - Python Textual reference fixture.
- `visual-tests/fixtures/example.tsx` - textual-js fixture rendering the same layout.

## Component Skeleton

```tsx
// [LAW:one-way-deps] Component consumes framework services and owns only its
// message types plus visual rendering.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { innerBoxGeometry } from "../styles/box-geometry.js";
import { ExampleChanged } from "./example.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";

export interface ExampleProps extends WidgetComponentProps {
  value?: string;
  disabled?: boolean;
  loading?: boolean;
}

const DEFAULT_CSS = `
  Example {
    height: 1;
  }
`;

// [LAW:single-enforcer] ExampleChanged is posted only from Example.
export const Example = observer(function Example({
  id,
  classes,
  value = "",
  disabled,
  loading,
}: ExampleProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Example",
    focusable: true,
    disabled,
    loading,
    defaultCss: DEFAULT_CSS,
    bindings: [
      { key: "enter", action: "submit", description: "Submit" },
    ],
    actions: {
      action_submit: () => {
        widget.postMessage(new ExampleChanged(value));
      },
    },
    handlers: {
      onClick: () => {
        widget.postMessage(new ExampleChanged(value));
      },
    },
  });

  const styles = useStyles(widget.handle);

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...innerBoxGeometry(styles.box)}>{/* render rich-js or Ink content here */}</Box>
    </WidgetScope>
  );
});
```

## Required Pattern

- Call `useWidget` exactly once for the outer widget registration.
- Pass `typeName` equal to the public Textual widget name.
- Pass `defaultCss` from a local `DEFAULT_CSS` constant when the widget has default styling.
- Put keyboard behavior in `bindings` and `actions`; mouse behavior belongs in `handlers`.
- Post each widget message from the owning component only.
- Call `useStyles(widget.handle)` after registration and give your rendered Box only the inner half of the resolved styles — `innerBoxGeometry(styles.box)`, or `WidgetFrame`, which does it for you. Never spread the raw `styles.box`: `WidgetScope` already applies the outer half (margin and width) to the box it measures into `screenRegion`, so spreading the whole thing applies those twice.
- Wrap rendered output in `<WidgetScope widget={widget.handle}>`.
- Use `composeWidgetClasses` for authored classes plus derived state classes such as `-on` or `-primary`.
- Keep model helpers and non-React state classes out of the public widget barrel.

## Tests

Each component test file must cover the user-visible contract:

- Renders representative content.
- Registers with the expected `typeName`.
- Applies authored CSS through TCSS.
- Participates in focus when focusable.
- Runs key bindings through `Pilot`.
- Posts its message types once from the owning component.
- Suppresses input when disabled or loading, when the widget supports those states.

## Visual Fixtures

Every new widget component needs paired visual fixtures before it is complete:

```text
visual-tests/fixtures/example.py
visual-tests/fixtures/example.tsx
```

The fixtures must render equivalent layouts. Verify them with:

```bash
bash visual-tests/run.sh
```
