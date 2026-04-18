# Widget Base Contract

## Overview

Every widget in textual-js is a React function component wrapped in MobX `observer()`. This spec defines the behavioral contracts that all widgets share — the base layer that the widget catalog (spec 10) builds on.

// [LAW:one-type-per-behavior] These behaviors are implemented once in hooks, context, and base utilities. No individual widget reimplements them.

## Widget Anatomy

A textual-js widget has these parts:

```tsx
const MyWidget = observer(({ id, classes, children, ...props }) => {
  // 1. Framework connection
  const { register, postMessage, query } = useTextual();
  const styles = useStyles();

  // 2. Widget state (MobX observables)
  const store = useLocalStore(() => ({
    count: reactive(0, { repaint: true }),
  }));

  // 3. Registration (CSS identity for TCSS and queries)
  useEffect(() => register({
    id,
    classes,
    typeName: 'MyWidget',
    canFocus: true,
  }), []);

  // 4. Render (Ink primitives with resolved TCSS styles)
  return (
    <Box {...styles.box}>
      <Text {...styles.text}>{children}</Text>
    </Box>
  );
});

// 5. Static configuration
MyWidget.displayName = 'MyWidget';
MyWidget.DEFAULT_CSS = `MyWidget { min-width: 10; }`;
MyWidget.BINDINGS = [{ key: 'enter', action: 'activate' }];
MyWidget.canFocus = true;
MyWidget.canFocusChildren = true;
```

`useStyles()` returns the widget's resolved style bundle: `{ box, text, style, components }`. `box` and `text` are Ink-compatible props for compose-mode widgets. `style` is the widget's ambient rich-js `Style` for content segments, and `components` maps component-class names to rich-js `Style` overlays for line-based rendering.

## Static Configuration Surface

Static properties on the widget component:

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `DEFAULT_CSS` | `string` | `""` | TCSS styles scoped to this widget type |
| `CSS` | `string` | `""` | Additional TCSS (higher specificity than DEFAULT_CSS) |
| `COMPONENT_CLASSES` | `string[]` | `[]` | CSS class names this widget uses internally (documented for theming) |
| `BINDINGS` | `Binding[]` | `[]` | Key bindings for this widget |
| `canFocus` | `boolean` | `false` | Whether this widget participates in the focus chain |
| `canFocusChildren` | `boolean` | `true` | Whether children of this widget can receive focus |
| `BORDER_TITLE` | `string` | `""` | Title rendered in the top border |
| `BORDER_SUBTITLE` | `string` | `""` | Subtitle rendered in the bottom border |
| `inheritCss` | `boolean` | `true` | Whether to inherit DEFAULT_CSS from base widget types |
| `inheritBindings` | `boolean` | `true` | Whether to merge bindings from base widget types |

## Reactive Widget State

Base reactive properties available on every widget (MobX observables):

| Property | Type | Flags | Description |
|----------|------|-------|-------------|
| `hasFocus` | `boolean` | `repaint` | Whether this widget currently has focus (set by focus manager) |
| `mouseHover` | `boolean` | `repaint` | Whether the mouse is over this widget |
| `disabled` | `boolean` | `repaint, toggleClass: '-disabled'` | Disabled state — suppresses most input |
| `loading` | `boolean` | `repaint, toggleClass: '-loading'` | Loading state — suppresses all input, shows overlay |
| `display` | `boolean` | `layout` | Whether the widget renders (maps to TCSS `display`) |
| `visible` | `boolean` | `repaint` | Whether the widget is visible (maps to TCSS `visibility`) |
| `scrollX` | `number` | `repaint` | Horizontal scroll offset |
| `scrollY` | `number` | `repaint` | Vertical scroll offset |
| `scrollTargetX` | `number` | — | Target X for animated scrolling |
| `scrollTargetY` | `number` | — | Target Y for animated scrolling |
| `virtualSize` | `Size` | `layout` | Total scrollable content size |
| `showVerticalScrollbar` | `boolean` | `layout` | Whether vertical scrollbar is visible |
| `showHorizontalScrollbar` | `boolean` | `layout` | Whether horizontal scrollbar is visible |

