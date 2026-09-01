import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from "react";
import { Box, Transform, measureElement, type DOMElement } from "ink";
import { observer } from "mobx-react-lite";
import { runInAction } from "mobx";
import stringWidth from "string-width";

import type { Message } from "../events/message.js";
import { Content, type VisualInput } from "../content/index.js";
import { type ActiveBinding } from "./_app-runtime.js";
import type { App } from "../app/app.js";
import type { WidgetActions, WidgetHandlers } from "./widget-registry.js";
import { Widget } from "./widget.js";
import type { ResolvedStyles } from "../styles/resolved-styles.js";
import { outerBoxGeometry } from "../styles/box-geometry.js";
import { Worker, type WorkFunction, type WorkerOptions } from "../services/worker.js";
import type { TimerOptions } from "../services/timer.js";
import {
  makeBindings,
  type Binding,
  type BindingDeclaration,
} from "../bindings/index.js";
import { Region } from "../geometry/region.js";

const AppContext = createContext<App | null>(null);
const ParentWidgetContext = createContext<string | null>(null);
const CurrentWidgetContext = createContext<Widget | null>(null);

let nextWidgetId = 1;

function createWidgetId(): string {
  return `widget-${nextWidgetId++}`;
}

export interface TextualProviderProps extends PropsWithChildren {
  app: App;
}

export function TextualProvider({ app, children }: TextualProviderProps): React.JSX.Element {
  return (
    <AppContext.Provider value={app}>
      <ParentWidgetContext.Provider value={null}>{children}</ParentWidgetContext.Provider>
    </AppContext.Provider>
  );
}

export function useTextual(): App {
  const app = useContext(AppContext);

  if (app === null) {
    throw new Error("useTextual must be used inside <TextualApp />");
  }

  return app;
}

export interface UseWidgetOptions {
  id?: string;
  classes?: string | string[];
  typeName: string;
  baseTypeNames?: string[];
  scopedCss?: string;
  handlers?: WidgetHandlers;
  actions?: WidgetActions;
  bindings?: BindingDeclaration[];
  focusable?: boolean;
  canFocusChildren?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
  componentClasses?: string[];
  inheritCss?: boolean;
  inheritBindings?: boolean;
  inheritComponentClasses?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: VisualInput | null;
  borderTitle?: string | null;
  borderSubtitle?: string | null;
  typeToken?: Function;
}

export interface UseWidgetResult {
  nodeId: string;
  isFocused: boolean;
  lifecycleReady: boolean;
  focus: () => void;
  postMessage: (message: Message) => boolean;
  handle: Widget;
}

function normalizeClasses(classes: UseWidgetOptions["classes"]): string[] {
  if (Array.isArray(classes)) {
    return classes;
  }

  if (typeof classes === "string") {
    return classes
      .split(/\s+/)
      .map((className) => className.trim())
      .filter((className) => className.length > 0);
  }

  return [];
}

