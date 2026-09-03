// [LAW:effects-at-boundaries] Opening a URL is an OS effect. This module splits
// it in two: `urlOpenCommand` is the pure decision (which program opens a URL on
// which platform), and `spawnUrlOpener` is the single place that performs it.
// Widgets never reach here directly — they ask App, which owns the capability.

import { spawn } from "node:child_process";

/** Performs the platform's "show this URL to the user" action. */
export type UrlOpener = (url: string) => void;

export interface UrlOpenCommand {
  command: string;
  args: readonly string[];
}

// [LAW:dataflow-not-control-flow] Every platform runs the same shape of
// operation — one command with arguments — so the platform selects a *value*
// rather than a branch that decides whether an operation happens at all.
const URL_OPEN_COMMANDS: Readonly<Record<string, UrlOpenCommand>> = {
  darwin: { command: "open", args: [] },
  // `start` is a cmd.exe builtin, and its first quoted argument is the window
  // title — the empty string keeps a URL from being consumed as one.
  win32: { command: "cmd", args: ["/c", "start", ""] },
};

const XDG_OPEN: UrlOpenCommand = { command: "xdg-open", args: [] };

export function urlOpenCommand(platform: string, url: string): UrlOpenCommand {
  const base = URL_OPEN_COMMANDS[platform] ?? XDG_OPEN;
  return { command: base.command, args: [...base.args, url] };
}

// [LAW:no-silent-failure] The child is spawned without an `error` listener on
// purpose: a missing opener raises an unhandled error rather than a link that
// quietly does nothing when clicked.
export const spawnUrlOpener: UrlOpener = (url) => {
  const { command, args } = urlOpenCommand(process.platform, url);
  const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
  child.unref();
};
