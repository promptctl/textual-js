/**
 * GridLayout — 2D cell-map placement with column/row spanning.
 *
 * This is the layout strategy that flexbox cannot replace. It uses a
 * cell-map to track occupied cells, placing widgets left-to-right,
 * top-to-bottom, skipping cells claimed by spanning widgets.
 */

import { Size } from "../geometry/size.js";
import { Region } from "../geometry/region.js";
import type { DOMNode } from "../dom-node.js";
import type { WidgetPlacement } from "./placement.js";
import { LayoutStrategy } from "./strategy.js";

export interface GridOptions {
  columns: number;
  rows?: number;
  gutterH?: number;
  gutterV?: number;
}

/**
 * Get column/row span for a widget.
 * TODO: Read from widget.styles once TCSS is integrated.
 */
function getSpan(_widget: DOMNode): { colSpan: number; rowSpan: number } {
  return { colSpan: 1, rowSpan: 1 };
}

export class GridLayout extends LayoutStrategy {
  readonly columns: number;
  readonly gutterH: number;
  readonly gutterV: number;

  constructor(options: GridOptions) {
    super();
    this.columns = options.columns;
    this.gutterH = options.gutterH ?? 0;
    this.gutterV = options.gutterV ?? 0;
  }

  arrange(
    _parent: DOMNode,
    children: DOMNode[],
    size: Size,
    _greedy: boolean,
  ): WidgetPlacement[] {
    const cols = this.columns;
    const gutterH = this.gutterH;
    const gutterV = this.gutterV;

    // Calculate column widths (equal distribution with gutters)
    const totalGutterW = gutterH * (cols - 1);
    const colWidth = Math.floor((size.width - totalGutterW) / cols);

    // Cell map: tracks which cells are occupied
    // Key: "col,row" → true if occupied
    const occupied = new Set<string>();

    function isOccupied(col: number, row: number): boolean {
      return occupied.has(`${col},${row}`);
    }

    function occupy(col: number, row: number, cSpan: number, rSpan: number): void {
      for (let r = row; r < row + rSpan; r++) {
        for (let c = col; c < col + cSpan; c++) {
          occupied.add(`${c},${r}`);
        }
      }
    }

    function findSlot(cSpan: number, rSpan: number): { col: number; row: number } | null {
      for (let row = 0; ; row++) {
        for (let col = 0; col <= cols - cSpan; col++) {
          let fits = true;
          for (let r = row; r < row + rSpan && fits; r++) {
            for (let c = col; c < col + cSpan && fits; c++) {
              if (isOccupied(c, r)) fits = false;
            }
          }
          if (fits) return { col, row };
        }
        // Safety: don't search forever
        if (row > children.length + 100) return null;
      }
    }

    const placements: WidgetPlacement[] = [];
    // Track max row for row height calculation
    let maxRow = 0;

    for (const child of children) {
      const { colSpan, rowSpan } = getSpan(child);
      const slot = findSlot(colSpan, rowSpan);
      if (!slot) continue;

      occupy(slot.col, slot.row, colSpan, rowSpan);
      maxRow = Math.max(maxRow, slot.row + rowSpan);

      const x = slot.col * (colWidth + gutterH);
      const spanWidth = colWidth * colSpan + gutterH * (colSpan - 1);

      // Row height: equal distribution of available height
      // TODO: support explicit grid-rows with fr/fixed/% units
      const totalRows = maxRow || 1;
      const totalGutterV = gutterV * Math.max(0, totalRows - 1);
      const rowHeight = Math.floor((size.height - totalGutterV) / totalRows);

      const y = slot.row * (rowHeight + gutterV);
      const spanHeight = rowHeight * rowSpan + gutterV * (rowSpan - 1);

      placements.push({
        widget: child,
        region: new Region(x, y, spanWidth, spanHeight),
        order: placements.length,
        fixed: false,
        overlay: false,
      });
    }

    return placements;
  }
}
