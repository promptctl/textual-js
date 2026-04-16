# Docs Spec: Widget (base contract)

## Purpose
Document the `Widget` base contract in textual-js: how widgets are authored as React function components wrapped in `observer()`, what props/attributes the framework recognizes, the lifecycle from mount through unmount, and the full surface area (mounting, removal, focus, scrolling, rendering, styling, selection, notifications, batching, lookup, actions, event handling).

## Audience
Widget authors and application authors — this is the core reference page of the framework.

## Required sections
1. Overview (widgets as React components with framework-managed identity, TCSS classes, focus, and messaging)
2. Authoring model (function component wrapped with `observer()`, framework wraps it into a DOM node on mount)
3. Construction props (children, `name`, `id`, `classes`, `disabled`, `markup`)
4. Class-level configuration (DEFAULT_CSS replaced by TCSS; DEFAULT_CLASSES; COMPONENT_CLASSES; BORDER_TITLE/SUBTITLE; ALLOW_MAXIMIZE; ALLOW_SELECT; FOCUS_ON_CLICK; BLANK; can_focus; can_focus_children)
5. Reactive attributes (MobX observables: expand, shrink, auto_links, disabled, hover_style, highlight_link_id, loading, virtual_size, has_focus, mouse_hover, scroll_x/y, scroll_target_x/y, show_vertical_scrollbar, show_horizontal_scrollbar)
6. Border title / subtitle descriptors
7. Derived properties (siblings, visible siblings, scroll allowances, offset, opacity, anchoring, mouse over, maximization state, text selection, disabled-ancestor check, first/last-of-type/child flags, odd/even, tooltip, max scroll, scrollbar regions, background/color tuples, widget-level lock)
8. CSS pseudo-classes (`:hover`, `:focus`, `:blur`, `:can-focus`, `:disabled`, `:enabled`, `:dark`, `:light`, `:focus-within`, `:inline`, `:ansi`, `:nocolor`, `:first/last-of-type`, `:first/last-child`, `:odd`, `:even`, `:empty`)
9. Composition (`compose`, `recompose`, context-manager nesting in JSX equivalents)
10. Mounting (`mount`, `mountAll`, mount position via `before`/`after`, `AwaitMount`)
11. Removal (`remove`, `removeChildren`, `AwaitRemove`)
12. Moving children
13. Rendering (`render`, `renderLine`, `renderLines`, `renderStr`)
14. Refreshing (repaint vs. layout vs. recompose)
15. Focus (`focus`, `blur`, `allowFocus` / `allowFocusChildren` overrides, click-to-focus hook)
16. Scrolling (absolute, relative, home/end, per-direction unit and page scrolls, scroll-to-widget/region, scroll-visible, scroll-to-center, set-scroll)
17. Anchoring (anchor/release behaviors for auto-scroll-to-bottom)
18. Mouse capture and release
19. Print capture (stdout/stderr as `Print` messages)
20. Text selection helpers
21. Loading overlay (`setLoading`, customizing the loading widget)
22. Layout hooks (`preLayout`, `processLayout`, `preRender`)
23. Content dimensions (`getContentWidth`, `getContentHeight`, clearing cached dimensions)
24. Styling helpers (`getComponentStyle`, `getVisualStyle`, `getPseudoClassState`)
25. Tooltips (`withTooltip` chainable)
26. Notifications (`notify`, thread/reactive safety)
27. Batching updates (`batch` async context)
28. Widget lookup (`getChildById`, `getWidgetById`, `getChildByType`)
29. Built-in actions (scroll_home/end, scroll_left/right/up/down, page_up/down/left/right, notify)
30. Event handling (`runAction`, `postMessage`, `checkMessageEnabled`, `brokerEvent`, `handleKey`, `checkConsumeKey` for keyboard-capturing widgets)
31. Errors (`MountError`, `WidgetError`)

## Key concepts
- Widgets are React function components wrapped in `observer()`; the framework manages lifecycle, identity, and TCSS integration behind the scenes.
- Reactive attributes are MobX observables; updating them triggers re-rendering wherever they are observed.
- TCSS provides the styling layer (parsed via css-tree); there is no per-widget `DEFAULT_CSS` string containing class-default rules — instead, widgets ship with named TCSS assets.
- Pseudo-classes are matched against widget runtime state and drive selector resolution.
- The widget tree is a DOM — widgets can be queried, walked, and manipulated via the query/walk APIs.
- Scrolling is a first-class concept on every widget; even non-scrollable widgets respond to the API (as no-ops or by forwarding).
- Focus, mouse capture, and print capture are mediated by single enforcers on the app, not by each widget independently.
- Mount / remove are asynchronous and return awaitables so callers can sequence DOM changes deterministically.
- Batching combines update coalescing with a widget-level lock for safe multi-step mutations.

