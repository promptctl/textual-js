# Integration notes for spec-src/99-source-coverage-matrix.md

## Critical context

- **Rich-js role**: several spec-tests files (`color.md`, `content_and_strip.md`, `markup.md`, `renderables.md`) test rich-js-integrated behavior. The matrix should ensure these are mapped to the right phases.
- **Terminal-UI reality**: no new missing rows; primary job is ensuring the existing mapping references the integration points that now exist in spec-src.

## Gaps to fix

### 1. Verify rich-js-related spec-tests are mapped

**Where**: "Spec-Tests to Phase Mapping" — per-phase tables.
**Current state**: `color.md`, `content_and_strip.md`, `markup.md`, `renderables.md` should be listed under specific phases.
**Why insufficient**: Ensure they're assigned:
  - `color.md` → Phase 2 (TCSS color resolution via rich-js `Color`)
  - `content_and_strip.md` → Phase 6 (rich-js Content/Strip are used heavily by advanced widgets like DataTable/Tree/Markdown/TextArea)
  - `markup.md` → Phase 6 (markup parsing via rich-js is used across content-bearing widgets; bulk of markup integration arrives with the widget catalog)
  - `renderables.md` → Phase 6 (Sparkline, Bar, Gradient, Digits renderables)
**Required change**: Verify the per-phase tables include these rows; add any that are missing. Update the focus column where needed to mention rich-js (e.g., `color.md` focus → "Color type: parse, blend, conversion, opacity — via rich-js Color").

### 2. Update spec file descriptions to reflect integration edits

**Where**: "Spec to Phase Mapping" table (column "Key Concerns").
**Current state**: Brief one-line descriptions.
**Why insufficient**: After the integration audit, some specs now contain rich-js-related content that wasn't there before. Worth updating the "Key concerns" column to mention:
  - `04`: add "… rich-js Color resolution, rich-js Style output"
  - `05`: add "… Line API mode and rich-js Strip → Ink conversion, output filter pipeline"
  - `09`: add "… Line API widget contract, rich-js rendering"
  - `10`: add "… markup-accepting content types, rich-js renderable wrapping"
  - `11`: add "… rich-js Style overlays on Shiki tokens"
  - `12`: add "… rich-js as content/color/renderable provider"
  - `14`: add "… Content → Ink bridge, output filter boundary"
**Required change**: Apply the above additions to the "Key Concerns" column entries.

### 3. Why some specs span multiple phases — verify

**Where**: "Why some specs span multiple phases" table.
**Current state**: Explanatory rows for specs 01, 02, 05, 06, 10, 12.
**Why insufficient**: May need to add/update for rich-js concerns (e.g., spec 04 spans phase 2 for parser and phase 6/7 for animated color via Animator).
**Required change**: Review each multi-phase row and confirm the explanation references the rich-js integration points where applicable. Minor adjustments only.

### 4. Unmapped test files — reconfirm status

**Where**: "Unmapped Test Files" table.
**Current state**: Lists 9 unmapped files (auto_refresh, compositor, driver, xterm_parser, file_monitor, filters, lazy, layouts, utilities).
**Why insufficient**: No change needed; these remain Not Applicable or covered elsewhere.
**Required change**: None — verify the reasoning columns still hold. No new unmapped files should be added.

### 5. Summary counts

**Where**: "Summary Counts" table at the bottom.
**Current state**: Per-phase count + 9 unmapped = 63.
**Why insufficient**: If any Phase 2 / Phase 6 mappings were added or moved in #1 above, counts may need adjusting.
**Required change**: After applying #1, recount each phase row and the total to match the actual `spec-tests/` file count.

## Do not change

- The phase structure (1–7)
- The overall matrix format
- The execution-order description
- Cross-references to `spec/impl/INDEX.md` conformance tracker
- The "unmapped" categorization (not applicable / covered by another)
