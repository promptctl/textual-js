/**
 * Real-terminal runner for textual-js fixtures.
 *
 * Invoked inside an xterm that is running inside Xvfb inside Docker. Loads
 * the fixture component, wraps it in TextualApp with its exported appProps,
 * and calls Ink's real `render()` — which writes to the real stdout TTY.
 *
 * The render stays mounted until the orchestrator kills the process from
 * outside after the screenshot is taken.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import React from "react";
import { render } from "ink";

import { App, TextualApp, type TextualAppProps } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");

async function main(): Promise<void> {
  const name = process.argv[2];

  if (name === undefined) {
    process.stderr.write("usage: runner_js.tsx <fixture-name>\n");
    process.exit(2);
  }

  const fixturePath = join(FIXTURES_DIR, `${name}.tsx`);
  const fixtureModule: {
    default?: React.ComponentType;
    appProps?: Partial<TextualAppProps>;
  } = await import(fixturePath);

  if (typeof fixtureModule.default !== "function") {
    // Without this check a missing default export surfaces as a generic
    // "Component is undefined" inside Ink, with no fixture-name context.
    throw new Error(`fixture ${name} has no default React component export`);
  }
  const Component = fixtureModule.default;
  const appProps = fixtureModule.appProps ?? {};
  // [LAW:one-source-of-truth] App is the single canonical runtime authority;
  // the runner constructs one and hands it to TextualApp.
  const app = new App();

  render(
    React.createElement(
      TextualApp,
      { ...appProps, app },
      React.createElement(Component),
    ),
  );
}

main().catch((error) => {
  process.stderr.write(`runner_js fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exit(1);
});
