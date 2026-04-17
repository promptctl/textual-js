# Widget Registry, Reactivity, and Query Semantics

## Widget as Structural Primitive

Every widget in the framework is a React function component wrapped in MobX `observer()` that participates in the framework's CSS identity, query, and reactivity systems.

Core responsibilities per widget:

- CSS-facing identity: `id`, classes, type name, pseudo-classes,
- TCSS style resolution: default styles, user styles, and inline overrides merge into resolved styles,
- query and traversal APIs,
- reactivity integration: watchers, validators, computes, data binding.

### Widget registration

Each widget registers with the framework's widget registry on mount via `useTextual()`:

```tsx
const Button = observer(({ id, classes, variant = 'default', children }) => {
  const { register, postMessage } = useTextual();
  const styles = useStyles();
  // styles.box   — Ink <Box> props (width, padding, border, background, etc.)
  // styles.text  — Ink <Text> props (color, bold, italic, etc.)
  // styles.style — rich-js Style for content segments (used by Line API widgets)

  // Registration happens once on mount, cleanup on unmount
  useEffect(() => {
    const deregister = register({
      id,                          // Optional unique identifier
      classes,                     // Space-separated CSS class string
      typeName: 'Button',          // CSS type name for type selectors
      canFocus: true,              // Whether this widget participates in focus chain
      canFocusChildren: true,      // Whether children can receive focus
    });
    return deregister;
  }, []);

  return (
    <Box {...styles.box} onClick={() => postMessage(new ButtonPressed())}>
      <Text {...styles.text}>{children}</Text>
    </Box>
  );
});

Button.DEFAULT_CSS = `
  Button {
    background: $surface;
    color: $foreground;
    min-width: 16;
    height: 3;
    padding: 0 2;
  }
  Button:focus {
    background: $primary;
  }
  Button.-primary {
    background: $primary;
    color: $foreground;
  }
`;
```

The registry tracks per widget: id, classes (MobX observable set), type name, parent reference (derived from React tree via context), pseudo-class state (MobX observables), and a version counter bumped on every registration/deregistration.

## Identity and Style Surface

### ID

- `id` is a string prop, optional, assigned at mount time.
- IDs must be unique within the active widget tree (DOM/screen-wide). The registry throws `DuplicateIds` if a duplicate is registered.
- Once registered, `id` is immutable for the lifetime of the mount. To change a widget's ID, unmount and remount it.
- ID values must be valid CSS identifiers.

### Classes

- `classes` is a space-separated string prop at mount time.
- After mount, classes are mutated via methods on the widget's registration handle:
  - `addClass(...classNames)` — adds classes, triggers TCSS recalculation
  - `removeClass(...classNames)` — removes classes, triggers TCSS recalculation
  - `toggleClass(className, force?)` — toggles a class, triggers TCSS recalculation
  - `hasClass(className)` — returns boolean
  - `setClasses(classNames)` — replaces all classes
- Class names must be valid CSS identifiers.
- The classes set is a MobX observable — mutations trigger the TCSS cascade to recompute styles for the widget and any descendants matched by selectors that reference the changed class.

### Display and visible

