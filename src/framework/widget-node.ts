import { makeAutoObservable, observable, runInAction } from "mobx";

import type { Message } from "../events/message.js";
import { ResolvedStyles } from "../styles/resolved-styles.js";
import { DOMQuery, NoMatches, TooManyMatches } from "./dom-query.js";
import type { TextualFramework } from "./app-framework.js";
import type { WidgetHandlers } from "./widget-registry.js";

export interface WidgetNodeInit {
  framework: TextualFramework;
  nodeId: string;
  parentId: string | null;
  id?: string;
  classes: string[];
  typeName: string;
  handlersRef: { current: WidgetHandlers | undefined };
  focusable: boolean;
  autoFocus: boolean;
}

export class WidgetNode {
  readonly framework: TextualFramework;
  readonly nodeId: string;
  parentId: string | null;
  readonly id?: string;
  readonly typeName: string;
  readonly handlersRef: { current: WidgetHandlers | undefined };
  readonly focusable: boolean;
  readonly autoFocus: boolean;
  readonly classes = observable.set<string>();
  readonly pseudoClasses = observable.map<string, boolean>();
  readonly inlineStyles = observable.map<string, string>();
  readonly resolvedStyles = new ResolvedStyles();

  constructor(init: WidgetNodeInit) {
    this.framework = init.framework;
    this.nodeId = init.nodeId;
    this.parentId = init.parentId;
    this.id = init.id;
    this.typeName = init.typeName;
    this.handlersRef = init.handlersRef;
    this.focusable = init.focusable;
    this.autoFocus = init.autoFocus;

    runInAction(() => {
      for (const className of init.classes) {
        this.classes.add(className);
      }
    });

    makeAutoObservable(
      this,
      {
        framework: false,
        handlersRef: false,
        nodeId: false,
        parentId: false,
        id: false,
        typeName: false,
        focusable: false,
        autoFocus: false,
      },
      { autoBind: true },
    );
  }

  get parent(): WidgetNode | undefined {
    return this.parentId === null ? undefined : this.framework.registry.get(this.parentId);
  }

  get isFocused(): boolean {
    return this.framework.focusedNodeId === this.nodeId;
  }

  get display(): "block" | "none" {
    return (this.resolvedStyles.getRule("display") as "block" | "none" | undefined) ?? "block";
  }

  get visibility(): "visible" | "hidden" {
    return (this.resolvedStyles.getRule("visibility") as "visible" | "hidden" | undefined) ?? "visible";
  }

  get isDisplayed(): boolean {
    return this.display !== "none" && (this.parent?.isDisplayed ?? true);
  }

  get isVisible(): boolean {
    if (this.visibility === "hidden") {
      return false;
    }

    if (this.visibility === "visible" && this.resolvedStyles.hasRule("visibility")) {
      return true;
    }

    return this.parent?.isVisible ?? true;
  }

  get isInteractive(): boolean {
    return this.isDisplayed && this.isVisible;
  }

  focus(): void {
    this.framework.focusWidget(this.nodeId);
  }

  postMessage(message: Message): void {
    this.framework.postMessage(this.nodeId, message);
  }

  matchesType(typeName: string): boolean {
    return this.typeName === typeName;
  }

  hasClass(className: string): boolean {
    return this.classes.has(className);
  }

  replaceClasses(nextClasses: string[]): void {
    runInAction(() => {
      this.classes.clear();

      for (const className of nextClasses) {
        this.classes.add(className);
      }
    });
  }

  addClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        if (!this.classes.has(className)) {
          this.classes.add(className);
          changed = true;
        }
      }
    });

    this.framework.refreshStyles(changed);
  }

  removeClass(...classNames: string[]): void {
    let changed = false;

    runInAction(() => {
      for (const className of classNames) {
        if (this.classes.delete(className)) {
          changed = true;
        }
      }
    });

    this.framework.refreshStyles(changed);
  }

  toggleClass(className: string, force?: boolean): void {
    const shouldHaveClass = force ?? !this.classes.has(className);
    const hadClass = this.classes.has(className);

    runInAction(() => {
      if (shouldHaveClass) {
        this.classes.add(className);
      } else {
        this.classes.delete(className);
      }
    });

    this.framework.refreshStyles(hadClass !== shouldHaveClass);
  }

  setClasses(classes: string | string[]): void {
    const nextClasses = Array.isArray(classes)
      ? classes
      : classes
          .split(/\s+/)
          .map((className) => className.trim())
          .filter((className) => className.length > 0);
    const currentClasses = Array.from(this.classes);
    const same =
      currentClasses.length === nextClasses.length &&
      currentClasses.every((className, index) => className === nextClasses[index]);

    runInAction(() => {
      this.classes.clear();

      for (const className of nextClasses) {
        this.classes.add(className);
      }
    });

    this.framework.refreshStyles(!same);
  }

  setPseudoClass(name: string, enabled: boolean): void {
    this.pseudoClasses.set(name, enabled);
    this.framework.refreshStyles(true);
  }

  hasPseudoClass(name: string): boolean {
    if (name === "focus") {
      return this.isFocused;
    }

    if (name === "focus-within") {
      let currentNode =
        this.framework.focusedNodeId === null ? undefined : this.framework.registry.get(this.framework.focusedNodeId);

      while (currentNode !== undefined) {
        if (currentNode.nodeId === this.nodeId) {
          return true;
        }

        currentNode = currentNode.parent;
      }
    }

    return this.pseudoClasses.get(name) ?? false;
  }

  setInlineStyle(name: string, value: string | number | null | undefined): void {
    if (value === null || value === undefined) {
      this.inlineStyles.delete(name);
      this.framework.refreshStyles(true);
      return;
    }

    this.inlineStyles.set(name, `${value}`);
    this.framework.refreshStyles(true);
  }

  setInlineStyles(styles: Record<string, string | number | null | undefined>): void {
    for (const [name, value] of Object.entries(styles)) {
      this.setInlineStyle(name, value);
    }
  }

  setDisplay(value: boolean | "block" | "none"): void {
    this.setInlineStyle("display", value === true ? "block" : value === false ? "none" : value);
  }

  setVisible(value: boolean | "visible" | "hidden"): void {
    this.setInlineStyle("visibility", value === true ? "visible" : value === false ? "hidden" : value);
  }

  query(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.framework, this, "descendants").filter(selectorText);
  }

  queryChildren(selectorText = "*"): DOMQuery {
    return new DOMQuery(this.framework, this, "children").filter(selectorText);
  }

  queryOne(selectorText: string): WidgetNode {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    return results[0];
  }

  queryExactlyOne(selectorText: string): WidgetNode {
    const results = this.query(selectorText).results();

    if (results.length === 0) {
      throw new NoMatches(`No widgets matched "${selectorText}"`);
    }

    if (results.length > 1) {
      throw new TooManyMatches(`More than one widget matched "${selectorText}"`);
    }

    return results[0];
  }

  queryAncestor(selectorText: string): WidgetNode {
    const selectors = this.framework.parseSelectors(selectorText);
    let currentParent = this.parent;

    while (currentParent !== undefined) {
      const candidate = currentParent;

      if (selectors.some((selector) => this.framework.matchesSelector(candidate, selector))) {
        return candidate;
      }

      currentParent = candidate.parent;
    }

    throw new NoMatches(`No ancestors matched "${selectorText}"`);
  }
}
