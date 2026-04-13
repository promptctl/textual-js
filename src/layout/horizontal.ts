/**
 * HorizontalLayout — arranges children left-to-right.
 */

import { Size } from "../geometry/size.js";
import { Region } from "../geometry/region.js";
import type { DOMNode } from "../dom-node.js";
import type { WidgetPlacement } from "./placement.js";
import { LayoutStrategy } from "./strategy.js";

export class HorizontalLayout extends LayoutStrategy {
  arrange(
    _parent: DOMNode,
    children: DOMNode[],
    size: Size,
    _greedy: boolean,
  ): WidgetPlacement[] {
    const placements: WidgetPlacement[] = [];
    let x = 0;

    // Equal-width distribution for now
    // TODO: resolve width from styles (auto, fr, fixed, %)
    const childWidth = children.length > 0
      ? Math.floor(size.width / children.length)
      : 0;

    for (const child of children) {
      const region = new Region(x, 0, childWidth, size.height);

      placements.push({
        widget: child,
        region,
        order: placements.length,
        fixed: false,
        overlay: false,
      });

      x += childWidth;
    }

    return placements;
  }
}
