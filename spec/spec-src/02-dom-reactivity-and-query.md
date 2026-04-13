# DOM, Reactivity, and Query Semantics

## DOMNode as Structural Primitive

`textual.dom.DOMNode` extends `MessagePump` and defines shared behavior for app/screens/widgets.

Core responsibilities:

- parent/child linkage via a single `NodeList` per node,
- CSS-facing identity (`id`, classes, type names, pseudo classes),
- separation of stylesheet-derived styles from inline overrides, exposed as a merged `RenderStyles` surface,
- query and traversal APIs,
- reactivity integration (watchers, validators, computes, data binding).

A node owns: `_classes`, `_id`, `_name`, `_nodes` (`NodeList`), `_css_styles` (stylesheet-derived), `_inline_styles`, `styles` (merged `RenderStyles`), `_component_styles`, a `BindingsMap` copied from the class-level merged bindings, and an LRU `_query_one_cache` keyed on the child-tree update counter.

## Identity and Style Surface

- `id` is assigned at most once; subsequent assignment raises. `id` and class names are identifier-validated on entry.
- `display` and `visible` are stored as style rules; writing the Python attribute maps to the corresponding style rule and triggers a layout refresh. `NodeList` exposes cached `displayed` and `displayed_and_visible` sequences that track the list's update counter so derived views stay in sync with mutation.
- `DEFAULT_CSS`, `SCOPED_CSS`, and the class-level flags `inherit_css`, `inherit_bindings`, and `inherit_component_classes` determine how default styling, key bindings, and component classes propagate through the class hierarchy.

## Class-Time Metadata

`DOMNode.__init_subclass__` derives, once per class:

- `_reactives`: ordered mapping of every `Reactive` descriptor inherited from the MRO,
- `_computes`: frozenset of reactive names with a `compute_<name>` or `_compute_<name>` method,
- `_css_type_name` / `_css_type_names`: CSS-facing type names from the DOM base chain,
- `_merged_bindings`: bindings merged across bases according to `inherit_bindings`.

Instances read from these class-level tables; they are never rebuilt per instance.

## Reactivity Model

`textual.reactive.Reactive` is a data descriptor storing per-owner metadata and per-instance values under `_reactive_<name>`. Flags set at construction: `layout`, `repaint`, `init`, `always_update`, `compute`, `recompose`, `bindings`, `toggle_class`. `reactive` is `Reactive` with `init=True`; `var` is `Reactive` with `layout=False`, `repaint=False` (no auto-refresh).

Default resolution, in order:

- `Initialize(callback)` — called with the owning object,
- any other callable — called with no arguments,
- literal — used as-is.

If a `compute_<name>` exists and the descriptor has `init=True`, the initial value is the compute result instead of the declared default.

Hook discovery is by attribute name on the owning object:

- validators: `_validate_<name>` runs first, then `validate_<name>`; each returns the (possibly coerced) value that gets stored.
- watchers: `_watch_<name>` then `watch_<name>` then any externally registered watchers from `DOMNode.watch(...)`.
- compute: a class may define either `compute_<name>` or `_compute_<name>` — not both. Presence of either makes the reactive read-only via `__set__` (setting raises `AttributeError`); the getter re-runs the compute each access, stores the new value, and fires watchers if it changed.

Watcher invocation adapts to the callback's parameter count: zero-arg, one-arg (new value), or two-arg (old, new). Watchers may be sync or async; async returns are scheduled via `call_next` and, on completion, post a `Callback` message that re-runs computes so chained derivations settle.

Side effects on a successful set (value changed, or `always_update`, or `_Mutated`):

- toggle classes driven by `toggle_class` based on the new value's truthiness,
- run private then public validators,
- store the new value,
- invoke watchers (private, public, then global subscribers),
- run `_compute` across all computes on the object when `compute=True`,
- call `refresh_bindings()` when `bindings=True`,
- call `refresh(repaint, layout, recompose)` when any of those flags is set.

The same pipeline runs on every set; only the input value and the descriptor flags decide what happens. `toggle_class` also fires during initialization so initial state matches the reactive's default.

