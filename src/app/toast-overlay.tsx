import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content } from "../content/content.js";
import { renderContent } from "../content/render.js";
import { useTextual } from "../framework/context.js";
import type { Notification, NotificationSeverity } from "../services/notifications.js";

// Textual's ToastRack is `width: 1fr; overflow-y: scroll`, and a scrollbar gutter
// costs two columns whether or not a scrollbar is drawn. Every other number here
// is measured against that reduced width, so it is the first thing derived.
const RACK_SCROLLBAR_GUTTER = 2;

// `Toast { width: 60; max-width: 50% }` — 60 is the ceiling, half the rack is the
// binding constraint at any terminal narrower than 124 columns.
const TOAST_MAX_WIDTH = 60;

// `Toast { padding: 1 1 }` plus the single column of `border-left: outer`.
const TOAST_BORDER_COLUMNS = 1;
const TOAST_PADDING_COLUMNS = 1;
const TOAST_PADDING_ROWS = 1;

// `ToastRack { margin-bottom: 1 }` and `Toast { margin-top: 1 }`.
const RACK_BOTTOM_MARGIN = 1;
const TOAST_TOP_MARGIN = 1;

const TOAST_BORDER_GLYPH = "▌";

// Textual styles a toast from two palette entries per severity: the border takes
// the severity colour itself, the title takes that colour's contrast text. The
// severity names are Textual's; the token names are the generated palette's.
// [LAW:one-type-per-behavior] All three severities are one toast rendered from a
// different pair of tokens, so severity crosses the seam as data.
const SEVERITY_PALETTE_KEY: Record<NotificationSeverity, string> = {
  information: "success",
  warning: "warning",
  error: "error",
};

export interface ToastPalette {
  readonly border: string;
  readonly title: string;
  readonly background: string;
}

/**
 * Resolve one severity's colours out of the generated theme palette.
 *
 * Throws rather than substituting a default: a missing token means the palette
 * and this mapping disagree about what the theme provides, and a toast quietly
 * painted in the wrong colour is exactly the failure a baseline cannot catch when
 * the substitute happens to be close. [LAW:no-silent-failure]
 */
export function resolveToastPalette(
  severity: NotificationSeverity,
  variables: Record<string, string>,
): ToastPalette {
  const key = SEVERITY_PALETTE_KEY[severity];
  const tokens = { border: `--${key}`, title: `--text-${key}`, background: "--panel-lighten-1" };

  const resolved = Object.entries(tokens).map(([role, token]) => {
    const value = variables[token];

    if (value === undefined) {
      throw new Error(`toast overlay: theme provides no ${token} for severity "${severity}"`);
    }

    return [role, value] as const;
  });

  return Object.fromEntries(resolved) as unknown as ToastPalette;
}

/**
 * The width of a single toast, and the column it starts at, for a given terminal.
 *
 * Both fall out of the rack's own box: the gutter comes off the right, the toast
 * is half of what remains (capped), and `align: right` puts it against the gutter.
 */
export function toastGeometry(terminalWidth: number): { width: number; left: number } {
  const rackWidth = Math.max(0, terminalWidth - RACK_SCROLLBAR_GUTTER);
  const width = Math.max(0, Math.min(TOAST_MAX_WIDTH, Math.floor(rackWidth / 2)));

  return { width, left: rackWidth - width };
}

/**
 * Build one toast as the rows of cells it occupies.
 *
 * Ink gives `backgroundColor` to `Text` and not to `Box`, so a toast's panel
 * colour exists only where the toast emits a glyph. The padding rows, the run of
 * background after a short title, and the border column are therefore all emitted
 * as content here rather than left to flexbox — the same reason
 * `content/align.ts` paints its own alignment.
 */
