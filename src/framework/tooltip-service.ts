// [LAW:single-enforcer] TooltipService is the sole owner of the tooltip reveal
// timer and the only writer of the active-tooltip view-model. The framework
// orchestrator triggers reveal/hide/refresh through a narrow injected deps
// interface — the service never reaches back into AppRuntime directly.
// [LAW:one-source-of-truth] The tooltipTimer handle lives in exactly one place:
// this service. The public activeTooltip observable still lives on the
// framework as the canonical view-model; the service mutates it via deps so
// reveal pipeline logic and view-model writes are not duplicated.
// [LAW:one-way-deps] The service depends only on a narrow TooltipServiceDeps
// interface; it does NOT import AppRuntime.

import "./mobx-config.js";

import { runInAction } from "mobx";
import { autoObservable } from "./auto-observable.js";

import { measureVisual, visualize, type Visual, type VisualInput } from "../content/index.js";
import type { Widget } from "./widget.js";
import type { ActiveTooltip, PointerLocation } from "./_app-runtime.js";

// [LAW:one-way-deps] Narrow capability interface the service requires from its
// host (typically AppRuntime). The service never imports the host class.
export interface TooltipServiceDeps {
  setActiveTooltip(tooltip: ActiveTooltip | null): void;
  getActiveTooltip(): ActiveTooltip | null;
  getHoveredNodeId(): string | null;
  getLastPointerLocation(): PointerLocation | null;
  getWidget(id: string): Widget | undefined;
  getShowTooltips(): boolean;
  getTooltipDelay(): number;
}

export class TooltipService {
  private readonly deps: TooltipServiceDeps;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: TooltipServiceDeps) {
    this.deps = deps;
    autoObservable(
      this,
      {
        deps: false,
        tooltipTimer: false,
      },
      { autoBind: true },
    );
  }

  handleWidgetTooltipChange(widget: Widget): void {
    if (this.deps.getHoveredNodeId() !== widget.nodeId) {
      return;
    }

    this.refreshTooltipFromHover();
  }

  refreshTooltipFromHover(): void {
    this.clearTooltipTimer();

    if (!this.deps.getShowTooltips()) {
      return;
    }

    const hoveredNodeId = this.deps.getHoveredNodeId();
    const pointer = this.deps.getLastPointerLocation();

    if (hoveredNodeId === null || pointer === null) {
      return;
    }

    const hoveredWidget = this.deps.getWidget(hoveredNodeId);
    const visual = hoveredWidget === undefined ? null : this.normalizeTooltipContent(hoveredWidget.tooltip);

    if (hoveredWidget === undefined || visual === null) {
      return;
    }

    this.tooltipTimer = setTimeout(() => {
      const currentHoveredId = this.deps.getHoveredNodeId();
      const currentHovered = currentHoveredId === null ? undefined : this.deps.getWidget(currentHoveredId);

      if (currentHovered?.nodeId !== hoveredWidget.nodeId) {
        return;
      }

      const currentVisual = this.normalizeTooltipContent(currentHovered.tooltip);

      if (currentVisual === null) {
        return;
      }

      runInAction(() => {
        this.deps.setActiveTooltip({
          sourceNodeId: hoveredWidget.nodeId,
          visual: currentVisual,
          x: pointer.x,
          y: pointer.y,
          visible: true,
        });
        this.tooltipTimer = null;
      });
    }, this.deps.getTooltipDelay());
  }

  hideTooltip(): void {
    this.clearTooltipTimer();

    if (this.deps.getActiveTooltip() !== null) {
      this.deps.setActiveTooltip(null);
    }
  }

  clearTooltipTimer(): void {
    if (this.tooltipTimer !== null) {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = null;
    }
  }

  private normalizeTooltipContent(value: VisualInput | null): Visual | null {
    if (value === null) {
      return null;
    }

    const visual = visualize(value);
    const measurement = measureVisual(visual);
    return measurement.width === 0 && measurement.height === 0 ? null : visual;
  }
}
