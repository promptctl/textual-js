# Docs Spec: Tree Widget

## Purpose
Describes the Tree widget doc page — a focusable, scrollable hierarchical browser whose nodes can carry arbitrary typed data — covering construction, reactive configuration, navigation bindings, node manipulation, selection/highlight messages, styling seams, and customization hooks.

## Audience
Widget authors and app developers building tree-like UIs: file browsers, outline views, JSON inspectors, settings trees, and similar hierarchical displays.

## Required sections
1. Overview — Tree as a focusable scrolling hierarchy, generic in its data payload type (`Tree<DataType>`), with a single root node accessible via `tree.root`.
2. Construction — root label (string or rich text), optional root data, plus standard widget props (id, classes, disabled).
3. Reactive attributes — `showRoot`, `showGuides`, `guideDepth` (clamped 2–10), `hoverLine`, `cursorLine`, `autoExpand`, `centerScroll`.
4. Properties — `root`, `cursorNode`, `lastLine`.
5. Static/icon configuration — `ICON_NODE`, `ICON_NODE_EXPANDED`, and the `ALLOW_SELECT` flag for subclass use.
6. Messages — `NodeCollapsed`, `NodeExpanded`, `NodeHighlighted`, `NodeSelected`, each carrying the affected `node` and a control-reference to the originating tree; handler-name convention.
7. Bindings — default key map for cursor movement, selection, toggle, and expand/collapse siblings.
8. Component classes — `tree--cursor`, `tree--guides`, `tree--guides-hover`, `tree--guides-selected`, `tree--highlight`, `tree--highlight-line`, `tree--label`, and the semantics of styling guide lines (including hiding via transparent color).
9. Tree methods — node lookup (`getNodeAtLine`, `getNodeById`), cursor and selection (`moveCursor`, `moveCursorToLine`, `selectNode`, `unselect`), scrolling (`scrollToLine`, `scrollToNode`), tree manipulation (`clear`, `reset`, `addJson`), rendering hooks (`processLabel`, `renderLabel`, `getLabelWidth`).
10. TreeNode API — properties (tree, parent, children, siblings, next/previous sibling, id, label, data, is_expanded/is_collapsed, is_last/is_root, allow_expand, line), children-adding (`add`, `addLeaf` with `before`/`after` positioning), expand/collapse operations including recursive variants, removal (`remove`, `removeChildren`), label mutation, and refresh.
11. Error conditions — removing the root, unknown node id lookup, invalid add requests.
12. Guide line styles — the three named sets (default, bold, double) and how the active set is selected via `tree--guides`'s text-style.
13. Behavior notes — auto-expand toggling on selection of non-leaf, when `NodeHighlighted` fires, that recursive expand/collapse emit one message per node, lazy line-list rebuild, click-on-icon vs click-on-label semantics, and the guide-depth clamp.
14. Usage pattern — a concise end-to-end example composition with a tree in a screen.

## Key concepts
- Trees are parameterized by a data type; every node carries a typed payload, enabling the caller to retrieve rich state on selection rather than stringly-typed lookups.
- The root is always present and not removable; manipulation centers on adding children, toggling expansion, and moving the cursor.
- The "cursor" is the navigation pointer; "selection" is an explicit message emitted when the user commits (Enter or click).
- Rendering uses the Line API: the visible line list is derived from the expanded state of nodes and rebuilt lazily on idle.
- Styling seams are component-class based (`tree--...`); guide line appearance (including which character set to use) is derived from the `tree--guides` text-style.
- Navigation bindings are symmetric: cursor movement, sibling jumps, parent jump, expand/collapse, and "toggle all siblings."

## Behaviors and contracts
- All node-emitted messages carry both the `node` and a `control` reference to the originating `Tree`, allowing a single listener to disambiguate multiple trees on a screen.
- `NodeHighlighted` fires only when the cursor moves to a different node; repeated "selection" of the current node does not re-fire.
- When `autoExpand` is on (default), selecting a non-leaf node toggles its expansion state; when off, selection and expansion are orthogonal.
- Recursive expand-all / collapse-all fires one `NodeExpanded` / `NodeCollapsed` per node traversed.
- `guideDepth` is clamped to [2, 10]; values outside that range are silently coerced in.
- Removing the root raises an error; code should call `clear()` or `reset()` instead.
- Adding a node with both `before` and `after` supplied raises an error; exactly one or neither is allowed.
- `refresh()` on a node invalidates the cached line list for repaint.
- Click on the expand/collapse icon toggles the node without selecting it; click elsewhere on the line selects.

## Example requirements
All examples JSX/TypeScript, using Ink primitives and textual-js APIs. Describe (do not inline) examples for:
- Mounting a tree with a typed data payload (e.g. a file-path string) and populating root children.
- Listening for `NodeSelected` to open/inspect the selected payload.
- Lazy-loading children: handling `NodeExpanded` to fetch and insert children under a branch on demand.
- Rebuilding a tree from a JSON structure via `addJson` and resetting with a new root label via `reset`.
- Styling a custom cursor and hiding guide lines via TCSS on the `tree--...` component classes.
- Overriding `renderLabel` to prepend a custom icon or badge per node type.
- Overriding `getLabelWidth` for faster sizing when labels are known to be plain strings.

## Cross-references
- `spec/docs-spec/widgets_overview.md` — widget base contract, component classes, focus model, Line API.
- `spec/docs-spec/events_reference.md` — how widget messages are dispatched.
- `spec/docs-spec/actions_and_bindings.md` — the binding table format and how widget bindings interact with screen/app bindings.
- `spec/spec-src/09-widget-base-contract.md` — the Line-API contract tree rendering relies on.
- `spec/spec-src/10-widget-catalog.md` — catalog entry for Tree and TreeNode.
- `spec/spec-src/04-styling-and-css-engine.md` — component classes and pseudo-classes.

## Notes for writers
- Drop Python generics syntax (`Tree[DataType]`) in favor of TypeScript (`Tree<DataType>`).
- Keyword-only arguments (`*, before=None, after=None, expand=False`) become options-object properties in JS; describe them as an options argument with a single-choice constraint on `before` / `after`.
- Do not describe `ComposeResult` generators; textual-js widgets are React function components wrapped in `observer()`; children are rendered as JSX.
- `Text` / `TextType` from Rich translate to textual-js's content type (plain string or rich-content); reference the content-markup doc instead of Rich.
- The Python handler-name convention (`on_tree_node_selected`) maps to the textual-js message subscription conventions — describe the subscription API in textual-js terms, not the Python snake_case methods.
- `AwaitMount`/`AwaitRemove` return types do not translate as-is; in textual-js these are Promises.
- The LINES class attribute with Unicode box-drawing sets does carry over — describe the three named sets and the selection rule through `tree--guides`'s text-style.
- Do not describe an `asyncio` or thread model for tree updates — tree mutations happen on the render loop via MobX-backed state.
