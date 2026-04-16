export enum Unit {
  CELLS = "cells",
  PERCENT = "percent",
  WIDTH = "width",
  HEIGHT = "height",
  FRACTION = "fraction",
}

export class Scalar {
  constructor(
    readonly value: number,
    readonly unit: Unit,
    readonly percentUnit: Unit,
  ) {}

  copyWith({
    value = this.value,
    unit = this.unit,
    percentUnit = this.percentUnit,
  }: Partial<{ value: number; unit: Unit; percentUnit: Unit }>): Scalar {
    return new Scalar(value, unit, percentUnit);
  }

  equals(other: Scalar): boolean {
    return this.value === other.value && this.unit === other.unit && this.percentUnit === other.percentUnit;
  }
}

export type ScalarAxis = "width" | "height";
export interface ScalarViewport {
  width: number;
  height: number;
}

export function axisToPercentUnit(axis: ScalarAxis): Unit {
  return axis === "width" ? Unit.WIDTH : Unit.HEIGHT;
}

export function parseScalar(input: string, axis: ScalarAxis): Scalar {
  const value = input.trim();
  const numeric = /^-?\d+(?:\.\d+)?$/;
  const percent = /^(-?\d+(?:\.\d+)?)%$/;
  const fraction = /^(-?\d+(?:\.\d+)?)fr$/;
  const viewportWidth = /^(-?\d+(?:\.\d+)?)vw$/;
  const viewportHeight = /^(-?\d+(?:\.\d+)?)vh$/;

  if (numeric.test(value)) {
    return new Scalar(Number(value), Unit.CELLS, axisToPercentUnit(axis));
  }

  const percentMatch = value.match(percent);

  if (percentMatch !== null) {
    return new Scalar(Number(percentMatch[1]), Unit.PERCENT, axisToPercentUnit(axis));
  }

  const fractionMatch = value.match(fraction);

  if (fractionMatch !== null) {
    return new Scalar(Number(fractionMatch[1]), Unit.FRACTION, axisToPercentUnit(axis));
  }

  const viewportWidthMatch = value.match(viewportWidth);

  if (viewportWidthMatch !== null) {
    return new Scalar(Number(viewportWidthMatch[1]), Unit.WIDTH, Unit.WIDTH);
  }

  const viewportHeightMatch = value.match(viewportHeight);

  if (viewportHeightMatch !== null) {
    return new Scalar(Number(viewportHeightMatch[1]), Unit.HEIGHT, Unit.HEIGHT);
  }

  throw new Error(`Invalid scalar "${input}"`);
}

export function scalarToInkValue(value: Scalar, viewport: ScalarViewport): number | string {
  if (value.unit === Unit.CELLS) {
    return value.value;
  }

  if (value.unit === Unit.FRACTION) {
    return `${value.value}fr`;
  }

  if (value.unit === Unit.WIDTH) {
    return Math.round((viewport.width * value.value) / 100);
  }

  if (value.unit === Unit.HEIGHT) {
    return Math.round((viewport.height * value.value) / 100);
  }

  return `${value.value}%`;
}
