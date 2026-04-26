# Docs Spec: API — compose()

## Purpose
Describes the API reference doc for the `compose` helper, which builds a widget tree from a generator (including nested context-manager-style containers) outside of the standard widget composition lifecycle.

## Audience
Application and widget authors who need to construct children on demand from an event handler, action, or callback — that is, anywhere outside a widget's own compose method.

## Required sections
1. Overview: what the helper does, and why it exists (compose generators that yield widgets, including nested groups, from arbitrary call sites).
2. Signature: accepts a parent node (app or widget) for context, and an optional compose-result generator. If no generator is provided, the helper invokes the node's own compose method.
3. Return value: an ordered list of Widget instances representing the top level of the generator's output, with any nested children already attached.
4. Nesting via context-manager-style containers: widgets yielded inside a container context are added as children of that container.
5. Validation guarantees: every yielded value must be a Widget; every widget must be initialized; violations throw a framework-level mount error.
6. Typical use cases: handling a keyboard event by mounting ad-hoc UI, generating children in an action, lazy-constructing a subtree.

## Key concepts
- `compose` is a bridge for using the generator-plus-nesting style outside of the `compose` lifecycle method.
- It delegates to the parent node for app context (composition state, mount context).
- It plays well with `mount_all` / equivalent bulk-mount APIs to attach the resulting tree to the live DOM.

## Behaviors and contracts
- Yielding a non-widget value must throw a mount error (and, when possible, the error is re-thrown into the generator for clean teardown).
- Yielding a widget that was not properly initialized must throw a mount error.
- The helper must support arbitrary nesting depth of context-manager-style containers.
- When no compose-result is supplied, invoking the node's own compose method must produce the same result as the standard lifecycle call.

## Example requirements
All examples must be JSX/TypeScript using Ink primitives and textual-js APIs:
- Handling a key event by composing a small group of widgets and mounting them with `mount_all` (or equivalent).
- Composing a nested tree using context-manager-style group containers (e.g., HorizontalGroup/VerticalGroup).
- Using `compose` with no generator argument to re-run a widget's own compose lifecycle.

## Cross-references
- `spec/docs-spec/api_app.md` (mount API that typically consumes the result).
- `spec/docs-spec/api_await_complete.md` (mount returns an AwaitComplete handle).
- `spec/spec-src/09-widget-base-contract.md` (compose lifecycle).
- `spec/spec-src/02-dom-reactivity-and-query.md` (DOM attach semantics).

## Notes for writers
- Python specifics to drop: generator functions with `yield`, the `with container:` context manager idiom, `__init__`-based widget initialization. Translate to the textual-js idiom: `compose` accepts an iterable/generator of widget instances, and nesting is achieved by a scope/context API the framework exposes (for example, a `useGroup()` helper or a JSX-native wrapping component). If textual-js favors JSX children for nesting instead of generators, the doc should primarily show JSX and treat the generator variant as the escape hatch.
- The Python example using `with containers.HorizontalGroup():` translates to either JSX `<HorizontalGroup>...</HorizontalGroup>` or a framework-supplied scope helper; pick whichever the library actually exposes.
- Do not describe `ComposeResult` as `Iterable[Widget]` in Python terms; describe it as the framework's generator-return type (TS alias).
- Keep the validation behavior; it is a user-observable contract that prevents silent partial trees.
