# Visual Seam Audit — 2026-04-17

## Scope

Audit the "narrowed text contract" failure mode across the current textual-js codebase:

- higher-level specs describe rich-js renderables / visual values as first-class
- several implemented APIs collapse those values into `Content` or `string`
- tests have been written against both models in different places

The goal of this audit is to identify the architectural seam that should own this translation.

## Executive Summary

The repo currently has **two competing contracts**:

1. **Visual/renderable contract**  
   High-level specs and upstream Textual treat many widget surfaces as `VisualType` / renderable-bearing.

2. **Content-only contract**  
   Current implementation often normalizes at the API boundary with `Content.fromText(...)`, which narrows the accepted value to `string | Content | RichText`.

The result is a recurring divergence pattern:

- a feature is specified as renderable-capable
- tests or implementation are simplified to `string | Content`
- later work rediscovers the mismatch and patches individual call sites

The **right seam** is not "accept more unions everywhere."  
The right seam is a **single visual boundary** analogous to upstream `textual.visual`:

- one public **visual input type**
- one **visualization** step that promotes strings / `Content` / rich-js renderables into a canonical visual object
- one **render bridge** that converts that visual object into Ink output / `Strip`s

`Content` remains the canonical type for **text-oriented** surfaces.  
It should not remain the canonical type for **all display surfaces**.

## Findings

### 1. Code has a de facto narrow seam at `Content.fromText(...)`

The current implementation uses `Content.fromText(...)` as the main display normalization boundary:

- `src/widgets/static.ts`
- `src/widgets/button.ts`
- `src/widgets/toggle.ts`
- `src/widgets/static-component.tsx`
- `src/widgets/button-component.tsx`
- `src/framework/app-framework.ts` (tooltip normalization)
- `src/styles/borders.ts`

This is the core structural issue. Once a surface crosses this seam, arbitrary rich-js renderables are no longer representable.

### 2. Upstream Textual uses a broader seam: `VisualType` + `visualize(...)`

Python Textual already separates:

- **text-oriented** inputs such as button/toggle labels
- **visual/renderable** inputs such as `Static.content`, `Widget.tooltip`, command-palette displays, option prompts

Authoritative upstream references:

- `textual.visual.VisualType`
- `textual.visual.visualize(...)`
- `textual.widgets._static.Static(content: VisualType = "")`
- `Widget.tooltip: VisualType | None`

That seam is broad enough for strings, `Content`, and Rich renderables, but still has a single owner.

### 3. The repo's own specs are internally inconsistent

Higher-level spec files describe a rich-js / renderable-first world:

- `spec/spec-src/00-overview-and-scope.md`
- `spec/spec-src/05-layout-render-and-compositor.md`
- `spec/spec-src/10-widget-catalog.md`
- `spec/spec-src/12-supporting-subsystems.md`

Those files claim, among other things:

- widgets produce/consume rich-js content and renderables
- the package re-exports renderable vocabulary
- `Static` is a rich-content widget
- command-palette display values are visual/renderable-bearing

But several spec-test files still encode the narrowed `Content`/`string` contract:

- `spec/spec-tests/static.md`
- `spec/spec-tests/widget.md` (tooltip currently narrowed in practice)
- `spec/spec-tests/command_palette.md`

This is why the same divergence can reappear "legitimately" during implementation: the spec layers do not currently agree on the boundary.

### 4. Current implementation already hints at the correct split

Not every surface should be widened.

Upstream and current JS intent both suggest this split:

#### Text-oriented surfaces

These should stay `Content`-oriented:

- button label
- toggle label
- border titles/subtitles
- validation/help strings where only text semantics are required

These need text operations such as:

- `plain`
- `firstLine`
- `truncate`
- span-preserving markup parsing

#### Visual/renderable surfaces

These should be widened to a visual seam:

- `Static.content`
- `Label.content`
- `Widget.tooltip`
- command-palette `display` / `matchDisplay`
- future option prompts / select labels / richer display-only widget surfaces

These do **not** need to collapse to text at the boundary. They need to preserve arbitrary display structure.

### 5. The recent render fix closed one symptom, not the seam problem

The new shared bridge in `src/content/render.tsx` fixed the "styled `Content` is flattened to plain text" bug for current `Content`-based call sites.

That was correct and necessary.

But it does **not** solve the broader seam problem, because the value has already been narrowed before rendering in:

- `Static`
- tooltip state
- command-palette result types
- any future visual-bearing widget surfaces built on the same pattern

### 6. Package/API export drift reinforces the confusion

High-level specs say the root package re-exports rich-js vocabulary such as:

- `Style`
- `Segment`
- `Color`
- renderables such as `Bar`, `Gradient`, `Sparkline`, `Digits`

Current `src/index.ts` does not expose that broader vocabulary. It exports `Content` and `Strip`, but not the broader renderable layer.

That is not the first thing to fix, but it confirms the codebase is still sitting on the narrowed contract.

## The Right Seam

## Canonical split

Introduce and standardize two separate boundary types:

### 1. `ContentInput`

Use for **text-oriented** surfaces only.

Examples:

- button label
- toggle label
- border title/subtitle
- validation/help text that is inherently textual

Canonical owner:

- `src/content/content.ts`

### 2. `VisualInput` / `Visual`

Use for **display/renderable** surfaces.

Examples:

- `Static.content`
- `Label.content`
- `Widget.tooltip`
- command-palette display fields
- future option/select/table cell prompt surfaces

Canonical owner should be a new module, e.g.:

- `src/content/visual.ts`

with responsibilities analogous to upstream:

- `type VisualInput = string | Content | RichText | RichRenderable | Visual`
- `visualize(value, options): Visual`
- `measureVisual(...)`
- `renderVisual(...)`

`renderContent(...)` can either become a special case of `renderVisual(...)` or remain as the text-only adapter beneath it.

## What the seam should forbid

The seam should make these patterns impossible or at least non-canonical:

- ad hoc unions per widget like `string | Content | null` vs `string` vs `ContentInput`
- widget-local renderable detection
- `Content.fromText(...)` as the boundary for visual-bearing APIs
- React-node-based text/display contracts for framework content

The goal is:

- one owner for text normalization
- one owner for visual/renderable normalization
- one owner for rendering those values to Ink / `Strip`s

## Recommended alignment order

### Step 1: Specs

Resolve spec contradictions first.

Required decisions:

- `Static` is a visual-bearing surface, not merely a `Content` wrapper
- `tooltip` is a visual-bearing surface
- command-palette display values are visual-bearing surfaces
- button/toggle labels remain text-oriented

### Step 2: Tests

Add or update tests so they assert the split above rather than a global `Content`-only model.

### Step 3: Code

Implement the seam in this order:

1. add `visual.ts` with `VisualInput` + `visualize(...)`
2. migrate `Static`
3. migrate tooltip state
4. migrate command-palette hit/display types
5. only then widen other visual-bearing widgets as they land

## Recommendation

Do **not** keep widening individual call sites from `string | Content` to `string | Content | X | Y | Z`.

That path recreates the same divergence in every widget.

Instead:

- keep `Content` as the single source of truth for **text**
- introduce `Visual` as the single source of truth for **renderables / display values**
- make widgets choose one of those two seams explicitly

That matches upstream Textual much more closely and gives the JS port a clean, durable boundary.