### Pseudo-class mapping

Reactive state maps to CSS pseudo-classes for TCSS selector matching:

| State | Pseudo-class | Inverse pseudo-class |
|-------|-------------|---------------------|
| `hasFocus` | `:focus` | `:blur` |
| `mouseHover` | `:hover` | — |
| `disabled` | `:disabled` | `:enabled` |
| `canFocus` | `:can-focus` | — |
| Theme dark mode | `:dark` | `:light` |
| No children | `:empty` | — |
| First child | `:first-child` | — |
| Last child | `:last-child` | — |
| First of type | `:first-of-type` | — |
| Last of type | `:last-of-type` | — |

Changes to these states trigger TCSS recalculation for selectors that reference the corresponding pseudo-class.

## Lifecycle

### Compose and mount

1. Widget function body runs (React render). Children are declared via JSX.
2. `useEffect` fires after React commits the render. Widget registers with the framework.
3. `Compose` message is dispatched. Widget may dynamically add children in response.
4. `Mount` message is dispatched. Widget is fully in the tree, styled, and ready for interaction.
5. Reactive properties with `init: true` fire their watchers.

```tsx
// Lifecycle hook
const { onCompose, onMount, onUnmount } = useTextual();

onCompose(() => {
  // Dynamic child setup
});

onMount(() => {
  // Widget is in the tree and styled
  loadInitialData();
});

onUnmount(() => {
  // Cleanup before removal
});
```

### Refresh and layout scheduling

Refresh translates to MobX observable mutations:

| Action | Mechanism | Result |
|--------|-----------|--------|
| Content change | MobX observable mutation | `observer()` re-renders the widget |
| Style change | TCSS recalculation updates `ResolvedStyles` | `observer()` re-renders with new Ink props |
| Layout change | Style dimension/padding/margin observable changes | Ink/Yoga recomputes layout |
| Scroll change | Scroll offset observable changes | Re-render with new scroll position |
| Recompose | MobX observable list change (children) | React re-renders with new children |

MobX's `runInAction` batches multiple changes into a single React render cycle.

### Removal

- `remove()` unmounts the widget from the React tree.
- `removeChildren(selector?)` unmounts children matching the selector (all children if no selector).
- Unmount dispatches the `Unmount` message and triggers cleanup:
  - Workers cancelled (via WorkerManager)
  - Timers cleared
  - Widget deregistered from the registry
  - `useEffect` cleanup functions run
  - Global watchers on this widget are pruned

## Rendering Contract

### Default rendering behavior

| Widget type | Default render behavior |
|-------------|------------------------|
| Container (has children) | Renders children as JSX within a styled `<Box>` |
| Leaf (no children) | Renders content (text, graphics) within a styled `<Box>` and `<Text>` |

All widgets:
- Call `useStyles()` to get resolved TCSS styles as Ink props
- Spread `styles.box` on their outer `<Box>` and `styles.text` on their `<Text>` elements
- Do NOT hardcode Ink style props — all styling comes from TCSS through the cascade

```tsx
// WRONG — hardcoded styles bypass TCSS
const Bad = observer(() => (
  <Box backgroundColor="red" padding={1}>
    <Text bold>Hello</Text>
  </Box>
));

// RIGHT — TCSS-driven styles
const Good = observer(() => {
  const styles = useStyles();
  return (
    <Box {...styles.box}>
      <Text {...styles.text}>Hello</Text>
    </Box>
  );
});
Good.DEFAULT_CSS = `
  Good {
    background: red;
    padding: 1;
    text-style: bold;
  }
`;
```

### Border rendering

- `BORDER_TITLE` and `BORDER_SUBTITLE` are reactive values of type `string | Content`, rendered inside the widget's border.
- `border-title-align` and `border-subtitle-align` TCSS properties control positioning (left, center, right).
- Plain strings render with the ambient border style; markup strings are parsed via rich-js at render time; `Content` is used directly.
- At render time, the framework replaces a span of the top or bottom border row with the title/subtitle content. Placement uses rich-js `cellLength`, so wide and combining characters align correctly within the border row.
- Border titles are reactive — changing them triggers a re-render.