// [LAW:dataflow-not-control-flow] The set pipeline is fixed; variability lives in descriptor flags and the value, not in whether the pipeline runs.

// [LAW:single-enforcer] `Reactive._set` is the single enforcer of validation, watcher invocation, compute propagation, and refresh scheduling for reactive writes.

### DOMNode reactivity integration

- `set_reactive(descriptor, value)`: writes `_reactive_<name>` directly, bypassing validators, watchers, computes, and refresh. Requires the reactive to already be registered on the instance's class.
- `mutate_reactive(descriptor)`: re-runs the full set pipeline against the current stored value using a `_Mutated` sentinel, forcing watchers/computes even when equality would suppress them.
- `watch(obj, attribute_name, callback, init=True)`: registers a global watcher tuple `(self, callback)` on `obj.__watchers[attribute_name]`. Duplicates (same callback) are ignored. When `init=True`, the callback is invoked immediately with the current value for both old and new. Watchers whose owning node is `_closing` are pruned on the next dispatch.
- `_post_mount` calls `Reactive._initialize_object`, which materializes defaults for every declared reactive and fires initial watchers for descriptors with `init=True`.

### Data binding

`data_bind(*reactives, **named)` wires reactives on a child node to reactives or literal values from the node currently executing compose (`active_message_pump`).

- Reactive sources subscribe via `self.watch(parent, name, setter, init=True)`; the setter wraps incoming values in `_Mutated` so the child's pipeline fires even when values compare equal.
- Literal sources are delivered once via `call_later`.
- Binding becomes active immediately if the child is already mounted; otherwise initialization is deferred to `call_later` so that mount ordering does not change the observable contract.
- Binding a name that is not a reactive on the child, or binding a source reactive whose owner does not match the compose parent's class, raises `ReactiveError`.

## Query Model

### Query entrypoints on DOMNode

- `query(selector)` — deep query rooted at `_get_dom_base()`; `None` matches all widgets.
- `query_children(selector)` — immediate children only (non-deep DOMQuery).
- `query_one(selector, expect_type=None)` — first breadth-first match; raises `NoMatches`, `WrongType`, or `InvalidQueryFormat`. Does not raise on multiple matches.
- `query_one_optional(...)` — `query_one` returning `None` instead of `NoMatches`.
- `query_exactly_one(...)` — like `query_one` but additionally raises `TooManyMatches` if a second match exists.
- `query_ancestor(selector, expect_type=None)` — walks `parent.ancestors_with_self` upward; does not include `self`. Raises `NoMatches` when nothing matches.

`query`, `query_children`, and the singleton queries all accept a `str` CSS selector or a widget class; a class argument is converted to its `__name__` before parsing.

### Singleton fast paths and caching

Singleton queries consult `base_node._query_one_cache`, an LRU cache keyed on `(base_node._nodes._updates, selector, expect_type)`:

- When the selector is a single id selector (`#foo`), `walk_breadth_search_id` skips selector parsing entirely.
- When the parsed selector set is "simple", cache lookups apply.
- When it is not simple, the query executes without cache participation.

Because the cache key embeds the root `NodeList`'s update counter, any mutation under the root invalidates previously cached answers without explicit eviction. `NodeList.updated()` bumps the counter on itself and every ancestor, so mutations anywhere in the subtree invalidate cache entries rooted above.

### Selector parsing and matching

- Selectors are parsed via `css.parse.parse_selectors`. Parse failures raise `InvalidQueryFormat`.
- Matching is delegated to `css.match.match` against node `css_path_nodes`.

### DOMQuery behavior

`textual.css.query.DOMQuery` is a lazy, immutable view:

- Captures `(root, filter_selectors, exclude_selectors, deep)`; filter and exclude lists are copied from a parent query on construction so chained `filter(...)` / `exclude(...)` calls produce independent queries.
- Nodes are materialized on first access to `.nodes`: the base iterable is `root.walk_children(Widget)` for deep queries or `root._nodes` for shallow queries; every filter selector set must match and no exclude selector set may match.
- Iteration, `len`, `bool`, indexing, and reversal all funnel through the materialized list.

