# Testability and Automation Surfaces

## Overview

textual-js provides a testing API (`runTest` + `Pilot`) that layers over **ink-testing-library** to give tests a high-level interface for interacting with a running app. Tests exercise the full message dispatch pipeline — the same code path that handles live user input — so test behavior mirrors production behavior.

// [LAW:one-source-of-truth] `Pilot` is the single automation surface shared by tests and any automation tooling. New automation needs should extend Pilot, not add a parallel surface.

// [LAW:dataflow-not-control-flow] Pilot drives deterministic message sequences through the same dispatch pipeline as live interaction. Tests don't mock the dispatch path.

## Test Stack

```
┌─────────────────────────────────────────────────┐
│ Test file (.test.tsx)                           │
│   vitest's it() / describe() / expect()         │
├─────────────────────────────────────────────────┤
│ Framework test harness                          │
│   runTest(AppComponent, options?) → Pilot       │
├─────────────────────────────────────────────────┤
│ ink-testing-library                             │
│   render(component) → { stdin, lastFrame, ... } │
├─────────────────────────────────────────────────┤
│ Ink (headless mode)                             │
│   React reconciler + Yoga, no real terminal     │
└─────────────────────────────────────────────────┘
```

- Tests use Vitest (`vitest run`) as the test runner.
- `runTest` wraps ink-testing-library's `render()` with framework context (MobX stores, widget registry, message dispatch).
- `Pilot` converts high-level actions (press, click, hover) into raw stdin bytes or synthesized messages.

## runTest Contract

```tsx
async function runTest<T>(
  AppComponent: ComponentType,
  options?: RunTestOptions,
): Promise<TestHandle<T>>;

interface RunTestOptions {
  size?: { width: number; height: number };   // Default: { width: 80, height: 24 }
  props?: Record<string, unknown>;              // Props to pass to AppComponent
  messageHook?: (message: Message) => void;     // Invoked for every dispatched message
  transients?: {
    notifications?: boolean;                    // Default: false
    tooltips?: boolean;                         // Default: false
  };
  mockClipboard?: boolean;                      // Default: true
}

interface TestHandle<T> {
  pilot: Pilot;                     // Interaction surface
  app: AppInstance;                 // Reference to the running app
  lastFrame(): string;              // Raw ANSI-encoded last rendered frame
  queryText(selector: string): string | null; // Text content of a queried widget
  queryContent(selector: string): Content | null; // Rendered rich-js Content of a queried widget
  unmount(): void;                  // Tear down the app
  result: T | undefined;            // Value from app.exit(result)
}
```

When `mockClipboard` is true, cut/copy/paste use an in-memory clipboard that stores both plain-text and rich-js `Content` representations. Paste delivers whichever representation matches the consuming widget: plain text for `Input`/`TextArea`, rich content for widgets such as `RichLog`. **Intentional divergence**: this dual-representation clipboard is a deliberate textual-js design choice, not parity with upstream Textual (which only handles plain text clipboard). The richer clipboard enables copy/paste of styled content between framework widgets without round-tripping through plain text.

### Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Deterministic size** | Forces a fixed terminal size (default 80×24) so layout is reproducible |
| **Headless rendering** | Uses ink-testing-library — no real terminal, no ANSI to stdout |
| **Disabled transients** | Notifications and tooltips are disabled before the first render by default so tests don't assert on timing-dependent UI or accumulate transient state from mount-time side effects |
| **First-screen ready** | Waits for the first screen to be fully mounted (Compose + Mount dispatched) before yielding Pilot |
| **Clean teardown** | On `unmount()`, shuts down the app and re-throws any captured exception so test frameworks see the original failure |
| **Mocked clipboard** | Clipboard operations (cut/copy/paste) use an in-memory mock by default |

### Usage pattern

```tsx
import { describe, it, expect } from 'vitest';
import { runTest } from 'textual-js/testing';
import { MyApp } from './my-app';

describe('MyApp', () => {
  it('opens a dialog when save is pressed', async () => {
    const { pilot, queryText, unmount } = await runTest(MyApp);

    await pilot.press('ctrl+s');

    expect(queryText('#dialog-title')).toBe('Save changes?');

    unmount();
  });
});
```