## Line API Widgets

Widgets that manage their own per-line rendering rather than composing child widgets are Line API widgets. The base type is `ScrollView`; common subclasses include `Input`, `TextArea`, `Log`, `RichLog`, `OptionList`, `Tree`, `DataTable`, and `Markdown`.

Line API widgets implement this surface:

- `renderLine(y: number): Strip` — return the rich-js `Strip` for visual row `y`.
- `renderLines(range: Region): Strip[]` (optional) — batch form for efficient multi-line rendering.
- `getContentWidth()` / `getContentHeight()` — compute virtual content dimensions.
- `virtualSize` — reactive size that drives scrollbars and scroll clamping.
- `refreshLine(y)` / `refreshLines(yStart, count)` — invalidate specific rows without rebuilding unrelated rows.

The framework renders a Line API widget by reading `virtualSize` and `scrollOffset`, requesting visible rows via `renderLine()` or `renderLines()`, converting each `Strip` into Ink `<Text>` elements (one per consecutive style run), and arranging those rows as a column inside the widget's outer `<Box>`.
Invalidation granularity for line content is row-based: `refreshLine()` and `refreshLines()` identify which rows need to be rebuilt, instead of expressing per-character changes as child-widget composition.

## Geometry and Size

Geometry properties available via `useTextual()`:

| Property | Type | Description |
|----------|------|-------------|
| `size` | `Size` | Widget's rendered size (from Ink/Yoga layout) |
| `containerSize` | `Size` | Available space from the parent container |
| `contentSize` | `Size` | Size of the widget's content area (size minus padding/border) |
| `virtualSize` | `Size` | Total scrollable content size (may be larger than size) |
| `scrollOffset` | `Offset` | Current scroll position `{ x, y }` |

All are MobX observables. `size` and `containerSize` are updated by Ink after Yoga layout completes (via `measureElement()` or Yoga callbacks).

## Scrolling

### Scroll API

Methods available via `useTextual()` or on the widget's handler object:

| Method | Description |
|--------|-------------|
| `scrollTo(x, y, options?)` | Absolute scroll. Options: `duration`, `easing` for animated scroll. |
| `scrollRelative(dx, dy, options?)` | Relative scroll by delta |
| `scrollHome(options?)` | Scroll to top-left |
| `scrollEnd(options?)` | Scroll to bottom-right |
| `scrollUp(lines?, options?)` | Scroll up by N lines (default 1) |
| `scrollDown(lines?, options?)` | Scroll down by N lines (default 1) |
| `scrollLeft(cells?, options?)` | Scroll left by N cells |
| `scrollRight(cells?, options?)` | Scroll right by N cells |
| `scrollPageUp(options?)` | Scroll up by one page (scrollport height) |
| `scrollPageDown(options?)` | Scroll down by one page |
| `scrollToWidget(widget, options?)` | Scroll until the target widget is visible |
| `scrollToRegion(region, options?)` | Scroll until the target region is visible |
| `scrollToCenter(widget, options?)` | Scroll to center the target widget |

All scroll methods funnel through `scrollTo()`, which updates the scroll offset MobX observables.

### Anchor (auto-scroll)

- `anchor(anchor?)` marks a scrollable widget as anchored: it auto-scrolls to the bottom when content size increases.
- `releaseAnchor()` releases anchoring when the user scrolls away from the bottom.
- `isAnchored` is a MobX observable. Content changes check it and auto-scroll if true.

### Scroll guard

- `allowVerticalScroll` / `allowHorizontalScroll` return `false` when `disabled` or `loading`, preventing scroll interaction.
- Scroll action handlers (`action_scroll_home`, `action_scroll_end`, etc.) are the canonical binding entry points for keyboard scrolling.

### Scrollbar widget internal contract

Scrollbars are internal `Widget` subclasses — `Scrollbar` and `ScrollbarCorner` — instantiated by the framework as children of any widget that renders scrollbars. They are not part of the public widget catalog (see spec 10); applications never mount them directly.

#### Reactive state on a Scrollbar

