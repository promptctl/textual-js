import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type PropsWithChildren,
} from "react";

import type { Message } from "../events/message.js";
import { TextualFramework } from "./app-framework.js";
import type { WidgetHandlers } from "./widget-registry.js";

const TextualFrameworkContext = createContext<TextualFramework | null>(null);
const ParentWidgetContext = createContext<string | null>(null);

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
}

export interface UseWidgetResult {
  nodeId: string;
  isFocused: boolean;
  focus: () => void;
  postMessage: (message: Message) => void;
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
  const nodeIdRef = useRef(createWidgetNodeId());
  const handlersRef = useRef(options.handlers) as MutableRefObject<WidgetHandlers | undefined>;
  handlersRef.current = options.handlers;
  const classes = normalizeClasses(options.classes);
  const classesKey = classes.join(" ");

  useLayoutEffect(() => {
    framework.registerWidget({
      nodeId: nodeIdRef.current,
      parentId,
      id: options.id,
      classes,
      typeName: options.typeName,
      handlersRef,
      focusable: options.focusable,
      autoFocus: options.autoFocus,
    });

    return () => {
      framework.unregisterWidget(nodeIdRef.current);
    };
  }, [
    classesKey,
    framework,
    handlersRef,
    options.autoFocus,
    options.focusable,
    options.id,
    options.typeName,
    parentId,
  ]);

  return {
    nodeId: nodeIdRef.current,
    isFocused: framework.focusedNodeId === nodeIdRef.current,
    focus: () => {
      framework.focusWidget(nodeIdRef.current);
    },
    postMessage: (message: Message) => {
      framework.postMessage(nodeIdRef.current, message);
    },
  };
}

export interface WidgetHostProps extends PropsWithChildren {
  id?: string;
  classes?: string | string[];
  typeName: string;
  handlers?: WidgetHandlers;
  focusable?: boolean;
  autoFocus?: boolean;
}

export function WidgetHost({
  children,
  id,
  classes,
  typeName,
  handlers,
  focusable,
  autoFocus,
}: WidgetHostProps): React.JSX.Element {
  const widget = useWidget({
    id,
    classes,
    typeName,
    handlers,
    focusable,
    autoFocus,
  });

  return <ParentWidgetContext.Provider value={widget.nodeId}>{children}</ParentWidgetContext.Provider>;
}
