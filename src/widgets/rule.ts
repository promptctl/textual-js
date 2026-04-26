export class InvalidRuleOrientation extends Error {}
export class InvalidLineStyle extends Error {}

export type RuleOrientation = "horizontal" | "vertical";

const VALID_ORIENTATIONS = new Set<RuleOrientation>(["horizontal", "vertical"]);
const VALID_LINE_STYLES = new Set(["solid", "heavy", "thick", "dashed", "double", "ascii", "blank", "none"]);

function validateOrientation(value: string): RuleOrientation {
  if (!VALID_ORIENTATIONS.has(value as RuleOrientation)) {
    throw new InvalidRuleOrientation(`Invalid rule orientation: "${value}"`);
  }

  return value as RuleOrientation;
}

function validateLineStyle(value: string): string {
  if (!VALID_LINE_STYLES.has(value)) {
    throw new InvalidLineStyle(`Invalid line style: "${value}"`);
  }

  return value;
}

// [LAW:one-source-of-truth] The public `Rule` name is reserved for the React
// widget component; this state holder stays behind the model seam.
export class RuleModel {
  private _orientation: RuleOrientation;
  private _lineStyle: string;

  constructor(orientation: RuleOrientation = "horizontal", lineStyle = "solid") {
    this._orientation = validateOrientation(orientation);
    this._lineStyle = validateLineStyle(lineStyle);
  }

  get orientation(): RuleOrientation {
    return this._orientation;
  }

  set orientation(value: RuleOrientation) {
    this._orientation = validateOrientation(value);
  }

  get lineStyle(): string {
    return this._lineStyle;
  }

  set lineStyle(value: string) {
    this._lineStyle = validateLineStyle(value);
  }
}