export function useWidget(options: UseWidgetOptions): UseWidgetResult {
  const app = useTextual();
  const parentId = useContext(ParentWidgetContext);
  const handlersRef = useRef(options.handlers) as MutableRefObject<WidgetHandlers | undefined>;
  const actionsRef = useRef(options.actions) as MutableRefObject<WidgetActions | undefined>;
  const bindingsRef = useRef<Binding[]>(makeBindings(options.bindings ?? []));
  const [lifecycleReady, setLifecycleReady] = useState(false);
  const widgetRef = useRef<Widget>(
    new Widget({
      app,
      nodeId: createWidgetId(),
      parentId,
      id: options.id,
      classes: normalizeClasses(options.classes),
      typeName: options.typeName,
      handlersRef,
      actionsRef,
      bindingsRef,
      focusable: options.focusable ?? false,
      canFocusChildren: options.canFocusChildren,
      autoFocus: options.autoFocus ?? false,
      disabled: options.disabled ?? false,
      loading: options.loading ?? false,
      tooltip: options.tooltip ?? null,
      borderTitle: options.borderTitle ?? null,
      borderSubtitle: options.borderSubtitle ?? null,
    }),
  );
  handlersRef.current = options.handlers;
  actionsRef.current = options.actions;
  bindingsRef.current = makeBindings(options.bindings ?? []);
  const classes = normalizeClasses(options.classes);
  const classesKey = classes.join(" ");

  useLayoutEffect(() => {
    app.registerWidgetType(options.typeName, {
      defaultCss: options.defaultCss,
      scopedCss: options.scopedCss,
      baseTypeNames: options.baseTypeNames,
      bindings: bindingsRef.current,
      inheritCss: options.inheritCss,
      inheritBindings: options.inheritBindings,
      componentClasses: options.componentClasses,
      inheritComponentClasses: options.inheritComponentClasses,
      borderTitle: options.borderTitle,
      borderSubtitle: options.borderSubtitle,
      typeToken: options.typeToken,
    });
    const typeMetadata = app.getWidgetTypeMetadata(options.typeName);
    bindingsRef.current = typeMetadata.bindings;
    widgetRef.current.parentId = parentId;
    widgetRef.current.markLifecyclePending();
    widgetRef.current.replaceClasses(classes);
    runInAction(() => {
      const nextBorderTitle = options.borderTitle ?? typeMetadata.borderTitle ?? null;
      const nextBorderSubtitle = options.borderSubtitle ?? typeMetadata.borderSubtitle ?? null;
      widgetRef.current.borderTitle =
        nextBorderTitle === null ? null : Content.fromText(nextBorderTitle).firstLine;
      widgetRef.current.borderSubtitle =
        nextBorderSubtitle === null ? null : Content.fromText(nextBorderSubtitle).firstLine;
    });
    app.registerWidget(widgetRef.current);
    setLifecycleReady(true);

    return () => {
      setLifecycleReady(false);
      app.notifyWillUnmount(widgetRef.current);
      app.unregisterWidget(widgetRef.current.nodeId);
    };
  }, [
    classesKey,
    app,
    options.defaultCss,
    options.scopedCss,
    options.typeName,
    options.baseTypeNames,
    options.inheritCss,
    options.inheritBindings,
    options.inheritComponentClasses,
    options.componentClasses,
    options.borderTitle,
    options.borderSubtitle,
    options.typeToken,
    parentId,
  ]);

  useLayoutEffect(() => {
    if (widgetRef.current.disabled !== (options.disabled ?? false)) {
      widgetRef.current.setDisabled(options.disabled ?? false);
    }
  }, [options.disabled]);

  useLayoutEffect(() => {
    if (widgetRef.current.loading !== (options.loading ?? false)) {
      widgetRef.current.setLoading(options.loading ?? false);
    }
  }, [options.loading]);

  useEffect(() => {
    widgetRef.current.setTooltip(options.tooltip ?? null);
  }, [options.tooltip]);

  return {
    nodeId: widgetRef.current.nodeId,
    isFocused: app.focusedNodeId === widgetRef.current.nodeId,
    lifecycleReady,
    focus: () => {
      app.focusWidget(widgetRef.current.nodeId);
    },
    postMessage: (message: Message) => {
      return app.postMessage(widgetRef.current.nodeId, message);
    },
    handle: widgetRef.current,
  };
}

export interface WidgetHostProps extends PropsWithChildren {
  id?: string;
  classes?: string | string[];
  typeName: string;
  baseTypeNames?: string[];
  scopedCss?: string;
  handlers?: WidgetHandlers;
  actions?: WidgetActions;
  bindings?: BindingDeclaration[];
  focusable?: boolean;
  canFocusChildren?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
  componentClasses?: string[];
  inheritCss?: boolean;
  inheritBindings?: boolean;
  inheritComponentClasses?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: VisualInput | null;
  borderTitle?: string | null;
  borderSubtitle?: string | null;
  typeToken?: Function;
}

function readAnsiSequenceEnd(output: string, startIndex: number): number {
  const nextCharacter = output[startIndex + 1];

  if (nextCharacter === "[") {
    let index = startIndex + 2;

    while (index < output.length) {
      const character = output[index];

      if (character >= "@" && character <= "~") {
        return index + 1;
      }

      index += 1;
    }
  }

  if (nextCharacter === "]") {
    let index = startIndex + 2;

    while (index < output.length) {
      if (output[index] === "\u0007") {
        return index + 1;
      }

      if (output[index] === "\u001B" && output[index + 1] === "\\") {
        return index + 2;
      }

      index += 1;
    }
  }

  return Math.min(output.length, startIndex + 2);
}

