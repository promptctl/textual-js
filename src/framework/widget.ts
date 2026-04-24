import type { BindingDeclaration } from "../bindings/index.js";
import type { ContentInput, VisualInput } from "../content/index.js";
import { TextualFramework } from "./app-framework.js";
import type { WidgetActions, WidgetHandlers } from "./widget-registry.js";
import { BadWidgetName, MountError, WidgetError, WidgetNode, type WidgetNodeInit } from "./widget-node.js";

let nextPublicWidgetId = 1;

export interface WidgetOptions {
  framework: TextualFramework;
  id?: string;
  classes?: string | readonly string[];
  name?: string;
  handlers?: WidgetHandlers;
  actions?: WidgetActions;
  bindings?: BindingDeclaration[];
  focusable?: boolean;
  canFocusChildren?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: VisualInput | null;
  borderTitle?: ContentInput | null;
  borderSubtitle?: ContentInput | null;
}

// [LAW:one-source-of-truth] Widget is a thin public subclass of WidgetNode.
// Parent/child ownership lives in framework.registry; there is no staging
// buffer and no singleton framework. A framework must be passed at construction
// so every widget has exactly one runtime from birth.
//
// Slice N+1 will merge this class into WidgetNode so the project has a single
// widget type, per design-docs/true-north-arch-refactor.md §2.
export class Widget extends WidgetNode {
  static DEFAULT_CSS = "";
  static CSS = "";
  static COMPONENT_CLASSES: readonly string[] = [];
  static BINDINGS: readonly BindingDeclaration[] = [];
  static canFocus = false;
  static canFocusChildren = true;
  static inheritCss = true;
  static inheritBindings = true;

  constructor(options: WidgetOptions) {
    if (options === undefined || options === null || typeof options !== "object") {
      throw new TypeError("Widget constructor options must be an object");
    }

    if (!(options.framework instanceof TextualFramework)) {
      throw new WidgetError("Widget requires a framework");
    }

    const typeName = options.name ?? new.target.name;
    super(createWidgetNodeInit(typeName, options, new.target as typeof Widget));
    validatePublicWidgetName(typeName);
  }

  get is_mounted(): boolean {
    return this.framework.isNodeMounted(this);
  }

  get is_attached(): boolean {
    return this.is_mounted;
  }
}

export class Screen<Result = unknown> extends Widget {
  static AUTO_FOCUS: string | null = null;
  static BINDINGS: readonly BindingDeclaration[] = [];
  readonly isModal: boolean = false;

  dismiss(result?: Result): void {
    this.framework.dismissScreen(result);
  }
}

export class ModalScreen<Result = unknown> extends Screen<Result> {
  override readonly isModal: boolean = true;
}

function createWidgetNodeInit(typeName: string, options: WidgetOptions, typeSource: typeof Widget): WidgetNodeInit {
  return {
    framework: options.framework,
    nodeId: `public-widget-${nextPublicWidgetId++}`,
    parentId: null,
    id: options.id,
    classes: normalizeClasses(options.classes),
    typeName,
    handlersRef: { current: options.handlers },
    actionsRef: { current: options.actions },
    bindingsRef: { current: [] },
    focusable: options.focusable ?? typeSource.canFocus,
    canFocusChildren: options.canFocusChildren ?? typeSource.canFocusChildren,
    autoFocus: options.autoFocus ?? false,
    disabled: options.disabled ?? false,
    loading: options.loading ?? false,
    tooltip: options.tooltip ?? null,
    borderTitle: options.borderTitle,
    borderSubtitle: options.borderSubtitle,
  };
}

function normalizeClasses(classes: WidgetOptions["classes"]): string[] {
  if (classes === undefined) {
    return [];
  }

  if (typeof classes === "string") {
    return classes.split(/\s+/).filter((className) => className.length > 0);
  }

  return [...classes];
}

function validatePublicWidgetName(typeName: string): void {
  if (!/^[A-Z]/.test(typeName)) {
    throw new BadWidgetName(`Widget class names must start with an uppercase letter: ${typeName}`);
  }
}

export { BadWidgetName, MountError, WidgetError };