## Pilot Interface

`Pilot` provides async interaction methods over a running app. All methods are async and `await` the screen to settle before returning.

### Keyboard

| Method | Description |
|--------|-------------|
| `press(...keys: string[])` | Send one or more keys (canonical names). Waits for screen to settle between each. |
| `type(text: string)` | Send each character as a key event (for text entry into Input/TextArea). |

Keys use canonical names from spec 06: `"ctrl+s"`, `"shift+tab"`, `"enter"`, `"escape"`, `"up"`, `"down"`, `"question_mark"`, etc.

```tsx
await pilot.press('tab');           // Focus next widget
await pilot.press('ctrl+c', 'ctrl+v'); // Copy then paste
await pilot.type('Hello, world!');  // Type text into focused input
```

`pilot.type(text)` sends plain characters only. No markup parsing occurs: the characters reach the focused widget's `checkConsumeKey` logic and are inserted as-is. To inject styled content, use the widget's API directly (for example `textArea.insertTextAtCursor(...)` or `richLog.write(content)`).

### Pointer

| Method | Description |
|--------|-------------|
| `mouseDown(options?)` | Synthesize mouse-down event |
| `mouseUp(options?)` | Synthesize mouse-up event |
| `click(options?)` | Full down → up → click sequence |
| `doubleClick(options?)` | Two click sequences within double-click threshold |
| `tripleClick(options?)` | Three click sequences (for triple-click selection) |
| `hover(options?)` | Pause for mouse to "settle", then synthesize mouse-move |

### Pointer options

```tsx
interface PointerOptions {
  widget?: Widget | ComponentType | string;  // Target: instance, type, or CSS selector
  offset?: { x: number; y: number };          // Offset within the widget (or from screen origin)
  button?: 'left' | 'right' | 'middle';      // Default: 'left'
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}
```

```tsx
await pilot.click({ widget: '#save-button' });
await pilot.click({ widget: Button, offset: { x: 5, y: 1 } });
await pilot.click({ offset: { x: 40, y: 12 }, button: 'right' });
await pilot.hover({ widget: '.tooltip-trigger' });
```

### Return semantics

Pointer helpers return `true` when no widget selector was specified, or when the widget under the resolved coordinate matches the requested target. They return `false` if the target is obscured by another widget. This lets tests assert "the click actually landed on the intended widget":

```tsx
// Verify the click reached the intended widget (not intercepted by an overlay)
const hit = await pilot.click({ widget: '#save-button' });
expect(hit).toBe(true);
```

### Terminal

| Method | Description |
|--------|-------------|
| `resizeTerminal(width, height)` | Update terminal size, post `Resize` event, trigger re-layout |

```tsx
await pilot.resizeTerminal(120, 30);
expect(queryText('Header')).toContain('Wide mode');
```

### Settling and timing

| Method | Description |
|--------|-------------|
| `pause(delay?: number)` | Wait for screen to drain. If `delay` is given, also sleep that many ms (for hover delays, animation waits). |
| `waitForAnimation()` | Wait for currently-active animations to complete |
| `waitForScheduledAnimations()` | Drain screen, wait for animator to complete all scheduled animations, drain again |

```tsx
await pilot.click({ widget: '#expand' });
await pilot.waitForScheduledAnimations();
// Animation complete, widget is now in expanded state
```

### Graceful shutdown

| Method | Description |
|--------|-------------|
| `exit(result?)` | Drain screen, wait for idle, call `app.exit(result)`. Returns the result value. |

### Errors

| Error | When |
|-------|------|
| `OutOfBounds` | Raised by any pointer helper when the resolved coordinate is outside the visible screen region |
| `WaitForScreenTimeout` | Raised when queued callbacks never drain, indicating a stall (infinite loop, deadlock) |
| `PilotTargetNotFound` | Raised when a widget selector matches zero widgets |

## Query Helpers

`TestHandle` exposes query helpers for making assertions about rendered state:

| Method | Description |
|--------|-------------|
| `queryText(selector)` | Returns the queried widget's plain text (`Content.plainText` semantics; styles stripped) or `null` |
| `queryContent(selector)` | Returns the queried widget's rendered rich-js `Content` (styles preserved) or `null` |
| `queryExists(selector)` | Returns `true` if a widget matches the selector |
| `queryAll(selector)` | Returns all matching widgets |
| `lastFrame()` | Returns the raw ANSI-encoded last rendered frame (for snapshot tests and ANSI/style assertions) |
| `getStyles(selector)` | Returns the widget's resolved style bundle: `{ box, text, style, components }` |

```tsx
// Assert widget existence and content
expect(queryExists('#error-banner')).toBe(true);
expect(queryText('#error-banner')).toContain('Failed to save');

// Assert styled content
const content = queryContent('#error-banner');
expect(content?.plainText).toContain('Failed to save');

// Assert computed styling
const styles = getStyles('#error-banner');
expect(styles.style.backgroundColor).toEqual(Color.parse('$error'));

// Snapshot test of the full rendered frame
expect(lastFrame()).toMatchSnapshot();
```

Snapshot tests using `lastFrame()` capture the exact ANSI output, which is sensitive to rich-js `Color.toAnsi()` and the active output-filter pipeline. For stable snapshots across environments, keep terminal color depth deterministic in the test harness or install `NoColor` in the app's filter list for ASCII-only snapshots. Prefer `queryContent()` and `getStyles()` for structural assertions that should not depend on terminal escape bytes.

When the behavior under test is styled terminal output, `lastFrame()` is the authoritative seam. Style-preservation assertions should inspect the ANSI frame (or a deterministic parsed derivative of it), not whether an internal render helper was invoked.

Gate 4 follows the same rule: the visual comparison pipeline compares styled output, not only stripped text. Missing snapshots, character diffs, foreground/background color diffs, and text-attribute diffs all fail the gate.

## Message Observation

`messageHook` option on `runTest` lets tests observe every message dispatched in the app without subclassing:

```tsx
const messages: Message[] = [];
const { pilot } = await runTest(MyApp, {
  messageHook: (msg) => messages.push(msg),
});

await pilot.press('ctrl+s');

// Assert that Save.Requested was dispatched
expect(messages.some(m => m instanceof Save.Requested)).toBe(true);
```

This is the single, documented seam for observing messages during a test.

## Transient UI Policy In Tests

`runTest()` disables transient UI by default via `options.transients`, with both `notifications` and `tooltips` defaulting to `false`.

- When `transients.tooltips` is `false`, hover may still update pointer pseudo-class state, but no tooltip overlay is scheduled or shown.
- When `transients.notifications` is `false`, notifications raised during compose, mount, effects, actions, or workers do not accumulate in the app notification store and no toast UI is shown.
- Transient suppression takes effect before the first render. A notification or tooltip emitted during initial mount must not leak into test state unless the corresponding transient opt-in is explicitly enabled.

## Awaitable Coordination Helpers

### `AwaitComplete`

Wraps one or more promises. Returned by APIs that trigger asynchronous work (animations, workers, data loading).

| Property / Method | Description |
|-------------------|-------------|
| `isDone` | Whether all wrapped promises have settled |
| `exception` | First rejected promise's reason (or `null`) |
| `then(onFulfilled, onRejected)` | Thenable interface — can be `await`ed |

```tsx
// Wait for a mount operation to complete
const mountPromise = container.mount(new MyWidget());
expect(mountPromise.isDone).toBe(false);
await mountPromise;
expect(mountPromise.isDone).toBe(true);
```

### `AwaitRemove`

Returned by widget/screen removal APIs.

| Property / Method | Description |
|-------------------|-------------|
| `then(onFulfilled)` | Thenable — resolves when removal completes |
| `onComplete(callback)` | Register a post-remove callback |

```tsx
const removePromise = widget.remove();
removePromise.onComplete(() => {
  console.log('Widget unmounted');
});
await removePromise;
```

// [LAW:verifiable-goals] These awaitable helpers create machine-checkable completion boundaries for UI state transitions, which lets pilot-driven tests assert "the mutation has finished" without polling.

