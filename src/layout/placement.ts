/**
 * WidgetPlacement — the output of the layout engine.
 *
 * Describes where a widget should be positioned, its z-order,
 * and whether it's fixed (docked) or an overlay (modal/tooltip).
 */

import { Region } from "../geometry/region.js";
import type { DOMNode } from "../dom-node.js";

export interface WidgetPlacement {
  readonly widget: DOMNode;
  readonly region: Region;
  readonly order: number;
  readonly fixed: boolean;
  readonly overlay: boolean;
}
