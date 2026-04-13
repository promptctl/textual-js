/**
 * LayoutStrategy — abstract base for arrangement strategies.
 *
 * Each strategy (vertical, horizontal, grid) implements arrange()
 * to produce WidgetPlacements from a list of child widgets and
 * a container size.
 */

import type { Size } from "../geometry/size.js";
import type { DOMNode } from "../dom-node.js";
import type { WidgetPlacement } from "./placement.js";

export abstract class LayoutStrategy {
  /**
   * Arrange children within the given container size.
   *
   * @param parent - The container widget
   * @param children - Widgets to arrange (non-docked, non-split)
   * @param size - Available space
   * @param greedy - Whether to expand to fill available space
   * @returns Placements for each child
   */
  abstract arrange(
    parent: DOMNode,
    children: DOMNode[],
    size: Size,
    greedy: boolean,
  ): WidgetPlacement[];
}