## Vitest Integration

### Setup

```tsx
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.{ts,tsx}'],
  },
});
```

### Test helpers

```tsx
// test-helpers.ts
import { runTest } from 'textual-js/testing';
import { afterEach } from 'vitest';

let activeHandle: TestHandle | null = null;

export async function testApp<T>(AppComponent, options?) {
  activeHandle = await runTest<T>(AppComponent, options);
  return activeHandle;
}

afterEach(() => {
  activeHandle?.unmount();
  activeHandle = null;
});
```

### Common test patterns

```tsx
// Lifecycle test
it('mounts with default screen', async () => {
  const { queryExists } = await testApp(MyApp);
  expect(queryExists('DefaultScreen')).toBe(true);
});

// Binding test
it('Ctrl+S triggers save action', async () => {
  const onSave = vi.fn();
  const { pilot } = await testApp(MyApp, { props: { onSave } });
  await pilot.press('ctrl+s');
  expect(onSave).toHaveBeenCalled();
});

// Focus test
it('Tab cycles through focusable widgets', async () => {
  const { pilot, queryText } = await testApp(MyApp);
  await pilot.press('tab');
  expect(queryText(':focus')).toBe('First Button');
  await pilot.press('tab');
  expect(queryText(':focus')).toBe('Second Button');
});

// Text entry test
it('Input widget accepts text', async () => {
  const { pilot, queryText } = await testApp(MyApp);
  await pilot.click({ widget: '#name-input' });
  await pilot.type('Alice');
  expect(queryText('#name-input')).toBe('Alice');
});

// Validation test
it('rejects invalid email', async () => {
  const { pilot, queryExists } = await testApp(MyApp);
  await pilot.click({ widget: '#email' });
  await pilot.type('not-an-email');
  await pilot.press('tab');  // Trigger blur-based validation
  expect(queryExists('#email.-invalid')).toBe(true);
});

// Worker test
it('loads data asynchronously', async () => {
  const { pilot, queryText, app } = await testApp(MyApp);
  await pilot.click({ widget: '#load' });
  expect(queryText('#status')).toBe('Loading...');
  await app.workerManager.waitForComplete();
  expect(queryText('#status')).toBe('Loaded');
});

// Animation test
it('fades out before unmount', async () => {
  const { pilot, queryExists } = await testApp(MyApp);
  await pilot.click({ widget: '#close' });
  // Fade-out animation in progress
  await pilot.waitForScheduledAnimations();
  expect(queryExists('#panel')).toBe(false);
});
```

## Determinism Expectations for Automation

| Guarantee | Mechanism |
|-----------|-----------|
| **First screen mounted before test body** | `runTest` awaits initial Compose/Mount before returning Pilot |
| **Message dispatch order identical to live** | Same pipeline (queue + microtask + dispatch) in test and production |
| **Idle-driven transitions observable** | `pilot.pause()`, `pilot.waitForAnimation()`, `pilot.waitForScheduledAnimations()` |
| **Layout responds to size changes** | `pilot.resizeTerminal()` triggers the same Resize message as live SIGWINCH |
| **Messages observable without subclassing** | `messageHook` option on `runTest` |
| **Mocked clipboard** | Cut/copy/paste use in-memory mock; no interaction with OS clipboard |
| **Mocked timers (optional)** | Tests can use Vitest's fake timers for deterministic time-based behavior |

## Not a Browser Testing Library

textual-js does NOT use React Testing Library (`@testing-library/react`) despite being React-based. RTL targets the browser DOM (`document.querySelector`, DOM events, user-event synthesis) which has no equivalent in Ink's terminal environment.

Instead, textual-js uses:
- **ink-testing-library** for rendering and stdin injection (the foundation)
- **Pilot** (framework-provided) for high-level interaction (keys, clicks, hover, settling)
- **Query helpers** on `TestHandle` that query the framework's widget registry (not the React tree)

This distinction matters: `queryText('#save')` in textual-js queries the widget registry using TCSS selectors, not the DOM. The React tree does not exist in a browser — it exists in memory and renders to terminal cells.
