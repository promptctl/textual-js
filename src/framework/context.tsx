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
import { Transform } from "ink";
import { observer } from "mobx-react-lite";
import stringWidth from "string-width";

import type { Message } from "../events/message.js";
import { TextualFramework } from "./app-framework.js";
import type { WidgetHandlers } from "./widget-registry.js";
import { WidgetNode } from "./widget-node.js";
import type { ResolvedStyles } from "../styles/resolved-styles.js";

const TextualFrameworkContext = createContext<TextualFramework | null>(null);
const ParentWidgetContext = createContext<string | null>(null);
const CurrentWidgetContext = createContext<WidgetNode | null>(null);

let nextWidgetNodeId = 1;

function createWidgetNodeId(): string {
  return `widget-${nextWidgetNodeId++}`;
}

export interface TextualProviderProps extends PropsWithChildren {
  framework: TextualFramework;
}

export function TextualProvider({ framework, children }: TextualProviderProps): React.JSX.Element {
  return (
    <TextualFrameworkContext.Provider value={framework}>
      <ParentWidgetContext.Provider value={null}>{children}</ParentWidgetContext.Provider>
    </TextualFrameworkContext.Provider>
  );
}

export function useTextual(): TextualFramework {
  const framework = useContext(TextualFrameworkContext);

  if (framework === null) {
    throw new Error("useTextual must be used inside <TextualApp />");
  }

  return framework;
}

export interface UseWidgetOptions {
  id?: string;
  classes?: string | string[];
  typeName: string;
  handlers?: WidgetHandlers;
  focusable?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
}

export interface UseWidgetResult {
  nodeId: string;
  isFocused: boolean;
  focus: () => void;
  postMessage: (message: Message) => void;
  handle: WidgetNode;
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
  const framework = useTextual();
  const parentId = useContext(ParentWidgetContext);
  const widgetRef = useRef<WidgetNode>(
    new WidgetNode({
      framework,
      nodeId: createWidgetNodeId(),
      parentId,
      id: options.id,
      classes: normalizeClasses(options.classes),
      typeName: options.typeName,
      handlersRef: { current: options.handlers },
      focusable: options.focusable ?? false,
      autoFocus: options.autoFocus ?? false,
      defaultCss: options.defaultCss,
    }),
  );
  const handlersRef = useRef(options.handlers) as MutableRefObject<WidgetHandlers | undefined>;
  handlersRef.current = options.handlers;
  const classes = normalizeClasses(options.classes);
  const classesKey = classes.join(" ");
  widgetRef.current.handlersRef.current = options.handlers;

  useLayoutEffect(() => {
    widgetRef.current.parentId = parentId;
    widgetRef.current.replaceClasses(classes);
    framework.registerWidget(widgetRef.current);

    return () => {
      framework.unregisterWidget(widgetRef.current.nodeId);
    };
  }, [
    classesKey,
    framework,
    parentId,
  ]);

  return {
    nodeId: widgetRef.current.nodeId,
    isFocused: framework.focusedNodeId === widgetRef.current.nodeId,
    focus: () => {
      framework.focusWidget(widgetRef.current.nodeId);
    },
    postMessage: (message: Message) => {
      framework.postMessage(widgetRef.current.nodeId, message);
    },
    handle: widgetRef.current,
  };
}

export interface WidgetHostProps extends PropsWithChildren {
  id?: string;
  classes?: string | string[];
  typeName: string;
  handlers?: WidgetHandlers;
  focusable?: boolean;
  autoFocus?: boolean;
  defaultCss?: string;
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
  widget: WidgetNode;
}): React.JSX.Element {
  return widget.isVisible ? <>{children}</> : <Transform transform={concealOutput}>{children}</Transform>;
});

export function WidgetHost({
  children,
  id,
  classes,
  typeName,
  handlers,
  focusable,
  autoFocus,
  defaultCss,
}: WidgetHostProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes,
    typeName,
    handlers,
    focusable,
    autoFocus,
    defaultCss,
  });

  return <WidgetScope widget={widget.handle}>{children}</WidgetScope>;
}

export interface WidgetScopeProps extends PropsWithChildren {
  widget: WidgetNode;
}

export function WidgetScope({ widget, children }: WidgetScopeProps): React.JSX.Element {
  return (
    <CurrentWidgetContext.Provider value={widget}>
      <ParentWidgetContext.Provider value={widget.nodeId}>
        <WidgetVisibilityBoundary widget={widget}>{children}</WidgetVisibilityBoundary>
      </ParentWidgetContext.Provider>
    </CurrentWidgetContext.Provider>
  );
}

export const StylesReader = observer(function StylesReader({
  children,
}: {
  children: (styles: ResolvedStyles, widget: WidgetNode) => React.JSX.Element;
}): React.JSX.Element {
  const widget = useContext(CurrentWidgetContext);

  if (widget === null) {
    throw new Error("StylesReader must be used within a widget scope");
  }

  return children(widget.resolvedStyles, widget);
});

export function useCurrentWidget(): WidgetNode {
  const widget = useContext(CurrentWidgetContext);

  if (widget === null) {
    throw new Error("useCurrentWidget must be used inside a widget scope");
  }

  return widget;
}

export function useStyles(widget?: WidgetNode): ResolvedStyles {
  const styles = (widget ?? useCurrentWidget()).resolvedStyles;
  const [, setVersion] = useState(0);

  useEffect(() => {
    return styles.subscribe(() => {
      setVersion((version) => version + 1);
    });
  }, [styles]);

  return styles;
}
