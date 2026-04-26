# Docs Spec: Help and Support Channels

## Purpose
Describes the short doc page that tells users where to go when they need help: bug reports, feature requests, usage questions, and realtime community chat.

## Audience
Anyone who hits a problem or wants to talk to maintainers or other users. The page is a routing table, not a guide.

## Required sections
1. Bugs and feature requests: point at the project's GitHub Issues endpoint.
2. Usage questions and how-to: point at GitHub Discussions.
3. Realtime community support: point at the project's Discord (or equivalent) invite.
4. Triage guidance: how to decide which channel to use (actionable work -> Issues; open-ended question -> Discussions; fast back-and-forth -> chat).

## Key concepts
- Three channels with distinct purposes.
- Users should check an existing roadmap or open issues before filing feature requests to avoid duplicates.
- Each channel has a distinct expected response profile (async/long for Issues and Discussions, synchronous for chat).

## Behaviors and contracts
- Each channel link must be a canonical URL maintained alongside the project repository — never an ephemeral invite that can expire without a replacement.
- The page must state "check the roadmap first" before filing feature requests.
- If the project maintains a code-of-conduct for any channel, the link must appear on this page.

## Example requirements
No code examples. This page is content-only. It is a set of links and short explanations.

## Cross-references
- `spec/docs-spec/faq.md` (may answer the user's question before they need to ask).
- The project README (top-level entry point).

## Notes for writers
- The specific URLs in the source (textualize/textual on GitHub, the Discord invite) are for the Python project and must be replaced with the textual-js project's own endpoints. Do not keep upstream URLs.
- No Python-specific content to strip; the page is channel routing only.
- Keep the page short — it is a link list, not prose.
