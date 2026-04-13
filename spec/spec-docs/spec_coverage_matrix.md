# Spec Coverage Matrix

This document defines how documentation pages in `mkdocs-nav.yml` map to canonical files in `spec/`.

## Audit Snapshot

- Audit date: 2026-04-02
- Total markdown pages in nav: `235`
- Intentional index/section pages excluded from direct spec mapping: `12`
- Content pages requiring spec coverage: `223`
- Covered pages: `223`
- Uncovered pages: `0`

## Canonical Mapping Rules

| Documentation Path Pattern | Canonical Spec Target |
|---|---|
| `getting_started.md` | `spec/getting_started.md` |
| `tutorial.md` | `spec/tutorial.md` |
| `help.md` | `spec/help.md` |
| `widget_gallery.md` | `spec/widget_gallery.md` |
| `FAQ.md` | `spec/faq.md` |
| `roadmap.md` | `spec/roadmap.md` |
| `linux-console.md` | `spec/linux_console.md` |
| `guide/app.md` | `spec/app.md` |
| `guide/devtools.md` | `spec/devtools.md` |
| `guide/styles.md`, `guide/CSS.md` | `spec/css_overview.md` |
| `guide/queries.md` | `spec/dom_and_queries.md` |
| `guide/layout.md` | `spec/layout.md` |
| `guide/events.md` | `spec/events.md` |
| `guide/input.md` | `spec/input_handling.md` |
| `guide/actions.md` | `spec/actions_and_bindings.md` |
| `guide/reactivity.md` | `spec/reactivity.md` |
| `guide/design.md` | `spec/design.md` |
| `guide/widgets.md` | `spec/widgets_overview.md` |
| `guide/content.md` | `spec/content.md` |
| `guide/animation.md` | `spec/animation.md` |
| `guide/screens.md` | `spec/screens.md` |
| `guide/workers.md` | `spec/workers.md` |
| `guide/command_palette.md` | `spec/command_palette.md` |
| `guide/testing.md` | `spec/testing.md` |
| `widgets/<name>.md` | `spec/widget_<name>.md` (except header/footer => `spec/widget_header_footer.md`) |
| `api/<name>.md` | `spec/api_<name>.md` |
| `css_types/*.md` | `spec/css_types.md` |
| `events/*.md` | `spec/events_reference.md` |
| `styles/grid/*.md` | `spec/styles_grid.md` |
| `styles/links/*.md` | `spec/styles_links.md` |
| `styles/scrollbar_colors/*.md` | `spec/styles_scrollbar.md` |
| `styles/scrollbar_gutter.md`, `styles/scrollbar_size.md`, `styles/scrollbar_visibility.md` | `spec/styles_overflow.md` |
| `styles/align.md`, `styles/content_align.md` | `spec/styles_alignment.md` |
| `styles/display.md`, `styles/visibility.md`, `styles/opacity.md`, `styles/text_opacity.md` | `spec/styles_display_visibility.md` |
| `styles/dock.md`, `styles/offset.md`, `styles/position.md` | `spec/styles_dock_offset.md` |
| `styles/background.md`, `styles/background_tint.md`, `styles/tint.md`, `styles/hatch.md` | `spec/styles_background_tint.md` |
| `styles/keyline.md` | `spec/styles_keyline.md` |
| `styles/pointer.md` | `spec/styles_pointer.md` |
| `styles/overflow.md` | `spec/styles_overflow.md` |
| `styles/box_sizing.md` | `spec/styles_box_model.md` |
| `styles/color.md` | `spec/styles_colors.md` |
| `styles/border*.md`, `styles/outline.md` | `spec/styles_borders.md` |
| `styles/text_align.md`, `styles/text_style.md` | `spec/styles_text.md` |
| `styles/text_overflow.md`, `styles/text_wrap.md` | `spec/styles_text_advanced.md` |
| `styles/margin.md`, `styles/padding.md` | `spec/styles_spacing.md` |
| `styles/width.md`, `styles/height.md`, `styles/min_*.md`, `styles/max_*.md` | `spec/styles_dimensions.md` |
| `styles/layer.md`, `styles/layers.md` | `spec/styles_layers.md` |
| `styles/layout.md` | `spec/styles_layout.md` |
| `how-to/*.md` | `spec/how_to.md` |

## Index Pages Excluded From Direct Mapping

These are section/index pages and are intentionally excluded from one-to-one mapping:

- `index.md`
- `guide/index.md`
- `reference/index.md`
- `css_types/index.md`
- `events/index.md`
- `styles/index.md`
- `styles/grid/index.md`
- `styles/links/index.md`
- `styles/scrollbar_colors/index.md`
- `widgets/index.md`
- `api/index.md`
- `how-to/index.md`

## Verification Command

Use this command to validate coverage after doc/spec changes:

```bash
python3 - <<'PY'
import re, pathlib
nav = pathlib.Path('mkdocs-nav.yml').read_text()
paths = re.findall(r'"([^\"]+\\.md)"', nav)
print(f"nav_paths={len(paths)}")
PY
```

For full rule-based validation, use the project audit script/check used in this update session.