function concealOutput(output: string): string {
  let concealed = "";
  let index = 0;

  while (index < output.length) {
    const character = output[index];

    if (character === "\u001B") {
      const escapeSequenceEnd = readAnsiSequenceEnd(output, index);
      concealed += output.slice(index, escapeSequenceEnd);
      index = escapeSequenceEnd;
      continue;
    }

    if (character === "\n" || character === "\r") {
      concealed += character;
      index += 1;
      continue;
    }

    const codePoint = output.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const glyph = String.fromCodePoint(codePoint);
    concealed += " ".repeat(Math.max(1, stringWidth(glyph)));
    index += glyph.length;
  }

  return concealed;
}

const WidgetVisibilityBoundary = observer(function WidgetVisibilityBoundary({
  children,
  widget,
}: {
  children: React.ReactNode;
  widget: Widget;
}): React.JSX.Element {
  return widget.isVisible ? <>{children}</> : <Transform transform={concealOutput}>{children}</Transform>;
});

export const WidgetHost = observer(function WidgetHost({
  children,
  id,
  classes,
  typeName,
  baseTypeNames,
  scopedCss,
  handlers,
  actions,
  bindings,
  focusable,
  canFocusChildren,
  autoFocus,
  defaultCss,
  componentClasses,
  inheritCss,
  inheritBindings,
  inheritComponentClasses,
  disabled,
  loading,
  tooltip,
  borderTitle,
  borderSubtitle,
  typeToken,
}: WidgetHostProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes,
    typeName,
    baseTypeNames,
    scopedCss,
    handlers,
    actions,
    bindings,
    focusable,
    canFocusChildren,
    autoFocus,
    defaultCss,
    componentClasses,
    inheritCss,
    inheritBindings,
    inheritComponentClasses,
    disabled,
    loading,
    tooltip,
    borderTitle,
    borderSubtitle,
    typeToken,
  });

  // [LAW:single-enforcer] Children render only after `widget.handle.lifecycleReady`,
  // which the framework flips true at the end of Mount dispatch — so onMount
  // handlers always complete before any descendant renders.
  return <WidgetScope widget={widget.handle}>{widget.handle.lifecycleReady ? children : null}</WidgetScope>;
});

export interface WidgetScopeProps extends PropsWithChildren {
  widget: Widget;
}

export const WidgetScope = observer(function WidgetScope({ widget, children }: WidgetScopeProps): React.JSX.Element {
  const layoutRef = useRef<DOMElement>(null);
  // [LAW:single-enforcer] Read the observable directly rather than subscribing.
  // ResolvedStyles.box is a MobX observable reassigned on every cascade
  // recompute and this component is an observer, so a useStyles subscription
  // here would only duplicate the render the widget's own useStyles performs.
  const box = widget.resolvedStyles.box;

  useLayoutEffect(() => {
    // [LAW:one-source-of-truth] Widget screen regions are derived from the Ink
    // layout node at one seam so Pilot and any future spatial tooling read the
    // same measured rectangle instead of maintaining parallel geometry.
    const reader = () => {
      const layoutNode = layoutRef.current;

      if (layoutNode !== null) {
        widget.updateScreenRegion(measureWidgetRegion(layoutNode));
      }
    };

    return widget.app.registerLayoutReader(widget.nodeId, reader);
  }, [widget]);

  // [LAW:no-ambient-temporal-coupling] Re-measurement fires on this widget's
  // own Ink commit — deliberately no dependency array, so a widget-local MobX
  // update (which re-renders this widget and no ancestor) re-derives geometry
  // without anyone asking for a pass. The registration effect above declares
  // this widget's reader before this effect runs it, so mount measures here
  // too and there is exactly one measurement site.
  // The whole tree is re-derived, not just this widget: Ink recomputes the
  // entire Yoga layout on every render, so one widget's commit can move any
  // other widget's rectangle. Every widget in a commit asks, and the pass
  // number makes all asks after the first free. Writes are change-gated in
  // `Widget.updateScreenRegion`, which is what stops measure → observable
  // write → re-render → measure from cycling.
  useLayoutEffect(() => {
    widget.app.syncLayoutReadersForPass();
  });

  return (
    <CurrentWidgetContext.Provider value={widget}>
      <ParentWidgetContext.Provider value={widget.nodeId}>
        {/* [LAW:one-source-of-truth] This Box IS the widget's box: it carries
            the widget's own margin and width policy, so the rectangle measured
            from it is the widget's placed rectangle rather than the space its
            container happened to offer. Every widget passes through here —
            including the seven that render no WidgetFrame — so there is one
            measured node per widget and no per-widget ref plumbing. */}
        <Box ref={layoutRef} {...outerBoxGeometry(box)}>
          <WidgetVisibilityBoundary widget={widget}>{children}</WidgetVisibilityBoundary>
        </Box>
      </ParentWidgetContext.Provider>
    </CurrentWidgetContext.Provider>
  );
});

