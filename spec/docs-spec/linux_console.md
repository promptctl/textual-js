# Docs Spec: Linux Console Notes

## Purpose
Describes a short platform-notes doc page covering the limitations users encounter when running textual-js apps directly on the Linux console (bare TTY, no desktop environment), and the font workaround that can improve rendering.

## Audience
Users who run terminal apps outside a desktop environment — typically on servers, rescue shells, or low-resource Linux systems — and find that the UI doesn't look right.

## Required sections
1. Overview: what the Linux console is, and that it has reduced graphical capability compared to terminal emulators inside a desktop session.
2. Graphical limitations: apps that render correctly in a desktop terminal may look wrong (misaligned box-drawing, missing glyphs, reduced colors) on a bare console.
3. Font support: the `font-for-textual` project (https://github.com/jsatchell/font-for-textual) as a known workaround for improving glyph rendering on the Linux console.
4. Platform context: Linux distros include desktop terminal emulators that work fine; this doc applies only to the bare TTY case.

## Key concepts
- Console capability vs. terminal emulator capability is a hard distinction — the Linux console is not a terminal emulator and does not support the same escape sequences, colors, or glyphs.
- A font change is the single available lever for improving rendering; textual-js itself cannot work around console limits.

## Behaviors and contracts
- The page must clearly state which environment is affected (bare TTY) and which is not (desktop-hosted terminal emulator).
- The page must link to the upstream `font-for-textual` project without embedding its license/install steps — it is a third-party solution.
- The page should set expectations: even with the font fix, full-fidelity rendering requires a real terminal emulator.

## Example requirements
No code examples. This is a platform-notes page; the content is advisory, not instructional.

## Cross-references
- `spec/docs-spec/faq.md` (terminal compatibility entries).
- `spec/docs-spec/getting_started.md` (platform requirements section).

## Notes for writers
- The `font-for-textual` project name is upstream and may or may not apply verbatim to textual-js; verify before keeping the link. If the project does not extend coverage to textual-js, describe the general "install a better-matched console font" approach and drop the specific link.
- No Python-specific content to strip; the page is about console/terminal capability, not language runtime.
- Keep the page short. It's a note, not a guide.
- Applicability: this doc is still useful for textual-js because the rendering limits come from the Linux console itself, not from the framework's language. Users running on bare TTYs will hit the same issues.
