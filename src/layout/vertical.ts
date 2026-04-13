/**
 * VerticalLayout — stacks children top-to-bottom.
 */

import { Size } from "../geometry/size.js";
import { Region } from "../geometry/region.js";
import type { DOMNode } from "../dom-node.js";
import type { WidgetPlacement } from "./placement.js";
import { LayoutStrategy } from "./strategy.js";

export class VerticalLayout extends LayoutStrategy {
  arrange(
    _parent: DOMNode,
    children: DOMNode[],
    size: Size,
    _greedy: boolean,
  ): WidgetPlacement[] {
    const placements: WidgetPlacement[] = [];
    let y = 0;

    for (const child of children) {
      // TODO: resolve height from styles (auto, fr, fixed, %)
      // For now, each child gets a height of 1
      const childHeight = 1;
      const region = new Region(0, y, size.width, childHeight);

      placements.push({
        widget: child,
        region,
        order: placements.length,
        fixed: false,
        overlay: false,
      });

      y += childHeight;
    }

    return placements;
  }
}
