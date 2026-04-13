# Links

## Overview

Links in Textual are inline clickable regions within text content that trigger actions when clicked. They are defined using Rich markup syntax and route to action handlers across the widget, screen, and app namespaces.

### Syntax

Links are created using Rich's `@click` markup tag within text content. The general form is:

```
[@click=namespace.action_name('argument')]Display text[/]
```

The `@click` tag wraps the visible text that becomes clickable.

### Namespace Resolution

A link's action target is determined by the namespace prefix in the `@click` value:

- **`app.action_name`** -- Routes the action to the `App` instance. The app's `action_action_name` method is called.
- **`screen.action_name`** -- Routes the action to the current `Screen` instance. The screen's `action_action_name` method is called.
- **No prefix (`action_name`)** -- Routes the action to the widget that contains the link. The widget's `action_action_name` method is called.

### Action Arguments

Actions invoked through links can receive arguments. Arguments are passed using function-call syntax within the markup:

```
[@click=bell_message('baz')]Ring the bell![/]
```

String arguments are quoted within the parentheses. The argument is forwarded to the corresponding action handler method.

### Usage in Widgets

Links are embedded in text content passed to widgets such as `Label`. The widget renders the clickable region, and clicking it dispatches the action according to the namespace rules described above.

```python
Label("[@click=app.bell_message('foo')]Ring the bell![/]")
Label("[@click=screen.bell_message('bar')]Ring the bell![/]")
Label("[@click=bell_message('baz')]Ring the bell![/]")
```

## Constraints

- The `@click` markup must use Rich console markup syntax with a matching closing `[/]` tag.
- Namespace prefixes are limited to `app`, `screen`, or omitted (widget-local). Other prefixes are not supported.
- The action method on the target must follow the `action_` naming convention (e.g., `action_bell_message` for a `bell_message` action).
- When no namespace prefix is provided, the action resolves to the widget containing the link, not the screen or app.
- Each namespace prefix routes to exactly one target: `app` always means the `App` instance, `screen` always means the active `Screen`, and unqualified always means the owning widget.
