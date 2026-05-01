// [LAW:single-enforcer] WidgetTypeRegistry is the sole owner of widget-type
// state (WidgetTypeState records, the memoized WidgetTypeMetadata cache, and
// the constructor→typeName mapping). The framework orchestrator delegates
// every register/lookup/match call through this service.
// [LAW:one-source-of-truth] widgetTypes / widgetTypeMetadata / widgetTypeTokens
// live in exactly one place: this service. Framework methods are thin
// delegators that read through it.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import { autoObservable } from "./auto-observable.js";

import { makeBindings, type Binding, type BindingDeclaration } from "../bindings/index.js";
import type { ParsedStylesheet } from "../styles/index.js";
import { normalizeCssSource, parseStylesheetOrThrow } from "./style-engine.js";
import type { RegisterWidgetTypeOptions, WidgetTypeMetadata } from "./app-framework.js";

interface WidgetTypeState {
  typeName: string;
  defaultCss?: string;
  scopedCss?: string;
  baseTypeNames: string[];
  bindings: Binding[];
  inheritCss: boolean;
  inheritBindings: boolean;
  componentClasses: string[];
  inheritComponentClasses: boolean;
  borderTitle: string | null;
  borderSubtitle: string | null;
  typeToken?: Function;
  defaultStylesheet?: ParsedStylesheet;
  scopedStylesheet?: ParsedStylesheet;
}

// [LAW:one-way-deps] Narrow capability interface the registry requires from
// its host (typically TextualFramework). The registry never imports the host
// class — only this shape.
export interface WidgetTypeRegistryDeps {
  isRunning(): boolean;
  recalculateStyles(): void;
}

export class WidgetTypeRegistry {
  // [LAW:one-source-of-truth] Authoritative widget-type stores. Marked
  // non-observable below because they are large maps mutated by registration
  // calls; observers track derived metadata (cache key) instead.
  private readonly widgetTypes = new Map<string, WidgetTypeState>();
  private readonly widgetTypeMetadata = new Map<string, WidgetTypeMetadata>();
  private readonly widgetTypeTokens = new Map<Function, string>();
  private readonly deps: WidgetTypeRegistryDeps;

  constructor(deps: WidgetTypeRegistryDeps) {
    this.deps = deps;

    autoObservable(
      this,
      {
        widgetTypes: false,
        widgetTypeMetadata: false,
        widgetTypeTokens: false,
        deps: false,
      },
      { autoBind: true },
    );
  }

  getWidgetTypeMetadata(typeName: string): WidgetTypeMetadata {
    return this.buildWidgetTypeMetadata(typeName);
  }

  widgetMatchesType(typeName: string, expectedTypeName: string): boolean {
    return this.getWidgetTypeMetadata(typeName).typeHierarchy.includes(expectedTypeName);
  }

  resolveWidgetTypeName(typeConstraint: string | Function): string {
    if (typeof typeConstraint === "string") {
      return typeConstraint;
    }

    const registered = this.widgetTypeTokens.get(typeConstraint);

    return registered ?? typeConstraint.name;
  }