Retrieval:

- `first(expect_type=None)` — first node or `NoMatches`; raises `WrongType` on type mismatch.
- `last(expect_type=None)` — last node, same error contract.
- `only_one(expect_type=None)` — `first`, then verifies no second match exists; raises `TooManyMatches` otherwise.
- `results(filter_type=None)` — iterator optionally filtered by type.

Bulk operations applied uniformly to every matched node:

- class mutation: `add_class`, `remove_class`, `toggle_class`, `set_class`, `set_classes`.
- style mutation: `set_styles(css=None, **updates)` — keyword updates assign via the `styles` descriptor; the optional `css` string is parsed once via `parse_declarations` and merged into each node's `_inline_styles`, then each node is refreshed with `layout=True`.
- refresh: `refresh(repaint, layout, recompose)`.
- focus management: `focus()` focuses the first focusable node; `blur()` defers to the screen's focus reset when the current focus belongs to the query.
- removal: `remove()` delegates to `app._prune` and returns an `AwaitRemove`.
- attribute set: `set(display, visible, disabled, loading)` assigns each provided attribute on every matched node.

Errors: `InvalidQueryFormat`, `NoMatches`, `TooManyMatches`, `WrongType` (all subclasses of `QueryError`).

## Tree Traversal

`walk_children(filter_type=None, *, with_self=False, method="depth", reverse=False)`:

- `method` selects `walk_depth_first` or `walk_breadth_first`.
- `filter_type` restricts the walk to a specific DOMNode subclass.
- `with_self` includes the root node.
- The generator is drained into a list before returning so callers see a stable snapshot even if the tree is mutated afterwards.
- `reverse=True` reverses the resulting list (bottom-up).

## NodeList Semantics

`textual._node_list.NodeList` is the single container for a DOMNode's direct children.

- Backed by a `list` plus a `set` for O(1) membership and a `dict` keyed on widget id.
- Append/insert reject duplicates silently (set membership) and raise `DuplicateIds` when an id collides with an existing entry.
- Mutating operations (`_append`, `_insert`, `_remove`, `_clear`, `_sort`) all funnel through `updated()`, which increments `_updates` on self and walks up the parent chain to bump ancestors. This is the single source of truth for child-tree versioning consumed by `_query_one_cache` and derived-view caches.
- `displayed` and `displayed_and_visible` are memoized against `_updates`; reading them after a mutation rebuilds the filtered sequence exactly once.
- `__getattr__` blocks the mutating list API (`append`, `insert`, `remove`, `pop`, `extend`, `clear`) with `ReadOnlyError`, funneling all mutation through `Widget.mount(...)` / `Widget.remove(...)`.

## Dynamic Class and Inline Style Mutation

Node-level mutation APIs:

- class mutation: `add_class`, `remove_class`, `toggle_class`, `set_class`, `set_classes`. Each validates class identifiers, short-circuits when the set would not change, and (when `update=True`) calls `update_node_styles()`.
- inline style mutation: `set_styles(css=None, **rule_updates)` merges parsed declarations into `_inline_styles` and refreshes with `layout=True`; keyword updates assign directly through the `styles` descriptor.
- `reset_styles()` resets `_css_styles` across the subtree and marks widgets dirty/layout-required.

Style update propagation:

- `update_node_styles(animate=True)` requests stylesheet re-application via `app.update_styles(self, ...)`; absence of an active app is silently tolerated so detached nodes remain usable.
- Specificity, cascading, and final rule resolution are owned by the stylesheet/apply pipeline; nodes request updates but never resolve their own cascaded styles.

// [LAW:single-enforcer] Cascade resolution lives in the stylesheet pipeline; `update_node_styles` is the one hand-off from nodes into that pipeline.
// [LAW:one-source-of-truth] `NodeList._updates` is the one version counter that both derived view caches (`displayed`, `displayed_and_visible`) and singleton query caches consult; no other counter tracks child-tree mutation.
