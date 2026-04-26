# Docs Spec: Spec Coverage Matrix

## Purpose
Describes the internal contributor-facing page that maps documentation pages in the navigation config to their canonical behavioral spec files, and that documents the audit procedure used to confirm coverage.

## Audience
textual-js documentation maintainers and contributors who add, move, or remove docs pages and must keep spec coverage intact. Not intended for end users.

## Required sections
1. Purpose of the matrix — what a "spec" is in textual-js terms and why every doc page maps to one.
2. Audit snapshot — date, total nav pages, excluded index/section pages, covered vs. uncovered counts.
3. Canonical mapping rules — a table of doc-path pattern to canonical spec target.
4. Index pages excluded from direct mapping — list of section/landing pages that intentionally have no 1:1 spec.
5. Verification procedure — the Node/TS script or command that validates coverage against the navigation config.
6. Update workflow — what contributors do when adding a new doc page or renaming an existing one.

## Key concepts
- Every content doc page has exactly one canonical spec target; index pages are the only exception.
- Mapping is by path pattern, not by per-file declaration, to keep the rule set small and mechanical.
- The audit is reproducible: a script parses the nav config, applies mapping rules, and reports uncovered pages.
- Style and widget pages cluster into grouped specs (e.g., all border/outline pages map to one borders spec).

## Behaviors and contracts
- The mapping must be total over content pages: every non-index nav entry resolves to an existing spec file.
- Uncovered pages block merging until either the spec is added or the page is moved under an approved exclusion.
- Section/index pages are enumerated explicitly; an undeclared "index"-shaped page is not implicitly excluded.

## Example requirements
One code example: the verification command itself, rewritten for the textual-js repo layout (Node script or package-json script), reading the nav config and reporting coverage. No Python in the example.

## Cross-references
- `spec/spec-src/00-overview-and-scope.md` — overall spec taxonomy.
- `spec/spec-src/99-source-coverage-matrix.md` — the machine-checkable source side of this matrix.
- The navigation config at the repo root (e.g., `docs/nav.ts` or equivalent) — single source of truth for doc paths.

## Notes for writers
- Do not reproduce the Python `python3 - <<'PY' ... PY` verification snippet verbatim; the textual-js repo runs on Node. Describe the audit command in Node/TS terms (e.g., `pnpm docs:audit` reading `docs/nav.*`).
- The mkdocs-specific path (`mkdocs-nav.yml`) does not exist in textual-js — substitute the actual nav source used by the JS docs site (Docusaurus / VitePress / Astro / whatever is in use) before publishing.
- Path patterns like `styles/grid/*.md` may rename; keep the mapping rule generic (grouping by topic) rather than pinning specific file names that might diverge.
- This page is a contributor doc — exclude it from the user-facing nav if the site has a separate contributor section.
- Avoid mentioning Python tooling, mkdocs, MkDocs Material, or any PyPI dependency.