## Behaviors and contracts
- A widget cannot be its own child; mounting one in its own tree fails loudly.
- Mounting before the widget itself is attached fails loudly.
- `before` and `after` on mount are mutually exclusive.
- Duplicate ids in a mount batch fail loudly with a clear error.
- `refresh()` with `layout: true` triggers layout; with `recompose: true` remounts children.
- `focus()` walks to the first focusable candidate using the configured focus strategy.
- `blur()` transfers focus to the next focusable widget in the chain.
- `disabled` blocks mouse events, except scroll events which still propagate.
- `is_disabled` checks the ancestor chain — ancestor disabled disables descendants.
- Loading overlay is a visual state; the widget's children are not unmounted.
- Component class styles are looked up by name; asking for an unknown class without a default raises an error.
- Text selection respects `ALLOW_SELECT` and container semantics.
- `batch()` guarantees that callers within the batch see a consistent widget state; renders are coalesced.
- `postMessage` returns whether the message was queued.
- `checkConsumeKey` hides bindings from the footer while the widget holds the key — important for `Input`/`TextArea`.

## Example requirements
All examples are JSX/TypeScript, using Ink primitives. The doc must include:
- Minimal custom widget as an `observer()` function component with a single reactive attribute and `render` equivalent.
- Composition pattern: a parent widget yielding children via JSX and the equivalent of Python's `compose` context-manager nesting.
- Mounting children dynamically with `before` / `after` positioning and awaiting the returned promise.
- Moving an existing child to a new index.
- Focus flow: making a widget focusable (`can_focus = true`), focusing it, handling `:focus` pseudo-class styling.
- Scrolling to a specific child and smooth-scrolling to an absolute position.
- Setting and clearing a loading overlay around an async operation.
- Using `batch()` to remove and remount children atomically.
- A tooltip via `.withTooltip(...)` chainable.
- Reacting to a reactive attribute change with MobX `autorun` inside a widget lifecycle hook.
- Capturing print output while running an external library that logs to stdout.
- Handling a key binding via `checkConsumeKey` in an Input-like widget.

## Cross-references
- `spec/docs-spec/api_dom_node.md`
- `spec/docs-spec/api_reactive.md`
- `spec/docs-spec/api_query.md`
- `spec/docs-spec/api_message.md`
- `spec/docs-spec/api_events.md`
- `spec/docs-spec/api_screen.md`
- `spec/docs-spec/api_scroll_view.md`
- `spec/docs-spec/api_style.md`
- `spec/docs-spec/api_binding.md`
- `spec/spec-src/09-widget-base-contract.md`
- `spec/spec-src/02-dom-reactivity-and-query.md`
- `spec/spec-src/05-layout-render-and-compositor.md`

## Notes for writers
- textual-js widgets are React function components wrapped in `observer()` from mobx-react-lite. Do not present widgets as Python classes inheriting from `DOMNode`. The framework provides a base class internally, but the authoring surface is components with props and reactive state.
- Replace `DEFAULT_CSS` / `DEFAULT_CLASSES` class variables with "TCSS assets attached to the widget class" — textual-js uses TCSS files parsed via css-tree, not inline Python strings.
- `compose()` translates to JSX children; the Python context-manager pattern for nesting does not apply — JSX nesting is the idiomatic form. Mention this explicitly so Python readers are not confused.
- Do not mention `RLock`, `asyncio`, or `AwaitMount`/`AwaitRemove` as Python-specific awaitables. In JS these are Promises returned by `mount`/`remove`.
- Replace "Rich renderable" with the textual-js renderable type (Ink-compatible content). The `render` return type is a content node the compositor consumes.
- Do not document Python dunder methods (`__enter__`, `__exit__`, `__rich_repr__`); use the equivalent JS APIs or omit.
- Pseudo-class `:ansi` refers to ANSI color mode support in the terminal, not Python's Rich ANSI conversion.
- `NO_COLOR` is an environment variable — describe it in the context of the terminal environment, not Python.
- Be rigorous about which features are "reactive" (MobX observables) vs. "descriptors" (plain instance state with setters that trigger refresh). Call this out — it's load-bearing for correctness.
- When describing actions (`action_scroll_home`, etc.), use the textual-js action-dispatch naming convention documented in the actions spec; drop the `action_` Python prefix if the JS convention differs.
