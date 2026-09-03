// [LAW:effects-at-boundaries] Opening a URL is an OS effect, taken apart so that
// only the last step touches the OS: `parseOpenableUrl` decides whether a string
// may be handed over at all, `urlOpenCommand` decides which program opens it,
// `runUrlOpenCommand` performs one such command, and `spawnUrlOpener` is those
// three composed. Widgets never reach here — they ask App, which owns the
// capability.

import { spawn } from "node:child_process";

// A URL is externally-sourced data, so an opener may fail long after it
// returns. Rejecting says so; a synchronous opener that cannot fail may still
// return nothing.
export type UrlOpener = (url: string) => void | Promise<void>;

export class UnsupportedUrlScheme extends Error {}

// `open`, `explorer.exe` and `xdg-open` launch whatever their argument resolves
// to, not only web pages — a bare path, a UNC share, a local executable. A
// Link's url is whatever an app author or a rendered Markdown document supplies,
// so the platform opener refuses anything that is not a web address.
//
// Textual hands everything to `webbrowser.open`; this is a deliberate
// divergence toward a safe default. A host that genuinely wants `file:` links
// installs its own opener through `AppOptions.openUrl`.
const OPENABLE_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);

// [LAW:parse-dont-validate] The checkpoint: a raw string goes in and a URL the
// platform opener is willing to launch comes out. `urlOpenCommand` below takes
// that URL rather than a string, so a command cannot be built from an unchecked
// value — there is nothing left downstream to re-check.
export function parseOpenableUrl(raw: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    // Bare and UNC paths land here: they are not URLs at all.
    throw new UnsupportedUrlScheme(`Not a URL: ${JSON.stringify(raw)}`);
  }

  if (!OPENABLE_SCHEMES.has(parsed.protocol)) {
    throw new UnsupportedUrlScheme(
      `Refusing to open a ${parsed.protocol} URL; expected one of ${[...OPENABLE_SCHEMES].join(", ")}`,
    );
  }

  return parsed;
}

export interface UrlOpenCommand {
  command: string;
  args: readonly string[];
  // Whether a non-zero exit means the launch failed. `xdg-open` reports "no
  // $DISPLAY" that way — the usual failure for a TUI over SSH — while
  // explorer.exe exits 1 even on success, so its code carries no information.
  exitCodeReportsFailure: boolean;
}

// [LAW:dataflow-not-control-flow] Every platform runs the same shape of
// operation — one command, its arguments, and how it reports failure — so the
// platform selects a *value* rather than a branch that decides whether an
// operation happens at all.
//
// No entry may route the URL through a shell. `cmd /c start "" <url>` would:
// the destination process is cmd.exe, which re-parses the line for its own
// metacharacters, so a `&` in any ordinary query string turns the URL into a
// command. explorer.exe takes the URL as one argument and launches the default
// handler, which leaves nothing to escape.
const URL_OPEN_COMMANDS: Readonly<Record<string, Omit<UrlOpenCommand, "args">>> = {
  darwin: { command: "open", exitCodeReportsFailure: true },
  win32: { command: "explorer.exe", exitCodeReportsFailure: false },
};

const XDG_OPEN: Omit<UrlOpenCommand, "args"> = {
  command: "xdg-open",
  exitCodeReportsFailure: true,
};

export function urlOpenCommand(platform: string, url: URL): UrlOpenCommand {
  return { ...(URL_OPEN_COMMANDS[platform] ?? XDG_OPEN), args: [url.href] };
}

// [LAW:no-silent-failure] Both ways a launcher fails — never starting, or
// starting and then giving up — reject. Rejecting rather than throwing from an
// unlistened `error` event is what keeps a missing binary from taking the whole
// TUI down over a hyperlink; App turns the rejection into something the user
// reads.
//
// Split from `spawnUrlOpener` so this outcome handling can be driven against a
// command chosen by the test rather than by `process.platform`, which on a
// developer's machine would mean actually opening a browser.
export function runUrlOpenCommand({
  command,
  args,
  exitCodeReportsFailure,
}: UrlOpenCommand): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], { detached: true, stdio: "ignore" });
    child.unref();

    child.once("error", reject);
    child.once("exit", (code) => {
      if (exitCodeReportsFailure && code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

// `async` so a refused scheme rejects rather than throwing out of the call: the
// parse is the one step here that fails synchronously.
export const spawnUrlOpener: UrlOpener = async (url) =>
  runUrlOpenCommand(urlOpenCommand(process.platform, parseOpenableUrl(url)));
