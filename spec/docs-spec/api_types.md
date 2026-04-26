# Docs Spec: Public Types Barrel

## Purpose
Document the central public types barrel of textual-js — the single import location for type aliases, sentinels, and error classes most applications and widget authors need.

## Audience
Application authors and widget authors writing TypeScript; anyone looking up where a public type lives.

## Required sections
1. Overview (this is a re-export hub; each type's canonical definition lives elsewhere)
2. Exported types, grouped by domain (actions, animation, TCSS paths, widget-specific enums, reactive callbacks, message targets, sentinels, errors)
3. How to import types
4. Cross-references to the module each type is canonically defined in

## Key concepts
- One public import location keeps consumer code stable even if internal module layout changes.
- The barrel exports only types/classes that are part of the public contract; internal helpers stay un-exported.
- Domain grouping in the doc helps readers find what they need without scanning a flat list.

## Behaviors and contracts
- Any name listed in the barrel is part of the stable public API; removing one is a breaking change.
- Importing from deep internal paths is discouraged — consumers should rely on the barrel.
- Sentinel values (e.g., "no selection", "unused parameter") are identity-comparable singletons.

## Example requirements
All examples are JSX/TypeScript. The doc must include:
- A single import statement pulling several types from the barrel.
- Using a sentinel (e.g., no-selection) in a reactive observer component.
- Catching a public error class exported from the barrel.
- Annotating a prop with a literal-union type exported from the barrel (e.g., animation level, input-validation timing).

## Cross-references
- `spec/docs-spec/api_actions.md`
- `spec/docs-spec/api_reactive.md`
- `spec/docs-spec/api_animation.md`
- `spec/docs-spec/api_errors.md`
- Each referenced type's own canonical api_* doc

## Notes for writers
- This is a reference page, not a tutorial. Keep it short; point to canonical docs for details.
- Do not invent JS equivalents for Python-only types. If a Python-only type (e.g., `CSSPathType` specific to Python import paths) does not apply, either map it to the TCSS equivalent used in textual-js or omit it and note the omission in the barrel's changelog.
- Replace `CSSPathType` / `CSSPathError` language: textual-js uses TCSS files loaded via the app's configured TCSS loader; the equivalent types describe "paths or inline TCSS strings passed to the app".
- Do not mention Python's `TypeVar` syntax; describe generics with TypeScript's `<T>`.