| Property | Type | Description |
|----------|------|-------------|
| `windowVirtualSize` | `number` | Total virtual length of the scrollable axis (maps to parent's `virtualSize.width` or `.height`) |
| `windowSize` | `number` | Visible length along the scrollable axis (scrollport length) |
| `position` | `number` | Thumb position in 1/8-cell granularity along the axis |
| `mouseHover` | `boolean` | Whether the pointer is over the scrollbar |
| `grabbed` | `Offset \| null` | Offset within the thumb where the user grabbed, or `null` when not grabbed |

#### Styling

Scrollbar styles read from the parent's `scrollbar-*` TCSS tokens and select `active`/`hover`/`normal` variants based on `grabbed` and `mouseHover`:

| State | Variant |
|-------|---------|
| `grabbed !== null` | `active` |
| `mouseHover && !grabbed` | `hover` |
| otherwise | `normal` |

Scrollbar rendering uses the Line API: each visual row is a one-cell-wide rich-js `Strip` whose `Segment` uses a scrollbar block character (`▁▂▃▄▅▆▇█` and full-block variants) and a rich-js `Style` resolved from the parent's `scrollbar-color`, `scrollbar-background`, `scrollbar-color-hover`, and `scrollbar-color-active` tokens. `Scrollbar.renderer` is pluggable via a static `ScrollBarRender` class for custom character sets.

#### Scroll messages

Scroll intents are `Message` subclasses with `bubble: false`. They are posted by the scrollbar and handled by the scrollable parent widget:

| Message | Payload | Effect on parent |
|---------|---------|------------------|
| `ScrollUp` | — | Incremental scroll up |
| `ScrollDown` | — | Incremental scroll down |
| `ScrollLeft` | — | Incremental scroll left |
| `ScrollRight` | — | Incremental scroll right |
| `ScrollTo` | `x: number, y: number` | Absolute scroll target |

#### Mouse handling

- `MouseDown`, `MouseUp`, and `Click` on the scrollbar call `event.stop()` so they do not bubble to the parent and trigger click handling.
- On `MouseDown`, the scrollbar records `grabbed` as the pointer offset within the thumb and captures the mouse.
- While `grabbed !== null`, each `MouseMove` translates the pointer delta from screen space into virtual space (`delta * windowVirtualSize / windowSize`) and posts `ScrollTo(x, y)` to the parent.
- On `MouseUp`, the scrollbar clears `grabbed` and releases capture.

#### ScrollbarCorner

`ScrollbarCorner` is a non-interactive widget that fills the square gap where a vertical and a horizontal scrollbar meet. It is mounted only when both scrollbars are visible on the same widget.

// [LAW:one-source-of-truth] Scrollbar state mirrors the parent's `virtualSize` and `scrollOffset`; the parent's MobX observables remain the authoritative scroll state. The scrollbar posts intent (messages), it does not mutate parent scroll state directly.
// [LAW:dataflow-not-control-flow] The scrollbar always processes `MouseMove`; whether a drag emits `ScrollTo` is determined by the value of `grabbed`, not by an `if` that skips the handler.

## Disabled State

When `disabled` is `true`:

| Input type | Behavior |
|------------|----------|
| Mouse click / press | **Suppressed** — event is consumed, not bubbled |
| Mouse move / hover | **Suppressed** |
| Mouse wheel / scroll | **Allowed** — wheel scrolling traverses disabled subtrees |
| Key events | **Suppressed** — disabled widgets do not receive key events |
| Focus | **Cannot focus** — `allowFocus()` returns false when disabled |

The `-disabled` CSS class is automatically toggled (via the `toggleClass` reactive flag), so TCSS can style disabled widgets:

```css
Button:disabled {
  opacity: 0.5;
  text-style: italic;
}
```

Disabled state on a parent also suppresses input to children. The check walks ancestors — any disabled ancestor blocks the event.
Pointer hit-testing does not skip disabled widgets. If the pointer lands on a disabled widget, that widget remains the resolved target and consumes the interaction at the disabled-state boundary; the event does not fall through to an enabled ancestor or sibling behind it.
Visual dimming is driven by TCSS rules targeting `.-disabled`; the resolved rich-js `Style` typically applies dimming, opacity reduction, or muted colors to the widget's rendered content.

## Loading State

When `loading` is `true`:

- **All input suppressed** — no mouse, keyboard, or focus events.
- The `-loading` CSS class is toggled.
- A loading overlay may be rendered (framework-provided, not a public widget).
- Loading state on a parent suppresses input to children.
- Pointer hit-testing does not treat loading widgets or loading overlays as transparent. The widget under the pointer still owns the interaction and suppresses it at the loading boundary instead of allowing fallthrough to content behind it.
- The loading overlay renders rich-js content or renderables (spinner / pulsing dots) with `Style` from TCSS and swallows all input while visible.

```css
DataTable.-loading {
  opacity: 0.3;
}
```

## Tooltip

- `tooltip` reactive property (`VisualInput | null`). When set and the mouse hovers over the widget for `TOOLTIP_DELAY` milliseconds, a tooltip message is posted.
- The app renders the tooltip near the mouse position.
- Plain strings render with the ambient tooltip style; markup strings are parsed via rich-js; `Content`/`RichText` remain text visuals; rich-js renderables remain renderables inside the internal tooltip overlay widget.
- Tooltip text composition follows the same contract as upstream Textual: the ambient widget / app visual style is the base layer, and explicit content spans override it using rich-js merge semantics.
- Moving the mouse away dismisses the tooltip.

## Text Selection

Widgets expose a uniform contract for whether and how their rendered text may be selected by the user. Selection is a data-level property of the widget type — it does not branch rendering or event flow, only the outcome of a selection gesture.

### Static and reactive surface

| Property | Scope | Default | Description |
|----------|-------|---------|-------------|
| `ALLOW_SELECT` | Static on widget type | `true` | Whether the widget's rendered text may be selected by the user |
| `Screen.allowSelect` | Reactive on Screen | derived from `App.ALLOW_SELECT` | Screen-level override; when `false`, no widget on the screen is selectable regardless of its `ALLOW_SELECT` |
| `App.ALLOW_SELECT` | Static on App | `true` | Application-wide default for `Screen.allowSelect` |

Widgets whose primary interaction would conflict with a selection gesture set `ALLOW_SELECT = false`. The baseline catalog includes:

- `Button`, `Checkbox`, `RadioButton`, `Switch`
- `Tabs`, `Tab`, `Select`, `SelectionList`, `OptionList`
- `Tree`, `DataTable`
- `Footer`

```tsx
Button.ALLOW_SELECT = false;
```

### API

| Method | Description |
|--------|-------------|
| `textSelectAll()` | Request selection of all text within this widget. Delegates to `screen._selectAllInWidget(widget)` — Screen is the single enforcer. |
| `selectContainer()` | Select all text within the widget's containing context. Default gesture binding is triple-click. |

### Gesture mapping

| Gesture | Condition | Effect |
|---------|-----------|--------|
| Click + drag across widgets | Every widget traversed has `ALLOW_SELECT: true` and `Screen.allowSelect: true` | Framework tracks the selection range and emits `TextSelected` on release |
| Double-click on a widget | `ALLOW_SELECT: true` | `textSelectAll()` on that widget |
| Triple-click on a widget | `ALLOW_SELECT: true` | `selectContainer()` on that widget |

On completion, the framework posts the `TextSelected` message (payload `{ text, range }`) — see spec 03 for its dispatch semantics. The selected text is represented in-memory as rich-js `Content` spanning the selection range across widgets, so styled selections preserve their segment styles. Plain-text copy flattens via `Content.plainText`; rich clipboard paths preserve styles where the destination supports them. Selection gestures over widgets where `ALLOW_SELECT` is `false` are ignored; they do not suppress other mouse handling.

// [LAW:single-enforcer] `Screen._selectAllInWidget` is the sole enforcer of selection state for a screen. Widgets call `textSelectAll()` which delegates; they never mutate selection directly.

## Focus and Input

### Focus management

| Method / Property | Description |
|-------------------|-------------|
| `canFocus` | Static property — whether this widget type can receive focus |
| `canFocusChildren` | Static property — whether children can receive focus |
| `allowFocus()` | Runtime check — returns `false` when disabled or loading |
| `allowFocusChildren()` | Runtime check — returns `false` when disabled |
| `focus(scrollVisible?)` | Request focus. Schedules `screen.setFocus(this)`. If `scrollVisible`, scrolls the widget into view. |
| `blur()` | Release focus. Calls `screen.resetFocus(this)`. |
| `hasFocus` | MobX observable — whether this widget currently has focus |

### Key consumption

`checkConsumeKey(key, character)` is the hook widgets override to claim a key. When a widget consumes a key, the binding chain does not check that key on ancestor widgets.

Used by input-capturing widgets like `Input` and `TextArea` — they consume printable character keys so typing doesn't trigger bindings.

### Mouse capture

| Method | Description |
|--------|-------------|
| `captureMouse()` | Request mouse capture — all mouse events route to this widget regardless of position |
| `releaseMouse()` | Release capture (only if this widget currently has it) |

The app owns the single `mouseCaptured` slot. Only one widget can have capture at a time.

## Event Forwarding and Actions

### Event forwarding

`forwardEvent(event)` marks the event as forwarded then posts it to the widget. Screen uses this to dispatch mouse events to the widget under the pointer, with coordinate translation.

### Message bubbling

Messages with `bubble: true` propagate upward through the widget registry's parent chain (registered ancestors in the React tree). See spec 03 for full dispatch semantics.

### Action dispatch

| Method | Description |
|--------|-------------|
| `runAction(action, namespaces?)` | Forward to `app.runAction` with this widget as default namespace |
| `checkAction(action, params)` | Override to dynamically enable/disable bindings. Return `true` (enabled), `null` (disabled but visible), `false` (hidden). |

## Container vs Leaf

| Property | Returns | Description |
|----------|---------|-------------|
| `isContainer` | `boolean` | Whether the widget has children and participates in layout arrangement |
| `isScrollable` | `boolean` | Whether the widget can own scrollbars (has `overflow: scroll \| auto`) |

## Screen Contract

`Screen` is a widget that acts as the compose root for a view. It owns focus management, the binding chain, and modal behavior.

### Focus chain

The screen's focus chain is the ordered list of all focusable widgets in the screen's subtree:

```tsx
// Focus chain = all widgets where allowFocus() returns true, in DOM order
const chain = query('*').results()
  .filter(w => w.allowFocus())
  .sort(byDomOrder);
```

| Method | Description |
|--------|-------------|
| `focused` | MobX observable — currently focused widget (or null) |
| `focusChain` | All focusable widgets in tab order |
| `setFocus(widget, scrollVisible?)` | **Single enforcer**: posts `Blur` to previous, `Focus` to new, updates `:focus` pseudo-class, refreshes bindings |
| `resetFocus(widget)` | Move focus away from a widget that is blurring |
| `focusNext()` | Focus the next widget in the chain |
| `focusPrevious()` | Focus the previous widget in the chain |

// [LAW:single-enforcer] `setFocus` is the single enforcer of focus changes. It posts the Blur/Focus messages, updates pseudo-class state, and refreshes bindings. Widgets call `focus()` which delegates to `setFocus`. No widget directly mutates focus state.

### Binding chain

The screen constructs the binding chain from the focused widget:

1. Start at the focused widget (or the screen if nothing is focused).
2. Walk ancestors upward to the screen, then the app.
3. At each node, collect its `BindingsMap`.
4. For each binding, call `checkConsumeKey` on widgets below it in the chain — drop keys already consumed by input-capturing widgets.
5. Truncate at the first modal ancestor (inclusive).

`activeBindings` walks this chain, calls `checkAction` for each binding, drops hidden bindings (`false`), marks disabled bindings (`null`), and merges priority bindings on top. The result is used by the Footer widget.

`refreshBindings()` publishes `bindings_updated_signal` — the Footer subscribes to this to update its display.

### Modal screens

- `ModalScreen` is a screen variant with `isModal: true`.
- The modal flag truncates the binding chain — bindings behind a modal screen never fire.
- `dismiss(result?)` pops the modal from the screen stack and delivers the result to the `pushScreen` callback.

```tsx
const ConfirmDialog = observer(() => {
  const { dismiss } = useTextual();

  return (
    <ModalScreen>
      <Text>Are you sure?</Text>
      <Button onClick={() => dismiss(true)}>Yes</Button>
      <Button onClick={() => dismiss(false)}>No</Button>
    </ModalScreen>
  );
});

// Usage:
pushScreen(ConfirmDialog, (confirmed) => {
  if (confirmed) performAction();
});
```

### Screen internal composition

When a Screen mounts, the framework composes internal widgets into the screen subtree. These are not part of the user-authored JSX — they are appended by the Screen base contract. The same insertion runs every mount; which internals actually render is driven by App-level data (flags and observable widget state).

| Internal widget | Condition | Purpose |
|-----------------|-----------|---------|
| `Tooltip` | `App.showTooltips !== false` | Renders the active widget's `tooltip` text near the mouse pointer |
| `ToastRack` | `App.showNotifications !== false` | Renders active notifications as a stack of toasts |
| `LoadingOverlay` | Always mounted; visible when any widget in the screen has `loading: true` | Dims the screen and renders a loading indicator |

Screens implicitly declare a set of internal layers, appended to any user-declared `layers`, stacked above user content in this order (bottom to top):

```
layers: [ ...userLayers, '_loading', '_toastrack', '_tooltips' ]
```

- `_loading` hosts `LoadingOverlay`.
- `_toastrack` hosts `ToastRack`.
- `_tooltips` hosts `Tooltip` (topmost).

`Screen.size` is derived: `app.size - gutter.totals`. The Screen is the sole authority on its own dimensions — widgets read `Screen.size` rather than re-deriving from the app.

On mount, the Screen subscribes to `screenLayoutRefreshSignal`; any layout refresh clears the tooltip so a stale tooltip does not persist over newly positioned content.

// [LAW:one-source-of-truth] `Screen.size` is the authoritative screen dimension; widgets derive from it rather than recomputing from `App.size`.
// [LAW:dataflow-not-control-flow] Internal widgets are mounted unconditionally; their visibility is a function of reactive data (`App.showTooltips`, per-widget `loading`, notification list), not of whether the Screen chose to insert them.

### HelpPanel and KeyPanel

`HelpPanel` and `KeyPanel` are internal framework widgets that surface the active binding chain to the user. They are not part of the public widget catalog (see spec 10) — applications do not compose them directly. They exist as framework-provided affordances that can be toggled via bindings or app configuration.

| Widget | Presentation | Default trigger |
|--------|-------------|-----------------|
| `HelpPanel` | Pop-out panel listing all active bindings for the focused widget in a readable format (key, description, grouped by source) | Key binding, default `f1` |
| `KeyPanel` | Vertical scrolling table of active bindings, styled similarly to `Footer` but more detailed (intended as a persistent side panel) | App-level toggle |

Both widgets:

- Read the focused widget's `activeBindings` from the Screen's binding chain (see "Binding chain" above).
- Subscribe to `bindingsUpdatedSignal` on mount and rebuild their content whenever that signal fires.
- Apply `checkAction` results: hidden bindings (`false`) are omitted, disabled bindings (`null`) are rendered dimmed.

// [LAW:one-source-of-truth] `HelpPanel` and `KeyPanel` derive their content from `Screen.activeBindings`; they do not maintain their own binding registry.

// [LAW:one-source-of-truth] Widget state (virtual size, scroll offsets, focused widget, bindings) lives in MobX observables; derived views are rebuilt from those sources.
// [LAW:single-enforcer] Focus changes, binding resolution, mouse capture, and event forwarding are enforced at Screen (with App for cross-screen concerns). Widgets cooperate by calling the Screen API; they do not duplicate enforcement.
// [LAW:dataflow-not-control-flow] Refresh records intent in MobX observables and observer() executes the same render pipeline every cycle; scroll, layout, repaint, and style updates are data-driven transitions, not ad-hoc branches.
