# Docs Spec: How-To Guides

## Purpose
Describes a landing/index page that collects the practical, pattern-oriented how-to guides for textual-js: how to use containers, how to design a layout, how to center things, when to use render vs. compose, how to style inline apps, and how to package/distribute an app.

## Audience
Intermediate users who have read Getting Started, built a first app, and now need opinionated answers to real-world layout and styling questions.

## Required sections
1. Containers: the built-in container widgets, their layout direction, sizing behavior, and scrolling behavior. A comparison table plus notes on when to pick each.
2. Alignment containers: Center, Right, Middle, and why there is no Left (left-alignment is the default).
3. Expanding vs. Group behavior: Horizontal/Vertical expand to fill; HorizontalGroup/VerticalGroup fit to content. Guidance on when each fits the job.
4. Scrolling behavior: default overflow is clipped; use the Scroll-variant containers or set the overflow CSS property explicitly.
5. Custom containers: create a container by composing a Widget with DEFAULT_CSS (or the textual-js equivalent).
6. Designing a layout: five-step workflow.
   - Sketch first.
   - Work outside in.
   - Dock fixed elements.
   - Use fr units for flexible regions.
   - Use containers for scrollable regions.
   - Document the typical layout-progression pattern.
7. Centering things: three mechanisms.
   - Widget alignment (`align` on the parent).
   - Text alignment (`text-align` on the widget, line-by-line).
   - Content alignment (`content-align` on the widget, whole content block).
   - Independently centering multiple widgets using individual Center wrappers.
   - Debugging tip: add a border to visualize dimensions.
8. Render vs. compose: what each does, when to use each, and how they combine (render draws a background, compose layers widgets on top).
9. Styling inline apps: enabling inline mode, default inline behavior, the `:inline` pseudo-selector, common inline-specific adjustments (height, border, colors).
10. Packaging and distribution: how to ship a textual-js app (npm package with an executable bin entry, or a standalone bundled CLI).

## Key concepts
- Containers are thin widgets whose only role is to provide default CSS for layout.
- fr units distribute available space proportionally; they're the same mechanism as the expanding Horizontal/Vertical containers.
- Docking removes a widget from normal flow and pins it to an edge; sibling flow reflows to account for the dock region.
- align, text-align, and content-align operate on distinct things: align repositions the widget in its parent's space, text-align aligns text within each line, content-align treats rendered content as a rectangle and positions it inside the widget.
- Render produces a single renderable (string or Rich-compatible output), compose produces a tree of children.
- The `:inline` pseudo-selector lets the same app style itself differently when running inline vs. fullscreen.
- Packaging for textual-js is npm-based; the app is distributed as a package exposing a CLI bin.

## Behaviors and contracts
- Containers must document both the layout direction they impose and whether they enable overflow/scrolling.
- The layout-workflow section must be prescriptive (steps in order), not a menu of options.
- align has no visible effect if the child already fills the container; the doc must state this and show the fix (`width: auto`).
- Multiple children under align center as a group, preserving relative positions; to center independently, each child gets its own Center wrapper.
- When a widget implements both render and compose, render is the background layer and compose is the foreground — document this ordering.
- Inline mode adds a blank line of padding above the app by default; the doc must call out how to remove it (`INLINE_PADDING = 0` equivalent).

## Example requirements
All examples JSX/TypeScript, using Ink primitives and the textual-js React API:
- A side-by-side comparison of Horizontal vs. HorizontalGroup, showing how two children divide (or don't divide) available space.
- A HorizontalScroll with overflow content to demonstrate scrolling.
- A custom container component that only provides DEFAULT_CSS (or the textual-js equivalent).
- The five-step layout workflow applied to a classic header/sidebar/main-content layout.
- Centering a single button (align on parent), centering multiple buttons independently (each in its own Center).
- text-align demo inside a single Static.
- content-align demo on a widget whose height is larger than its content.
- A widget implementing both render (background gradient) and compose (foreground widgets).
- An inline app that uses the `:inline` selector to shrink its screen height and remove its border.
- A minimal `package.json` + bin entry for distributing an app as an npm CLI, and an alternative that bundles to a single executable.

## Cross-references
- `spec/docs-spec/layout.md` (layout rules in depth).
- `spec/docs-spec/getting_started.md` (base concepts).
- `spec/docs-spec/faq.md` (short-form answers to some of the same questions).
- `spec/docs-spec/api_containers.md`.
- `spec/spec-src/05-layout-render-and-compositor.md` (behavioral spec).

## Notes for writers
- The Python source discusses Hatch packaging, `pyproject.toml`, `pipx`, PyPI, and `.tcss` file inclusion in build systems. Replace all of this with the npm ecosystem: `package.json`, npm/yarn/pnpm, npm registry, `bin` entries, bundlers (esbuild/tsup/rollup) for producing a single-file CLI, and the question of shipping `.tcss` files as package assets in a published module.
- There is no `textual-serve` equivalent mentioned for textual-js; omit that "web deployment" alternative unless the project actually has one.
- "DEFAULT_CSS" is a Python class variable convention. In textual-js, mirror the actual API (likely a static property on a component or a framework-provided helper for attaching default TCSS to a component).
- The `compose(self)` generator is replaced by JSX children. Describe render vs. compose in those terms: render returns a renderable string/content, children declared in JSX become composed subwidgets.
- Do not mention `asyncio`, decorators, or Python context managers. The `with Vertical(): ...` pattern is Python-specific; the equivalent is simply nesting JSX components.
- Keep the Pen-and-paper / Excalidraw sketch advice — it is language-agnostic.