export function buildToastRows(
  notification: Notification,
  width: number,
  variables: Record<string, string>,
): Content[] {
  const palette = resolveToastPalette(notification.severity, variables);

  // Textual's `Toast` is border-box: the chrome eats into `width` rather than
  // widening past it, so a terminal too narrow to hold border-plus-padding
  // squeezes the content region to nothing and crops the rest.
  const innerWidth = Math.max(0, width - TOAST_BORDER_COLUMNS - TOAST_PADDING_COLUMNS * 2);

  // Textual's `Toast.render`: the title is one styled line above the message, and
  // a toast with no title is the message alone. Assembling before wrapping is what
  // makes a long title wrap on the same terms as the body.
  //
  // The title is not markup even when the message is — upstream assembles it as a
  // styled plain span while running the message through `Content.from_markup`. So
  // a title reading "[draft] Saved" keeps all seven of those characters, and
  // `fromText(…, { markup: false })` is also what accepts a Content title without
  // a branch to tell the two input types apart.
  const message = Content.fromText(notification.message, { markup: notification.markup });
  const title = Content.fromText(notification.title, { markup: false }).stylizeBefore(
    `bold ${palette.title}`,
  );
  const body = title.cellLength === 0 ? message : Content.assemble(title, "\n", message);

  const blankRow = Content.blank(innerWidth);
  const lines = body.wrap(innerWidth);
  const rows = [
    ...Array.from({ length: TOAST_PADDING_ROWS }, () => blankRow),
    ...lines,
    ...Array.from({ length: TOAST_PADDING_ROWS }, () => blankRow),
  ];

  return rows.map((line) =>
    Content.assemble(
      [TOAST_BORDER_GLYPH, palette.border],
      Content.blank(TOAST_PADDING_COLUMNS),
      line,
      Content.blank(Math.max(0, innerWidth - line.cellLength)),
      Content.blank(TOAST_PADDING_COLUMNS),
      // The panel colour goes on underneath, so the border and title spans set
      // above keep their foregrounds while every cell in the row gets the fill.
    )
      .stylizeBefore(`on ${palette.background}`)
      .truncate(width, { overflow: "crop" }),
  );
}

interface ToastBlock {
  readonly identity: string;
  readonly rows: readonly Content[];
}

function measureBlocks(
  notifications: readonly Notification[],
  width: number,
  variables: Record<string, string>,
): ToastBlock[] {
  return notifications.map((notification) => ({
    identity: notification.identity,
    rows: buildToastRows(notification, width, variables),
  }));
}

/**
 * The rows of the stack that are on screen, and the row the stack starts on.
 *
 * The rack is `dock: bottom`, so the stack is positioned from its bottom edge:
 * the last toast's final row sits one row above the terminal floor, and
 * everything above it is pushed up by the toasts and the gaps between them.
 *
 * A stack taller than the rack loses rows off the top, because upstream's rack is
 * `overflow-y: scroll` and re-runs `scroll_end` on every mount: the newest toast
 * stays against the floor, the oldest scroll out of view, and the one straddling
 * the top edge is cut part-way. The port has no scrollbar to move, so the rows
 * above the viewport are simply never painted.
 */
export function fitStack(
  blocks: readonly ToastBlock[],
  terminalHeight: number,
): { visible: ToastBlock[]; top: number } {
  let budget = Math.max(0, terminalHeight - RACK_BOTTOM_MARGIN);

  // Spent newest-first, so what runs out of rack is always the top of the stack.
  const fitted = [...blocks]
    .reverse()
    .map((block, index) => {
      budget = Math.max(0, budget - (index === 0 ? 0 : TOAST_TOP_MARGIN));
      const shown = Math.min(block.rows.length, budget);
      budget -= shown;

      return { ...block, rows: block.rows.slice(block.rows.length - shown) };
    })
    .reverse();

  return { visible: fitted.filter((block) => block.rows.length > 0), top: budget };
}

export const ToastOverlay = observer(function ToastOverlay(): React.JSX.Element | null {
  const app = useTextual();
  const notifications = app.showNotifications ? app.notifications.list() : [];

  if (notifications.length === 0) {
    return null;
  }

  const { width, left } = toastGeometry(app.terminalSize.width);
  const blocks = measureBlocks(notifications, width, app.themeVariables);
  const { visible, top } = fitStack(blocks, app.terminalSize.height);

  // [LAW:one-source-of-truth] The stack renders straight from the app's
  // notification collection; nothing here keeps its own copy of what is showing.
  //
  // The gap between toasts is an Ink margin rather than a painted blank row: a
  // margin leaves those cells untouched so the screen shows through, which is
  // what Textual's transparent `Toast { margin-top: 1 }` does.
  return (
    <Box
      position="absolute"
      flexDirection="column"
      marginLeft={left}
      marginTop={top}
      width={width}
    >
      {visible.map((block, index) => (
        <Box key={block.identity} marginBottom={index === visible.length - 1 ? 0 : TOAST_TOP_MARGIN}>
          {renderContent(new Content("\n").join(block.rows), {}, `toast:${block.identity}`, width)}
        </Box>
      ))}
    </Box>
  );
});
