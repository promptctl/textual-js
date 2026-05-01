// [LAW:single-enforcer] Single typed wrapper around mobx's makeAutoObservable.
// Mobx types the second-arg override map as `AnnotationsMap<T, AdditionalKeys>`,
// which keys off `keyof T`. For class instances `keyof T` surfaces only the
// *public* fields — annotating a private/protected field as not-observable
// (e.g. `private readonly deps`, override `{ deps: false }`) fails to
// type-check without a cast at the call site.
//
// Before this wrapper, ~24 framework / services / styles call sites each had
// `... as never,` to silence that error, scattering the cast across the codebase
// and giving the impression that broad `as never` use was an accepted pattern.
// The cast now lives once, here, with this comment as its rationale.
//
// Consumers pass a permissive `Record<string, AnnotationMapEntry>`; the
// underlying mobx call still validates each key at runtime via its
// MakeResult cancel/break/continue protocol — passing an unknown key throws.

import { makeAutoObservable as mobxMakeAutoObservable } from "mobx";
import type { AnnotationMapEntry, CreateObservableOptions } from "mobx";

export type AutoObservableOverrides = Record<string, AnnotationMapEntry>;

export function autoObservable<T extends object>(
  target: T,
  overrides?: AutoObservableOverrides,
  options?: CreateObservableOptions,
): T {
  return mobxMakeAutoObservable(target, overrides as never, options);
}
