// [LAW:effects-at-boundaries] Opening a URL is an OS effect. This module splits
// it in two: `urlOpenCommand` is the pure decision (which program opens a URL on
// which platform), and `spawnUrlOpener` is the single place that performs it.
// Widgets never reach here directly — they ask App, which owns the capability.

import { spawn } from "node:child_process";

// A URL is externally-sourced data, so an opener may fail long after it
// returns. Rejecting says so; a synchronous opener that cannot fail may still
// return nothing.
export type UrlOpener = (url: string) => void | Promise<void>;

export interface UrlOpenCommand {
  command: string;
  args: readonly string[];
}

// [LAW:dataflow-not-control-flow] Every platform runs the same shape of
// operation — one command with arguments — so the platform selects a *value*
// rather than a branch that decides whether an operation happens at all.
//
// No entry may route the URL through a shell. `cmd /c start "" <url>` would:
// the destination process is cmd.exe, which re-parses the line for its own
// metacharacters, so a `&` in any ordinary query string turns the URL into a
// command. explorer.exe takes the URL as one argument and launches the default
// handler, which leaves nothing to escape.
const URL_OPEN_COMMANDS: Readonly<Record<string, UrlOpenCommand>> = {
  darwin: { command: "open", args: [] },
  win32: { command: "explorer.exe", args: [] },
};

const XDG_OPEN: UrlOpenCommand = { command: "xdg-open", args: [] };

export function urlOpenCommand(platform: string, url: string): UrlOpenCommand {
  const base = URL_OPEN_COMMANDS[platform] ?? XDG_OPEN;
  return { command: base.command, args: [...base.args, url] };
}

// [LAW:no-silent-failure] A missing opener (`xdg-open` is absent on plenty of
// minimal systems) rejects rather than disappearing. It rejects rather than
// throwing from an unlistened `error` event, which would take the whole TUI
// down over a hyperlink; App turns the rejection into something the user reads.
export const spawnUrlOpener: UrlOpener = (url) =>
  new Promise<void>((resolve, reject) => {
    const { command, args } = urlOpenCommand(process.platform, url);
    const child = spawn(command, [...args], { detached: true, stdio: "ignore" });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