  registerWidgetType(typeName: string, defaultCss?: string): void;
  registerWidgetType(typeName: string, options?: RegisterWidgetTypeOptions): void;
  registerWidgetType(typeName: string, options: string | RegisterWidgetTypeOptions = {}): void {
    const normalizedOptions = typeof options === "string" ? { defaultCss: options } : options;
    const typeSource = normalizedOptions.typeToken as Partial<{
      DEFAULT_CSS: string;
      SCOPED_CSS: string;
      COMPONENT_CLASSES: readonly string[];
      BORDER_TITLE: string | null;
      BORDER_SUBTITLE: string | null;
      inheritCss: boolean;
      inheritBindings: boolean;
      inheritComponentClasses: boolean;
      BINDINGS: Iterable<BindingDeclaration>;
    }> | undefined;
    const normalizedDefaultCss = normalizeCssSource(normalizedOptions.defaultCss ?? typeSource?.DEFAULT_CSS);
    const normalizedScopedCss = normalizeCssSource(normalizedOptions.scopedCss ?? typeSource?.SCOPED_CSS);
    const existing = this.widgetTypes.get(typeName);
    const normalizedBindings = [
      ...makeBindings(typeSource?.BINDINGS ?? []),
      ...(normalizedOptions.bindings ?? []),
    ];
    const inheritedToken = normalizedOptions.typeToken === undefined ? undefined : Object.getPrototypeOf(normalizedOptions.typeToken);
    const inferredBaseTypeName =
      typeof inheritedToken?.name === "string" && inheritedToken.name.length > 0 && inheritedToken.name !== "Function"
        ? this.widgetTypeTokens.get(inheritedToken) ?? inheritedToken.name
        : undefined;
    const normalizedBaseTypeNames = [
      ...new Set([...(normalizedOptions.baseTypeNames ?? []), ...(inferredBaseTypeName === undefined ? [] : [inferredBaseTypeName])]),
    ];

    if (existing === undefined) {
      this.widgetTypes.set(typeName, {
        typeName,
        defaultCss: normalizedDefaultCss,
        scopedCss: normalizedScopedCss,
        baseTypeNames: normalizedBaseTypeNames,
        bindings: normalizedBindings,
        inheritCss: normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true,
        inheritBindings: normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true,
        componentClasses: [...(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? [])],
        inheritComponentClasses: normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true,
        borderTitle: normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? null,
        borderSubtitle: normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? null,
        typeToken: normalizedOptions.typeToken,
        defaultStylesheet:
          normalizedDefaultCss === undefined
            ? undefined
            : parseStylesheetOrThrow(normalizedDefaultCss, {
                origin: "default",
                scopeTypeName: typeName,
              }),
        scopedStylesheet:
          normalizedScopedCss === undefined
            ? undefined
            : parseStylesheetOrThrow(normalizedScopedCss, {
                origin: "default",
              }),
      });
      if (normalizedOptions.typeToken !== undefined) {
        this.widgetTypeTokens.set(normalizedOptions.typeToken, typeName);
      }
      this.invalidateWidgetTypeMetadata();

      return;
    }

    const sameRegistration =
      (normalizedDefaultCss === undefined || existing.defaultCss === normalizedDefaultCss) &&
      (normalizedScopedCss === undefined || existing.scopedCss === normalizedScopedCss) &&
      existing.inheritCss === (normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true) &&
      existing.inheritBindings === (normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true) &&
      existing.inheritComponentClasses === (normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true) &&
      JSON.stringify(existing.baseTypeNames) === JSON.stringify(normalizedBaseTypeNames) &&
      JSON.stringify(existing.bindings) === JSON.stringify(normalizedBindings) &&
      JSON.stringify(existing.componentClasses) === JSON.stringify(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? []) &&
      existing.borderTitle === (normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? null) &&
      existing.borderSubtitle === (normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? null);

    if (sameRegistration) {
      if (normalizedOptions.typeToken !== undefined) {
        this.widgetTypeTokens.set(normalizedOptions.typeToken, typeName);
      }
      return;
    }

    if (
      (normalizedDefaultCss !== undefined && existing.defaultCss !== undefined && existing.defaultCss !== normalizedDefaultCss) ||
      (normalizedScopedCss !== undefined && existing.scopedCss !== undefined && existing.scopedCss !== normalizedScopedCss)
    ) {
      // [LAW:one-source-of-truth] Widget type metadata is canonical per type.
      // Conflicting registrations fail instead of letting mount order decide.
      throw new Error(`Widget type "${typeName}" registered with conflicting DEFAULT_CSS`);
    }

    existing.defaultCss = existing.defaultCss ?? normalizedDefaultCss;
    existing.scopedCss = existing.scopedCss ?? normalizedScopedCss;
    existing.defaultStylesheet =
      existing.defaultStylesheet ??
      (normalizedDefaultCss === undefined
        ? undefined
        : parseStylesheetOrThrow(normalizedDefaultCss, {
            origin: "default",
            scopeTypeName: typeName,
          }));
    existing.scopedStylesheet =
      existing.scopedStylesheet ??
      (normalizedScopedCss === undefined
        ? undefined
        : parseStylesheetOrThrow(normalizedScopedCss, {
            origin: "default",
          }));
    existing.baseTypeNames = normalizedBaseTypeNames;
    existing.bindings = normalizedBindings;
    existing.inheritCss = normalizedOptions.inheritCss ?? typeSource?.inheritCss ?? true;
    existing.inheritBindings = normalizedOptions.inheritBindings ?? typeSource?.inheritBindings ?? true;
    existing.componentClasses = [...(normalizedOptions.componentClasses ?? typeSource?.COMPONENT_CLASSES ?? [])];
    existing.inheritComponentClasses = normalizedOptions.inheritComponentClasses ?? typeSource?.inheritComponentClasses ?? true;
    existing.borderTitle = normalizedOptions.borderTitle ?? typeSource?.BORDER_TITLE ?? existing.borderTitle;
    existing.borderSubtitle = normalizedOptions.borderSubtitle ?? typeSource?.BORDER_SUBTITLE ?? existing.borderSubtitle;
    existing.typeToken = normalizedOptions.typeToken ?? existing.typeToken;
    if (existing.typeToken !== undefined) {
      this.widgetTypeTokens.set(existing.typeToken, typeName);
    }
    this.invalidateWidgetTypeMetadata();

    if (this.deps.isRunning()) {
      this.deps.recalculateStyles();
    }
  }