function measureWidgetRegion(node: DOMElement): Region {
  const size = measureElement(node);
  let x = 0;
  let y = 0;
  let current: DOMElement | undefined = node;

  while (current !== undefined) {
    x += current.yogaNode?.getComputedLeft() ?? 0;
    y += current.yogaNode?.getComputedTop() ?? 0;
    current = current.parentNode;
  }

  return new Region(x, y, size.width, size.height);
}

export const StylesReader = observer(function StylesReader({
  children,
}: {
  children: (styles: ResolvedStyles, widget: Widget) => React.JSX.Element;
}): React.JSX.Element {
  const widget = useContext(CurrentWidgetContext);

  if (widget === null) {
    throw new Error("StylesReader must be used within a widget scope");
  }

  return children(widget.resolvedStyles, widget);
});

export function useCurrentWidget(): Widget {
  const widget = useContext(CurrentWidgetContext);

  if (widget === null) {
    throw new Error("useCurrentWidget must be used inside a widget scope");
  }

  return widget;
}

export function useStyles(widget?: Widget): ResolvedStyles {
  const styles = (widget ?? useCurrentWidget()).resolvedStyles;
  const [, setVersion] = useState(0);

  useEffect(() => {
    return styles.subscribe(() => {
      setVersion((version) => version + 1);
    });
  }, [styles]);

  return styles;
}

// [LAW:single-enforcer] One reactive path for active-binding consumers:
// MobX-tracked reads of the canonical observable state (BindingDispatcher's
// appBindings / appActions / keymap, framework.activeScreen, focusedNodeId).
// Callers must be wrapped in `observer()` so the read inside `getActiveBindings()`
// is tracked. Manual `bindings_updated_signal` subscription is intentionally
// NOT used here — that path raced React's commit ordering (parent setAppBindings
// publish vs. child subscription gated by lifecycleReady). The signal remains
// for non-React consumers (probes, devtools).
export function useBindings(widget?: Widget): ActiveBinding[] {
  const app = useTextual();
  // [LAW:dataflow-not-control-flow] Same hook order every call. The result
  // of useCurrentWidget is read but only required when no explicit widget is
  // provided; the runtime check produces a precise error when neither is set.
  const ambientWidget = useContext(CurrentWidgetContext);

  if (widget === undefined && ambientWidget === null) {
    throw new Error("useBindings must be used inside a widget scope (or pass an explicit widget)");
  }

  return app.getActiveBindings();
}

export function useWorker<TResult>(
  work: WorkFunction<TResult>,
  options: WorkerOptions = {},
): {
  worker: Worker<TResult>;
  start: () => Promise<TResult>;
  cancel: () => void;
} {
  const widget = useCurrentWidget();
  const workerRef = useRef<Worker<TResult>>();

  if (workerRef.current === undefined) {
    workerRef.current = widget.runWorker(work, { ...options, start: false });
  }

  useEffect(() => {
    return () => {
      workerRef.current?.cancel();
    };
  }, []);

  return {
    worker: workerRef.current,
    start: () => workerRef.current!.start(),
    cancel: () => {
      workerRef.current?.cancel();
    },
  };
}

export function useTimer(
  name: string,
  delayMs: number,
  callback: () => void,
  options: (TimerOptions & { repeating?: boolean }) = {},
): void {
  const widget = useCurrentWidget();

  useEffect(() => {
    const installTimer = options.repeating === true ? widget.setInterval : widget.setTimer;
    installTimer.call(widget, name, delayMs, callback, options);

    return () => {
      widget.clearTimer(name);
    };
  }, [callback, delayMs, name, options, widget]);
}
