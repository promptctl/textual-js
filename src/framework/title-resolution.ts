// [LAW:one-source-of-truth] The precedence "screen title beats app title" is
// stated once, here. A Header that re-derived it would be a second clock: the
// day a mode or a modal grows its own title, one of the two copies gets taught
// about it and the other keeps answering the old way.
// [LAW:effects-at-boundaries] Pure. No app, no screen, no MobX — the two facts
// go in, the displayable pair comes out, and the whole rule is unit-testable
// with no mocks at all.

/**
 * What a source *may* say about the title, where `null` is a real answer:
 * "I have no opinion — ask the next source outward."
 *
 * [LAW:parse-dont-validate] `null` and `""` are deliberately different facts.
 * `null` is an absent opinion that falls back; `""` is a screen deciding it
 * shows no subtitle, which must override an app-level one. Collapsing them onto
 * a single falsy value is what would make a screen unable to clear a subtitle
 * it inherited — an answer-shaped void, where "" would mean both "nothing to
 * say" and "say nothing".
 */
export interface TitleOverride {
  readonly title: string | null;
  readonly subTitle: string | null;
}

/** What a header can actually paint: both strings present, no fallback left. */
export interface ResolvedTitle {
  readonly title: string;
  readonly subTitle: string;
}

/**
 * [LAW:dataflow-not-control-flow] "There is no active screen" is a value, not a
 * branch. Callers with nothing to override pass this, so `resolveTitle` runs the
 * same two lookups every time and no caller grows an `if (screen === null)`.
 */
export const NO_TITLE_OVERRIDE: TitleOverride = { title: null, subTitle: null };

export function resolveTitle(override: TitleOverride, app: ResolvedTitle): ResolvedTitle {
  return {
    title: override.title ?? app.title,
    subTitle: override.subTitle ?? app.subTitle,
  };
}
