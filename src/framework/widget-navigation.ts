export interface EnabledCandidate {
  disabled?: boolean;
}

export function get_directed_distance(index: number, start: number, direction: 1 | -1, wrap_at: number): number {
  if (wrap_at <= 0) {
    return 0;
  }

  const delta = direction === 1 ? index - start : start - index;
  return (delta + wrap_at) % wrap_at;
}

export function find_first_enabled(candidates: readonly EnabledCandidate[]): number | null {
  const index = candidates.findIndex((candidate) => candidate.disabled !== true);
  return index === -1 ? null : index;
}

export function find_last_enabled(candidates: readonly EnabledCandidate[]): number | null {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    if (candidates[index]?.disabled !== true) {
      return index;
    }
  }

  return null;
}

export function find_next_enabled(
  candidates: readonly EnabledCandidate[],
  anchor: number | null,
  direction: 1 | -1,
): number | null {
  const fallback = direction === 1 ? find_first_enabled(candidates) : find_last_enabled(candidates);

  if (anchor === null) {
    return fallback;
  }

  const enabledIndexes = candidates
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.disabled !== true)
    .map(({ index }) => index);

  if (enabledIndexes.length === 0) {
    return anchor;
  }

  // [LAW:dataflow-not-control-flow] Candidate order is reduced to distances;
  // wrap/no-wrap behavior is encoded in the distance data, not duplicate loops.
  return enabledIndexes
    .map((index) => ({ index, distance: get_directed_distance(index, anchor, direction, candidates.length) }))
    .filter((entry) => entry.distance > 0)
    .sort((left, right) => left.distance - right.distance)[0]?.index ?? anchor;
}

export function find_next_enabled_no_wrap(
  candidates: readonly EnabledCandidate[],
  anchor: number | null,
  direction: 1 | -1,
  with_anchor = false,
): number | null {
  if (anchor === null) {
    return direction === 1 ? find_first_enabled(candidates) : find_last_enabled(candidates);
  }

  if (with_anchor && candidates[anchor]?.disabled !== true) {
    return anchor;
  }

  for (let index = anchor + direction; index >= 0 && index < candidates.length; index += direction) {
    if (candidates[index]?.disabled !== true) {
      return index;
    }
  }

  return null;
}
