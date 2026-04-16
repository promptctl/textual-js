# Docs Spec: Switch Widget

## Purpose
Describe the Switch widget: a focusable boolean on/off toggle that animates a
sliding indicator between two positions. Covers value semantics, toggling,
messages, animation behavior, bindings, and styling hooks.

## Audience
Application authors building settings panels, feature toggles, or any UI
that needs a binary on/off control.

## Required sections
1. Overview (what Switch looks like and does)
2. Props / constructor parameters (`value`, `animate`, standard widget
   props, `tooltip`)
3. Observable state (`value` reactive)
4. `toggle()` method (inverts value, emits a change message)
5. Messages: `Switch.Changed`
6. Bindings (Enter, Space toggle; click also toggles)
7. Component class: `switch--slider`
8. Automatic state class: `-on`
9. Animation semantics (animated vs. snap; duration; single timing source)
10. Default TCSS and key visual states (off, on, hover, focus, light theme)
11. Examples

## Key concepts
- A single boolean reactive `value` is the source of truth
- The visual slider position is a derived value, driven by `value` plus the
  animation system
- `-on` is an automatic CSS state class tied to slider position reaching the
  "on" endpoint; it supports styling without branching on `value` in CSS
- Clicking, pressing Enter, and pressing Space all route through the same
  toggle path (single code path, inputs vary)
- The `animate` prop controls whether value changes tween or snap
- `switch--slider` is the component class for restyling the slider region

## Behaviors and contracts
- Setting `value` programmatically is equivalent, in terms of messages and
  visuals, to the user toggling the switch
- `Switch.Changed` fires on every transition of `value`
- `toggle()` flips the value and returns the widget for chaining
- `animate: false` makes value changes snap immediately; the animation
  duration used when animating is a fixed short interval (documented as
  such but callers should not hard-code it)
- `ALLOW_SELECT` semantics: the switch does not participate in text
  selection (do not describe this in Python terms; describe the behavior)
- To remove borders and padding, the user sets `border: none; padding: 0`
  in TCSS
- Focus, hover, on, off, and light-theme variants all derive from a single
  set of style rules driven by state classes; no per-state branching is
  required in user code

## Example requirements
All examples JSX/TypeScript using Ink primitives:
- Basic Switch with a `Changed` handler
- Controlled usage: driving `value` from a MobX observable
- Toggle via a ref / imperative handle
- Disabling animation (`animate: false`)
- Styling the slider via the `switch--slider` component class
- Removing default borders for compact layouts

## Cross-references
- spec/docs-spec/animation.md (animation system that drives the slider)
- spec/docs-spec/api_events.md (Changed message wiring)
- spec/spec-src/03-message-event-and-dispatch.md
- spec/spec-src/10-widget-catalog.md (catalog entry)

## Notes for writers
- Do not reference Python `reactive` / `var` decorators; describe the
  observable behavior in terms of MobX observables in the JS widget.
- Do not describe the Python `ScrollBarRender` internal used to draw the
  slider; that is an implementation detail from the Python port and is not
  relevant to textual-js, which composes the visual via Ink primitives.
- Do not describe Python action names like `toggle_switch`; instead document
  the binding keys and what they do.
- The animation tween is described generically; do not hard-code 0.3s in
  the docs - defer specifics to the animation spec.
- Keep the contract clear: one boolean value is the source of truth; visual
  position is derived.