- `display` and `visible` are stored as TCSS style rules, not as plain boolean fields.
- Writing `setDisplay(false)` maps to setting `display: none` via inline styles.
- Writing `setVisible(false)` maps to setting `visibility: hidden` via inline styles.
- The TCSS cascade resolves these — CSS rules can set display/visibility, and class changes can toggle them.
- `display: none` causes the widget to not render (Ink's `display="none"`). `visibility: hidden` renders the widget but makes it invisible (occupies space but not interactive).

### Type name

- `typeName` is derived from the component's `displayName` or function name. It is used for CSS type selectors: `Button { ... }` matches all widgets with `typeName: 'Button'`.
- Custom type names can be provided via the `typeName` registration option.

### DEFAULT_CSS, SCOPED_CSS, and inheritance

- `DEFAULT_CSS` is a static property on the widget component. It is parsed by css-tree with the widget's type name as scope — the type selector is automatically prepended to every rule, so declarations only apply to instances of this widget type. This is the typical case.
- `SCOPED_CSS` is an alternative static property for declaring CSS with a different scope mechanism — used by widget types that need a more restrictive or broader scope than the default type scope (e.g., scoping by id or by an ancestor selector rather than by type).
- Both `DEFAULT_CSS` and `SCOPED_CSS` are processed at widget type registration time (import time) and registered in the global style registry. Only one scope mechanism is applied per rule set; a widget type chooses the static property whose scoping matches its intent.
- `inheritCss` (default: `true`) controls whether a widget type inherits `DEFAULT_CSS` (and `SCOPED_CSS`) from its base types. When a widget extends another (via composition or wrapping), `inheritCss: false` prevents the parent's default styles from applying.
- `inheritBindings` (default: `true`) controls whether bindings from base types are merged into the widget's binding set.
- `inheritComponentClasses` (default: `true`) controls whether a widget type inherits `COMPONENT_CLASSES` declarations from its base types. When `false`, the widget starts fresh and declares only its own component classes.

### COMPONENT_CLASSES

- `COMPONENT_CLASSES` is a static property on the widget component: a set of CSS class names the widget documents as internal styling hooks for its sub-parts (e.g., `text-area--cursor`, `text-area--selection`, `text-area--gutter`, `switch--slider`).
- These class names are intended to be targeted by user stylesheets to restyle internal pieces of a widget without reaching into its implementation.
- Merging across the type hierarchy is controlled by `inheritComponentClasses`.

Component classes resolve to both Ink props *and* rich-js `Style` depending on where they apply:

- For a widget that renders sub-parts as separate elements (e.g., a `switch--slider` rendered as its own `<Box>`), the component class contributes Ink props to that element.
- For widgets that render in **Line API mode** — `TextArea`, `Input`, `DataTable`, `Tree`, `OptionList`, `Log`, `RichLog`, `Markdown` — component classes resolve to a rich-js `Style` applied to individual **segments** within a rendered line. A single rendered line may carry many segments (e.g., "syntax-highlighted code + selection overlay + cursor cell + matched-bracket highlight"), each tagged with its component class(es) so the TCSS cascade resolves its `Style`. The cascade runs once per (widget, component-class-set) tuple; the resulting `Style` is cached on the widget's `ResolvedStyles` observable.

// [LAW:single-enforcer] Component-class styling flows through the same TCSS cascade as outer-box styling. Line API widgets do not maintain a parallel styling path — they read `ResolvedStyles.components[name]` to get a rich-js `Style` per component class.

## Class-Level Metadata

Each widget type derives, once per type (at import/registration time, not per instance):

- **Reactive descriptors**: ordered mapping of every reactive property declared on the type. Includes the property name, default value, and descriptor flags.
- **Computes**: set of reactive names that have a corresponding `compute_<name>` method.
- **CSS type name**: used for type selectors in TCSS.
- **Merged bindings**: bindings merged across base types according to `inheritBindings`.
- **DEFAULT_CSS / SCOPED_CSS**: parsed into the global stylesheet with the appropriate scope applied.
- **Merged component classes**: `COMPONENT_CLASSES` merged across base types according to `inheritComponentClasses`.

This metadata is per-type, never rebuilt per instance.

## Reactivity Model

Reactive properties are MobX observables with framework conventions layered on top. The public API is `reactive()` — a function that declares a reactive property with framework hooks.

### Declaring reactive properties

```tsx
// Option A: Using a store class with MobX decorators
class ButtonStore {
  @observable accessor variant: ButtonVariant = 'default';
  @observable accessor disabled: boolean = false;
  @observable accessor loading: boolean = false;

  // Validator: called before storage via MobX intercept()
  validate_variant(value: string): ButtonVariant {
    const valid = ['default', 'primary', 'success', 'warning', 'error'];
    if (!valid.includes(value)) throw new Error(`Invalid variant: ${value}`);
    return value as ButtonVariant;
  }

  // Watcher: called after value changes via MobX observe()
  watch_disabled(oldValue: boolean, newValue: boolean) {
    // Side effects when disabled state changes
  }
}

// Option B: Using the reactive() helper in a hook
function useButtonState() {
  const store = useLocalStore(() => ({
    variant: reactive('default', { repaint: true }),
    disabled: reactive(false, { repaint: true, toggleClass: '-disabled' }),
    loading: reactive(false, { repaint: true, toggleClass: '-loading' }),
  }));
  return store;
}
```

### Reactive descriptor flags

Each reactive property is configured with flags:

| Flag | Default | Effect |
|------|---------|--------|
| `layout` | `false` | Changing this property triggers a layout refresh (Ink re-measures) |
| `repaint` | `true` | Changing this property triggers a re-render |
| `init` | `true` | Fire watchers on mount with `(currentValue, currentValue)` — default is stored first (verified in original codebase) |
| `alwaysUpdate` | `false` | Fire watchers even when new value === old value |
| `bindings` | `false` | Refresh the binding chain when this property changes |
| `toggleClass` | `null` | CSS class name to toggle based on the value's truthiness |
| `recompose` | `false` | Trigger a full recompose (re-run compose/children) on change |

`reactive(defaultValue, flags?)` creates a property with these flags. `var(defaultValue)` is a shorthand for `reactive(defaultValue, { layout: false, repaint: false })` — a reactive that tracks value but does not trigger re-renders.

### Reactive value types

A reactive property's value may be any type — primitives, objects, arrays, or rich-js types. Widgets frequently use rich-js types as reactive values:

- `label`, `message`, `title` on content-bearing widgets: `string | Content` — strings are parsed as markup at render time; `Content` values are used directly.
- Color-valued reactives: rich-js `Color` instances (e.g., `Gradient.start`, `Gradient.end`).
- `value` on a `Select<T>`: the generic type parameter `T` (could be primitive or object).
- `data` on `DataTable`: a MobX observable array of row objects.

The reactivity pipeline is type-agnostic — validators, watchers, and computes operate on whatever type the declaration chose. Rich-js types flow through the pipeline unchanged; only validators may coerce (e.g., `validate_label` could parse a markup string into `Content`).

### Default value resolution

Default values are resolved in order:

1. **`Initialize` wrapper** — if the default is wrapped in an explicit `Initialize(...)` wrapper, the wrapped callable is called with the owning widget reference. Only this explicit wrapper triggers owner-aware initialization; a plain function that happens to accept a parameter is not called with the widget (verified in original codebase).
2. **Any other callable** — called with no arguments.
3. **Literal** — used as-is.

If a `compute_<name>` exists and the descriptor has `init: true`, the initial value is the compute result instead of the declared default.

### Hook discovery by naming convention

The framework discovers methods on the widget's store by naming convention and wires them into MobX:

- **Validators**: `validate_<name>(value: T): T` — returns the (possibly coerced) value that gets stored. Can throw to reject the value. Implemented via MobX `intercept()` on the observable.
- **Watchers**: `watch_<name>(oldValue: T, newValue: T)` — called after the value changes. Convention-based watchers fire first, then externally registered watchers. Implemented via MobX `observe()`.
- **Computes**: `compute_<name>(): T` — makes the reactive read-only (setting throws). The value is recomputed when any MobX observable read during computation changes. Implemented via MobX `computed`.

Watcher invocation adapts to the callback's parameter count:
- Zero-arg: `watch_count()` — called with no arguments
- One-arg: `watch_count(newValue)` — called with the new value
- Two-arg: `watch_count(oldValue, newValue)` — called with both values

### Set pipeline

When a reactive property is set, the full pipeline runs. The pipeline is fixed — every step always executes. Variability lives in the descriptor flags and the value, not in whether steps run.

// [LAW:dataflow-not-control-flow] The set pipeline is fixed; variability lives in descriptor flags and the value, not in whether the pipeline runs.

Pipeline order:

1. **Validate**: `intercept()` calls `validate_<name>` if it exists. The validator can transform the value or reject it by returning `null` from the interceptor. A rejected value stops the pipeline — no storage, no watchers.
2. **Store**: the MobX observable is updated with the (possibly transformed) value.
3. **Toggle classes**: if `toggleClass` is set, add or remove the named CSS class based on the new value's truthiness. This triggers TCSS recalculation.
4. **Invoke watchers**: convention-based `watch_<name>` fires first, then externally registered watchers (global subscribers). Watchers run in registration order.
5. **Run computes**: all `computed` properties on the widget are checked for staleness. MobX handles this automatically — any computed that read the changed observable will recompute.
6. **Refresh bindings**: if `bindings: true`, refresh the binding chain.
7. **Trigger re-render**: MobX's `observer()` detects the observable change and triggers a React re-render when `repaint` or `layout` flags are set. No manual `refresh()` call needed.

During initialization (mount), `toggleClass` fires for the initial value so the CSS state matches the reactive's default from the start.

// [LAW:single-enforcer] The MobX intercept → observable → reaction chain is the single enforcer of validation, watcher invocation, compute propagation, and render triggering for reactive writes.

### Direct set and force mutation

- `setReactive(name, value)`: writes the MobX observable directly, bypassing validators, watchers, computes, and refresh. Use for internal framework state that must not trigger side effects. Requires the reactive to already be declared on the widget type.
- `mutateReactive(name)`: re-runs the full set pipeline against the current stored value, forcing watchers and computes even when equality would suppress them. Useful for triggering side effects on mutable objects (arrays, maps) whose identity hasn't changed.

### Global watchers

`watch(target, attributeName, callback, init?)` registers a global watcher on `target`'s attribute:

- Duplicates (same callback reference) are ignored.
- When `init` is true, the callback is invoked immediately with the current value.
- Watchers whose owning widget is unmounting are pruned on the next dispatch cycle.
- Global watchers fire after convention-based watchers in the set pipeline.

### Reactive initialization on mount

When a widget mounts:

1. Default values are materialized for every declared reactive property.
2. `compute_<name>` properties compute their initial values.
3. For every reactive with `init: true`, watchers fire with `(currentValue, currentValue)` — the default is stored first, then watchers are invoked with old and new both equal to the default (verified in original codebase).
4. `toggleClass` fires for each reactive with a `toggleClass` flag, applying the initial class state.

This happens inside a MobX action, so all the observable mutations and reactions batch into a single render cycle.

## Data Binding

`dataBind(bindings)` wires reactive properties on a child widget to reactive properties or literal values from the composing parent.

### Usage

```tsx
// Parent widget composes a child and binds to its reactive properties
const ParentWidget = observer(() => {
  const store = useLocalStore(() => ({
    theme: reactive('dark'),
  }));

  return (
    <ChildWidget
      {...dataBind({
        childTheme: store.theme,     // Reactive source — stays synchronized
        maxItems: 10,                 // Literal source — delivered once
      })}
    />
  );
});
```

### Binding behavior

- **Reactive sources**: subscribe via `watch(parent, name, setter, init: true)`. The setter forces the child's pipeline to fire even when values compare equal, ensuring watchers and side effects always run.
- **Literal sources**: delivered once asynchronously after mount.
- Binding becomes active immediately if the child is already mounted; otherwise initialization is deferred so that mount ordering does not change the observable contract.

### Error cases

- Binding a name that is not a declared reactive on the child throws `ReactiveError`.
- Binding a reactive source whose owner does not match the compose parent's type throws `ReactiveError`.

## Query Model

Queries operate against the widget registry, not against the React DOM. The registry is a framework-managed index of all mounted widgets with their CSS identities. Selectors are parsed via css-tree.

### Query entrypoints

All query methods are available via `useTextual()`:

```tsx
const { query, queryOne, queryChildren, queryAncestor } = useTextual();

// Deep query rooted at this widget
const buttons = query('Button');

// Direct children only
const tabs = queryChildren('Tab');

// Single match (throws if none)
const saveBtn = queryOne('#save', Button);

// Walk ancestors
const screen = queryAncestor('Screen');
```

| Method | Behavior |
|--------|----------|
| `query(selector)` | Deep query rooted at the widget. `null` matches all widgets. Returns `DOMQuery`. |
| `queryChildren(selector)` | Immediate children only (non-deep). Returns `DOMQuery`. |
| `queryOne(selector, expectType?)` | First match. Throws `NoMatches`, `WrongType`, or `InvalidQueryFormat`. Does not throw on multiple matches. |
| `queryOneOptional(selector, expectType?)` | Returns `null` instead of throwing `NoMatches`. |
| `queryExactlyOne(selector, expectType?)` | Like `queryOne` but additionally throws `TooManyMatches` if a second match exists. |
| `queryAncestor(selector, expectType?)` | Walks ancestors upward; does not include the calling widget. Throws `NoMatches` when nothing matches. |

Parse failures throw `InvalidQueryFormat`.

### Caching

Query results are MobX computed values keyed on the registry's version counter and the selector:

- When the selector is a single ID selector (`#foo`), a fast-path lookup on the registry's ID map skips full selector evaluation.
- When the parsed selector is "simple" (no combinators, single condition), cached lookups apply.
- Complex selectors execute without cache participation.

Because the cache key embeds the registry version counter, any widget mount/unmount anywhere in the tree invalidates previously cached answers without explicit eviction.

// [LAW:one-source-of-truth] The registry version counter is the one version signal that query caches consult; no other counter tracks tree mutation.

### DOMQuery behavior

`DOMQuery` is a lazy, immutable view over query results:

- Captures root widget, filter selectors, exclude selectors, and deep/shallow flag on construction. Filter and exclude lists are copied so chained `.filter()` / `.exclude()` calls produce independent queries.
- Results are materialized on first access: the base iterable walks the registry (for deep queries) or reads direct children (for shallow queries). Every filter selector must match and no exclude selector may match.
- Iteration, length, indexing, and reversal all funnel through the materialized list.

#### Retrieval methods

| Method | Behavior |
|--------|----------|
| `first(expectType?)` | First node or throws `NoMatches`. Throws `WrongType` on type mismatch. |
| `last(expectType?)` | Last node, same error contract. |
| `onlyOne(expectType?)` | `first()`, then verifies no second match exists. Throws `TooManyMatches` otherwise. |
| `results(filterType?)` | Iterator optionally filtered by type. |

#### Bulk mutation methods

These apply uniformly to every matched node:

| Method | Effect |
|--------|--------|
| `addClass(...classNames)` | Add CSS classes to all matched widgets |
| `removeClass(...classNames)` | Remove CSS classes from all matched widgets |
| `toggleClass(className, force?)` | Toggle a CSS class on all matched widgets |
| `setClass(className, add)` | Add or remove a class based on `add` boolean |
| `setClasses(classNames)` | Replace all classes on matched widgets |
| `setStyles(css?, updates?)` | Merge parsed declarations into inline styles, triggers TCSS recalculation |
| `refresh(repaint?, layout?, recompose?)` | Trigger refresh on all matched widgets |
| `focus()` | Focus the first focusable node in the query results |
| `blur()` | Reset focus when the currently focused widget is in the query results |
| `remove()` | Remove (unmount) all matched widgets |
| `set(display?, visible?, disabled?, loading?)` | Set attributes on all matched widgets |

#### Error types

All are subclasses of `QueryError`:

| Error | When |
|-------|------|
| `InvalidQueryFormat` | CSS selector string fails to parse |
| `NoMatches` | Singleton query found zero matches |
| `TooManyMatches` | `queryExactlyOne` or `onlyOne` found more than one match |
| `WrongType` | Match found but does not match the expected type |

## Tree Traversal

`walkChildren(filterType?, options?)` traverses the widget subtree:

| Option | Default | Effect |
|--------|---------|--------|
| `method` | `'depth'` | `'depth'` for depth-first, `'breadth'` for breadth-first |
| `filterType` | `null` | Restrict results to a specific widget type |
| `withSelf` | `false` | Include the root widget in the results |
| `reverse` | `false` | Reverse the result order (bottom-up) |

The traversal walks the widget registry's parent-child relationships (derived from the React component tree). It produces a stable snapshot — the result is computed at call time. If the tree is mutated during iteration, the snapshot does not change.

## Widget Registry Semantics

The widget registry is the single container tracking all mounted widgets.

### Storage

- Backed by an ordered list (preserves DOM order), a `Set` for O(1) membership checks, and a `Map<string, Widget>` keyed on widget ID.
- All three structures are MobX observables.

### Registration

- `register(options)` adds a widget to the registry. Returns a `deregister` function.
- Registration with a duplicate ID throws `DuplicateIds`.
- The parent reference is derived from React context: the nearest ancestor widget that is also registered provides the parent link.

### Version counter

- Every registration and deregistration bumps the version counter on the registry.
- Ancestor registries also have their version bumped (walking up the parent chain).
- This counter is the single source of truth for tree versioning consumed by query caches and derived views.

### Cleanup

- When a widget unmounts (React `useEffect` cleanup), its deregistration function runs automatically.
- Global watchers referencing the deregistered widget are pruned on the next dispatch cycle.

// [LAW:single-enforcer] Cascade resolution lives in the TCSS pipeline; widgets request style updates but never resolve their own cascaded styles.
// [LAW:one-source-of-truth] The registry version counter is the one signal that query caches and derived views consult; no other counter tracks tree mutation.
