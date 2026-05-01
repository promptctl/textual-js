import { pathToFileURL } from "node:url";
import React from "react";
import { Box, Text, render } from "ink";

import {
  App,
  Button,
  ButtonPressed,
  Checkbox,
  Footer,
  Input,
  InputChanged,
  ProgressBar,
  RadioButton,
  RadioSet,
  RadioSetChanged,
  Rule,
  Sparkline,
  Static,
  Switch,
  SwitchChanged,
  ToggleChanged,
  WidgetHost,
  useTextual,
  type Screen,
  type SystemCommand,
} from "../src/index.js";

interface DemoController {
  notify(): void;
  advanceProgress(): void;
  resetProgress(): void;
  clearLog(): void;
  quit(): void;
}

interface KitchenSinkOptions {
  exitProcess?: boolean;
}

const inactiveController: DemoController = {
  notify: () => undefined,
  advanceProgress: () => undefined,
  resetProgress: () => undefined,
  clearLog: () => undefined,
  quit: () => undefined,
};

let controller: DemoController = inactiveController;

const DEMO_CSS = `
  Static {
    color: #e0e0e0;
  }

  Button {
    min-width: 16;
  }

  ProgressBar {
    width: 46;
  }

  Sparkline {
    width: 32;
    height: 3;
  }

  Rule {
    color: #5fa8d3;
  }
`;

class KitchenSinkApp extends App<void> {
  private readonly exitProcess: boolean;

  constructor(options: KitchenSinkOptions = {}) {
    super({
      title: "textual-js kitchen sink",
      css: DEMO_CSS,
      showTooltips: true,
      bindings: [
        { key: "f1", action: "demo_notify", description: "Notify" },
        { key: "f2", action: "demo_progress", description: "Progress" },
        { key: "f3", action: "demo_reset", description: "Reset" },
        { key: "f4", action: "demo_clear_log", description: "Clear log" },
        { key: "q", action: "app.quit", description: "Quit", priority: true },
      ],
      actions: {
        action_demo_notify: () => controller.notify(),
        action_demo_progress: () => controller.advanceProgress(),
        action_demo_reset: () => controller.resetProgress(),
        action_demo_clear_log: () => controller.clearLog(),
        action_quit: () => controller.quit(),
      },
    });
    this.exitProcess = options.exitProcess ?? false;
  }

  protected override compose(): React.ReactNode {
    return <KitchenSink />;
  }

  override getSystemCommands(_screen: Screen | null): Iterable<SystemCommand> {
    // [LAW:one-source-of-truth] Command palette entries call the same demo
    // controller used by key bindings, so palette and keyboard cannot drift.
    return [
      {
        name: "Demo: Notify",
        text: "notify",
        helpText: "Post a notification toast",
        discover: true,
        callback: () => controller.notify(),
      },
      {
        name: "Demo: Advance progress",
        text: "progress",
        helpText: "Increment the progress bar and sparkline sample",
        discover: true,
        callback: () => controller.advanceProgress(),
      },
      {
        name: "Demo: Reset progress",
        text: "reset",
        helpText: "Reset the progress bar and event log",
        discover: true,
        callback: () => controller.resetProgress(),
      },
      {
        name: "Demo: Clear log",
        text: "clear",
        helpText: "Clear the event log panel",
        discover: true,
        callback: () => controller.clearLog(),
      },
      {
        name: "Demo: Quit",
        text: "quit",
        helpText: "Exit the demo",
        discover: true,
        callback: () => controller.quit(),
      },
    ];
  }

  finish(): void {
    this.exit();
    if (this.exitProcess) {
      process.exit(0);
    }
  }
}

export function createKitchenSinkApp(options: KitchenSinkOptions = {}): KitchenSinkApp {
  return new KitchenSinkApp(options);
}