  private invalidateWidgetTypeMetadata(): void {
    this.widgetTypeMetadata.clear();
  }

  private buildWidgetTypeMetadata(typeName: string, visiting = new Set<string>()): WidgetTypeMetadata {
    const existing = this.widgetTypeMetadata.get(typeName);

    if (existing !== undefined) {
      return existing;
    }

    if (visiting.has(typeName)) {
      throw new Error(`Circular widget type inheritance for "${typeName}"`);
    }

    visiting.add(typeName);
    const state = this.widgetTypes.get(typeName) ?? {
      typeName,
      baseTypeNames: [],
      bindings: [],
      inheritCss: true,
      inheritBindings: true,
      componentClasses: [],
      inheritComponentClasses: true,
      borderTitle: null,
      borderSubtitle: null,
    };
    const inheritedToken = state.typeToken === undefined ? undefined : Object.getPrototypeOf(state.typeToken);
    const inferredBaseTypeName =
      typeof inheritedToken?.name === "string" && inheritedToken.name.length > 0 && inheritedToken.name !== "Function"
        ? this.widgetTypeTokens.get(inheritedToken) ?? inheritedToken.name
        : undefined;
    const baseTypeNames = [
      ...new Set([...state.baseTypeNames, ...(inferredBaseTypeName === undefined ? [] : [inferredBaseTypeName])]),
    ];
    const baseMetadata = baseTypeNames.map((baseTypeName) => this.buildWidgetTypeMetadata(baseTypeName, visiting));
    const inheritedCss = state.inheritCss ? baseMetadata.flatMap((metadata) => metadata.defaultStylesheets) : [];
    const inheritedBindings = state.inheritBindings ? baseMetadata.flatMap((metadata) => metadata.bindings) : [];
    const inheritedComponentClasses = state.inheritComponentClasses
      ? baseMetadata.flatMap((metadata) => metadata.componentClasses)
      : [];
    const typeHierarchy = [
      ...new Set([
        ...baseMetadata.flatMap((metadata) => metadata.typeHierarchy),
        ...(state.typeToken?.name === undefined || state.typeToken.name.length === 0 ? [] : [state.typeToken.name]),
        typeName,
      ]),
    ];
    const metadata: WidgetTypeMetadata = {
      typeName,
      typeHierarchy,
      defaultStylesheets: [
        ...inheritedCss,
        ...(state.defaultStylesheet === undefined ? [] : [state.defaultStylesheet]),
        ...(state.scopedStylesheet === undefined ? [] : [state.scopedStylesheet]),
      ],
      bindings: [...inheritedBindings, ...state.bindings],
      componentClasses: [...new Set([...inheritedComponentClasses, ...state.componentClasses])],
      borderTitle: state.borderTitle ?? baseMetadata.at(-1)?.borderTitle ?? null,
      borderSubtitle: state.borderSubtitle ?? baseMetadata.at(-1)?.borderSubtitle ?? null,
    };

    visiting.delete(typeName);
    this.widgetTypeMetadata.set(typeName, metadata);
    return metadata;
  }
}
