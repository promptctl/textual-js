// [LAW:one-source-of-truth] PSEUDO_CLASSES is the canonical registry of
// built-in pseudo-classes. Both selector validators (parse-time) and the
// Widget evaluator (match-time) read from this single table; no other
// hand-maintained list of pseudo-class names may exist.

import type { Widget } from "../framework/widget.js";

export type PseudoClassEvaluator = (widget: Widget) => boolean;

export const PSEUDO_CLASSES: Readonly<Record<string, PseudoClassEvaluator>> = {
  focus: (widget) => widget.isFocused,
  blur: (widget) => !widget.isFocused,
  disabled: (widget) => widget.isDisabledEffective,
  enabled: (widget) => !widget.isDisabledEffective,
  loading: (widget) => widget.isLoadingEffective,
  "can-focus": (widget) => widget.focusable,
  "focus-within": (widget) => {
    const { framework } = widget;
    let current =
      framework.focusedNodeId === null ? undefined : framework.registry.get(framework.focusedNodeId);
    while (current !== undefined) {
      if (current.nodeId === widget.nodeId) {
        return true;
      }
      current = current.parent;
    }
    return false;
  },
  hover: (widget) => widget.isHovered,
  dark: (widget) => widget.framework.dark,
  light: (widget) => !widget.framework.dark,
  "first-child": (widget) => widget.framework.registry.getSiblingIndex(widget.nodeId) === 0,
  "last-child": (widget) => widget.framework.registry.getNextSiblings(widget.nodeId).length === 0,
  "first-of-type": (widget) =>
    widget.framework.registry
      .getPreviousSiblings(widget.nodeId)
      .every((sibling) => !sibling.matchesType(widget.typeName)),
  "last-of-type": (widget) =>
    widget.framework.registry
      .getNextSiblings(widget.nodeId)
      .every((sibling) => !sibling.matchesType(widget.typeName)),
  even: (widget) => {
    const index = widget.framework.registry.getSiblingIndex(widget.nodeId);
    return index >= 0 && (index + 1) % 2 === 0;
  },
  odd: (widget) => {
    const index = widget.framework.registry.getSiblingIndex(widget.nodeId);
    return index >= 0 && (index + 1) % 2 === 1;
  },
  empty: (widget) => !widget.framework.registry.hasChildren(widget.nodeId),
};

export const PSEUDO_CLASS_NAMES: ReadonlySet<string> = new Set(Object.keys(PSEUDO_CLASSES));
