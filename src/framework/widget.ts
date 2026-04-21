import type { BindingDeclaration } from "../bindings/index.js";
import type { ContentInput, VisualInput } from "../content/index.js";
import { TextualFramework } from "./app-framework.js";
import { NodeList, type WidgetActions, type WidgetHandlers } from "./widget-registry.js";
import { BadWidgetName, MountError, WidgetError, WidgetNode, type WidgetNodeInit } from "./widget-node.js";

const detachedFramework = new TextualFramework();
let nextPublicWidgetId = 1;

export interface WidgetOptions {
  id?: string;
  classes?: string | readonly string[];
  name?: string;
  framework?: TextualFramework;
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

export class Widget extends WidgetNode {
  static DEFAULT_CSS = "";
  static CSS = "";
  static COMPONENT_CLASSES: readonly string[] = [];
  static BINDINGS: readonly BindingDeclaration[] = [];
  static canFocus = false;
  static canFocusChildren = true;
  static inheritCss = true;
  static inheritBindings = true;

  private readonly constructorChildren = new NodeList();

  constructor(...args: Array<Widget | WidgetOptions>) {
    const { children, options } = splitWidgetConstructorArgs(args);
    const typeName = options.name ?? new.target.name;

    super(createWidgetNodeInit(typeName, options, new.target as typeof Widget));
    validatePublicWidgetName(typeName);

    for (const child of children) {
      if (child === this) {
        throw new WidgetError("A widget cannot own itself");
      }

      child.parentId = this.nodeId;
      this.constructorChildren._append(child);
    }
  }

  override get children(): NodeList {
    return this.framework.isNodeMounted(this) ? super.children : this.constructorChildren;
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

function splitWidgetConstructorArgs(args: Array<Widget | WidgetOptions>): { children: Widget[]; options: WidgetOptions } {
  const last = args.at(-1);
  const hasOptions = last !== undefined && !(last instanceof Widget);

  if (hasOptions && (typeof last !== "object" || last === null)) {
    throw new TypeError("Widget constructor options must be an object");
  }

  const options = hasOptions ? (last as WidgetOptions) : {};
  const childArgs = hasOptions ? args.slice(0, -1) : args;
  const children = childArgs.map((child) => {
    if (!(child instanceof Widget)) {
      throw new TypeError("Widget constructor children must be Widget instances");
    }

    return child;
  });

  // [LAW:one-source-of-truth] Constructor child ownership is represented by
  // the child list; invalid child data is rejected at this single boundary.
  return { children, options };
}

function createWidgetNodeInit(typeName: string, options: WidgetOptions, typeSource: typeof Widget): WidgetNodeInit {
  return {
    framework: options.framework ?? detachedFramework,
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