function KitchenSink(): React.JSX.Element {
  const app = useTextual() as KitchenSinkApp;
  const [presses, setPresses] = React.useState(0);
  const [progress, setProgress] = React.useState(25);
  const [sparklineData, setSparklineData] = React.useState([2, 5, 3, 8, 4, 9, 7, 11, 6, 12, 10, 15]);
  const [inputValue, setInputValue] = React.useState("edit me");
  const [switchOn, setSwitchOn] = React.useState(false);
  const [checkboxOn, setCheckboxOn] = React.useState(true);
  const [radioOn, setRadioOn] = React.useState(false);
  const [radioChoice, setRadioChoice] = React.useState("Build");
  const [log, setLog] = React.useState<string[]>(["Tab moves focus. Enter/Space activates focused widgets. Ctrl+P opens commands."]);

  const appendLog = React.useCallback((entry: string) => {
    setLog((current) => [entry, ...current].slice(0, 7));
  }, []);

  const advanceProgress = React.useCallback(() => {
    setProgress((current) => {
      const next = current >= 100 ? 0 : Math.min(100, current + 10);
      appendLog(`Progress advanced to ${next}%`);
      return next;
    });
    setSparklineData((current) => [...current.slice(1), ((current.at(-1) ?? 0) + 7) % 18 + 2]);
  }, [appendLog]);

  const resetProgress = React.useCallback(() => {
    setProgress(0);
    setSparklineData([2, 5, 3, 8, 4, 9, 7, 11, 6, 12, 10, 15]);
    setLog(["Progress reset"]);
  }, []);

  const notify = React.useCallback(() => {
    app.notify(`Demo notification ${presses + 1}`, { title: "Kitchen sink", severity: "information", timeout: 2500 });
    appendLog("Notification posted");
  }, [app, appendLog, presses]);

  React.useEffect(() => {
    // [LAW:single-enforcer] App bindings and command palette callbacks enter
    // through this controller instead of each key path mutating state itself.
    controller = {
      notify,
      advanceProgress,
      resetProgress,
      clearLog: () => setLog(["Log cleared"]),
      quit: () => app.finish(),
    };

    return () => {
      controller = inactiveController;
    };
  }, [advanceProgress, app, notify, resetProgress]);

  return (
    <WidgetHost
      typeName="KitchenSinkDemo"
      handlers={{
        onButtonPressed: (message) => {
          const id = ((message as ButtonPressed).sender as { id?: string } | null)?.id ?? "button";
          setPresses((current) => current + 1);
          appendLog(`${id} pressed`);
        },
        onSwitchChanged: (message) => {
          const next = (message as SwitchChanged).value;
          setSwitchOn(next);
          appendLog(`Switch changed to ${next ? "on" : "off"}`);
        },
        onToggleChanged: (message) => {
          const sender = (message as ToggleChanged).sender as { typeName?: string } | null;
          const next = (message as ToggleChanged).value;
          if (sender?.typeName === "Checkbox") {
            setCheckboxOn(next);
            appendLog(`Checkbox changed to ${next ? "checked" : "unchecked"}`);
          } else if (sender?.typeName === "RadioButton") {
            setRadioOn(next);
            appendLog(`Standalone radio changed to ${next ? "selected" : "unselected"}`);
          }
        },
        onRadioSetChanged: (message) => {
          const changed = message as RadioSetChanged;
          setRadioChoice(changed.pressed.label.plain);
          appendLog(`RadioSet selected ${changed.pressed.label.plain}`);
        },
        onInputChanged: (message) => {
          const changed = message as InputChanged;
          setInputValue(changed.value);
          appendLog(`Input changed: ${changed.value}`);
        },
      }}
    >
      <Box flexDirection="column" width="100%" paddingX={1}>
        <Static content="textual-js kitchen sink" />
        <Static content="F1 notify | F2 progress | F3 reset | F4 clear log | Ctrl+P palette | Tab/Shift+Tab focus | q quit" />
        <Rule lineStyle="heavy" />

        <Box flexDirection="row" columnGap={4}>
          <Box flexDirection="column" width={38}>
            <Static content="Controls" />
            <Button id="primary-button" label={`Pressed ${presses}`} variant="primary" />
            <Button id="success-button" label="Success button" variant="success" />
            <Button id="disabled-button" label="Disabled button" disabled />
            <Switch id="demo-switch" value={switchOn} />
            <Checkbox id="demo-checkbox" label="Checkbox state" value={checkboxOn} />
            <RadioButton id="demo-radio" label="Standalone radio" value={radioOn} />
          </Box>

          <Box flexDirection="column" width={40}>
            <Static content="Input and selection" />
            <Input id="demo-input" value={inputValue} />
            <Text>Current input: {inputValue}</Text>
            <RadioSet
              id="demo-radio-set"
              buttons={[
                { label: "Build", value: radioChoice === "Build" },
                { label: "Test", value: radioChoice === "Test" },
                { label: "Ship", value: radioChoice === "Ship" },
              ]}
            />
            <Text>Selected: {radioChoice}</Text>
          </Box>
        </Box>

        <Rule />
        <Box flexDirection="row" columnGap={4}>
          <Box flexDirection="column" width={50}>
            <Static content={`Progress: ${progress}%`} />
            <ProgressBar total={100} progress={progress} />
            <Static content="Sparkline sample" />
            <Sparkline data={sparklineData} />
          </Box>
          <Box flexDirection="column" width={45}>
            <Static content="Event log" />
            {log.map((entry, index) => (
              <Text key={`${index}:${entry}`}>{entry}</Text>
            ))}
          </Box>
        </Box>

        <Footer />
      </Box>
    </WidgetHost>
  );
}

export async function runKitchenSinkSmoke(): Promise<void> {
  const app = createKitchenSinkApp({ exitProcess: false });
  const session = await app.runTest({ size: { width: 100, height: 30 } });

  assertFrameContains(session.lastFrame(), "textual-js kitchen sink");
  assertFrameContains(session.lastFrame(), "Controls");

  await session.pilot.press("f2");
  assertFrameContains(session.lastFrame(), "Progress: 35%");

  await session.pilot.press("ctrl+p");
  assertFrameContains(session.lastFrame(), "Demo: Notify");

  await session.pilot.press("escape");
  session.unmount();
  session.cleanup();
}

function assertFrameContains(frame: string | undefined, expected: string): void {
  if (frame?.includes(expected) !== true) {
    throw new Error(`Demo smoke expected frame to contain ${JSON.stringify(expected)}`);
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--smoke")) {
    await runKitchenSinkSmoke();
    process.stdout.write("kitchen-sink smoke: OK\n");
    return;
  }

  const app = createKitchenSinkApp({ exitProcess: true });
  render(app.render());
}

const invokedPath = process.argv[1] === undefined ? "" : pathToFileURL(process.argv[1]).href;
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`kitchen-sink fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
}
