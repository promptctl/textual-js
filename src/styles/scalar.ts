export enum Unit {
  CELLS = "cells",
  PERCENT = "percent",
  WIDTH = "width",
  HEIGHT = "height",
  FRACTION = "fraction",
  AUTO = "auto",
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

  copy_with({
    value = this.value,
    unit = this.unit,
    percent_unit = this.percentUnit,
    percentUnit = percent_unit,
  }: Partial<{ value: number; unit: Unit; percent_unit: Unit; percentUnit: Unit }>): Scalar {
    return new Scalar(value, unit, percentUnit);
  }

  equals(other: Scalar): boolean {
    return this.value === other.value && this.unit === other.unit && this.percentUnit === other.percentUnit;
  }
}

export type ScalarAxis = "width" | "height";
export class StyleValueError extends Error {}

export interface ScalarViewport {
  width: number;
  height: number;
}

export function axisToPercentUnit(axis: ScalarAxis): Unit {
  return axis === "width" ? Unit.WIDTH : Unit.HEIGHT;
}

function assertScalarAxis(axis: ScalarAxis): void {
  if (axis !== "width" && axis !== "height") {
    throw new StyleValueError(`Invalid scalar axis "${String(axis)}"`);
  }
}

// [LAW:one-source-of-truth] UNIT_DESCRIPTORS is the canonical per-unit
// behavior table. Conversion to Ink values, raw CSS strings, and axis
// normalization all read from this single record; no consumer of Scalar
// may branch on .unit.
interface UnitDescriptor {
  toInk(scalar: Scalar, viewport: ScalarViewport, fractionBasis: number): number | string;
  toRaw(scalar: Scalar): string;
  normalize(scalar: Scalar, axis: ScalarAxis): Scalar;
}

const identityNormalize: UnitDescriptor["normalize"] = (scalar) => scalar;

const UNIT_DESCRIPTORS: Readonly<Record<Unit, UnitDescriptor>> = {
  [Unit.CELLS]: {
    toInk: (scalar) => scalar.value,
    toRaw: (scalar) => String(scalar.value),
    normalize: identityNormalize,
  },
  [Unit.AUTO]: {
    toInk: () => "auto",
    toRaw: () => "auto",
    normalize: identityNormalize,
  },
  [Unit.FRACTION]: {
    // [LAW:one-way-deps] The Ink bridge emits concrete cell counts; grid
    // fraction semantics are resolved before values cross into Ink props.
    toInk: (scalar, _viewport, fractionBasis) => Math.round(scalar.value * fractionBasis),
    toRaw: (scalar) => `${scalar.value}fr`,
    normalize: identityNormalize,
  },
  [Unit.WIDTH]: {
    toInk: (scalar, viewport) => Math.round((viewport.width * scalar.value) / 100),
    toRaw: (scalar) => `${scalar.value}w`,
    normalize: identityNormalize,
  },
  [Unit.HEIGHT]: {
    toInk: (scalar, viewport) => Math.round((viewport.height * scalar.value) / 100),
    toRaw: (scalar) => `${scalar.value}h`,
    normalize: identityNormalize,
  },
  [Unit.PERCENT]: {
    toInk: (scalar) => `${scalar.value}%`,
    toRaw: (scalar) => `${scalar.value}%`,
    normalize: (scalar, axis) => new Scalar(scalar.value, axisToPercentUnit(axis), axisToPercentUnit(axis)),
  },
};

export function parseScalar(input: string, axis: ScalarAxis): Scalar {
  assertScalarAxis(axis);
  const value = input.trim();
  const numeric = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
  const unitMatch = value.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]+)$/);

  if (value === "auto") {
    return new Scalar(0, Unit.AUTO, axisToPercentUnit(axis));
  }

  if (numeric.test(value)) {
    return new Scalar(Number(value), Unit.CELLS, axisToPercentUnit(axis));
  }

  if (unitMatch === null) {
    throw new StyleValueError(`Invalid scalar "${input}"`);
  }

  const number = Number(unitMatch[1]);
  const unit = unitMatch[2];
  const percentUnit = axisToPercentUnit(axis);

  if (unit === "%") {
    return new Scalar(number, Unit.PERCENT, percentUnit);
  }

  if (unit === "fr") {
    return new Scalar(number, Unit.FRACTION, percentUnit);
  }

  if (unit === "w" || unit === "vw") {
    return new Scalar(number, Unit.WIDTH, Unit.WIDTH);
  }

  if (unit === "h" || unit === "vh") {
    return new Scalar(number, Unit.HEIGHT, Unit.HEIGHT);
  }

  throw new StyleValueError(`Invalid scalar unit "${unit}" in "${input}"`);
}

export function normalizeScalar(input: string | number | Scalar, axis: ScalarAxis): Scalar {
  assertScalarAxis(axis);

  const scalar =
    input instanceof Scalar
      ? input
      : typeof input === "number" && Number.isFinite(input)
        ? new Scalar(input, Unit.CELLS, axisToPercentUnit(axis))
        : typeof input === "string"
          ? parseScalar(input, axis)
          : null;

  if (scalar === null) {
    throw new StyleValueError(`Invalid scalar value "${String(input)}"`);
  }

  return UNIT_DESCRIPTORS[scalar.unit].normalize(scalar, axis);
}

export function scalarToInkValue(value: Scalar, viewport: ScalarViewport, fractionBasis = 1): number | string {
  return UNIT_DESCRIPTORS[value.unit].toInk(value, viewport, fractionBasis);
}

export function scalarToRawValue(value: Scalar): string {
  return UNIT_DESCRIPTORS[value.unit].toRaw(value);
}
