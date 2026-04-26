import { Message, type MessageInit } from "../events/message.js";
import type { WidgetActions } from "../framework/widget-registry.js";
import type { ValidationResult } from "../validation/index.js";

export class InputChanged extends Message {
  constructor(
    readonly value: string,
    readonly validationResult: ValidationResult | null = null,
    init?: MessageInit,
  ) {
    super(init);
  }

  get validation_result(): ValidationResult | null {
    return this.validationResult;
  }
}

export class InputSubmitted extends Message {
  constructor(
    readonly value: string,
    readonly validationResult: ValidationResult | null = null,
    init?: MessageInit,
  ) {
    super(init);
  }

  get validation_result(): ValidationResult | null {
    return this.validationResult;
  }
}

export function createInputActions(model: InputModel): WidgetActions {
  // [LAW:single-enforcer] Input key commands enter through framework actions;
  // the model owns text mutation while bindings only name these commands.
  return {
    action_cursor_left: () => model.moveCursorLeft(),
    action_cursor_right: () => model.moveCursorRight(),
    action_cursor_left_word: () => model.moveCursorWordLeft(),
    action_cursor_right_word: () => model.moveCursorWordRight(),
    action_home: () => model.moveCursorHome(),
    action_end: () => model.moveCursorEnd(),
    action_delete_left: () => {
      model.deleteLeft();
    },
    action_delete_left_word: () => {
      model.deleteWordLeft();
    },
    action_delete_left_all: () => {
      model.deleteToStart();
    },
    action_delete_right: () => {
      model.deleteRight();
    },
    action_delete_right_word: () => {
      model.deleteWordRight();
    },
    action_delete_right_all: () => {
      model.deleteToEnd();
    },
  };
}

export interface InputSelection {
  start: number;
  end: number;
}

export type InputType = "text" | "integer" | "number";

type RestrictRule = {
  pattern: RegExp | null;
  allows: (proposed: string) => boolean;
};

const BUILTIN_RESTRICT: Record<InputType, RestrictRule> = {
  text: {
    pattern: null,
    allows: () => true,
  },
  integer: {
    pattern: /^[+-]?\d(?:[\d_]*\d)?_?$|^[+-]?$/,
    allows: isValidIntegerCandidate,
  },
  number: {
    pattern: /^[+-]?(?:(?:\d(?:[\d_]*\d)?_?)(?:\.[\d_]*)?|\.[\d_]*)?(?:[eE][+-]?[\d_]*)?$/,
    allows: isValidNumberCandidate,
  },
};

function isValidInputType(value: string): value is InputType {
  return value in BUILTIN_RESTRICT;
}

function isValidIntegerCandidate(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (!/^[+-]?[\d_]*$/.test(value)) {
    return false;
  }

  const unsigned = value.replace(/^[+-]/, "");
  return unsigned === "" || !unsigned.startsWith("_");
}

function isValidNumberCandidate(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (/^(inf|nan)$/i.test(value)) {
    return false;
  }

  const unsigned = value.replace(/^[+-]/, "");
  const exponentIndex = unsigned.search(/[eE]/);
  const hasExponent = exponentIndex >= 0;
  const mantissa = hasExponent ? unsigned.slice(0, exponentIndex) : unsigned;
  const exponent = hasExponent ? unsigned.slice(exponentIndex + 1) : null;

  if (hasExponent && (mantissa === "" || !/\d/.test(mantissa))) {
    return false;
  }

  return isValidMantissaCandidate(mantissa) && isValidExponentCandidate(exponent);
}

function isValidMantissaCandidate(value: string): boolean {
  if (value === "") {
    return true;
  }

  if (!/^[\d_.]*$/.test(value) || value.startsWith("_")) {
    return false;
  }

  return value.split(".").length <= 2;
}

function isValidExponentCandidate(value: string | null): boolean {
  if (value === null) {
    return true;
  }

  if (!/^[+-]?[\d_]*$/.test(value)) {
    return false;
  }

  const unsigned = value.replace(/^[+-]/, "");
  return unsigned === "" || !unsigned.startsWith("_");
}

function normalizeWholeMatchPattern(pattern: string | RegExp): RegExp {
  if (typeof pattern === "string") {
    return new RegExp(`^(?:${pattern})$`);
  }

  const flags = pattern.flags.replace(/[gy]/g, "");
  return new RegExp(pattern.source, flags);
}

function createCustomRestrictRule(pattern: string | RegExp): RestrictRule {
  const normalizedPattern = normalizeWholeMatchPattern(pattern);

  return {
    pattern: normalizedPattern,
    allows: (proposed) => {
      normalizedPattern.lastIndex = 0;
      return normalizedPattern.test(proposed);
    },
  };
}

// [LAW:single-enforcer] The Input model is the single enforcer of value
// constraints (restrict pattern, max length). All mutation paths flow through
// applyEdit which runs both checks.
// [LAW:one-source-of-truth] The public `Input` name is reserved for the future
// React widget component; this state holder stays behind the model seam.
export class InputModel {
  private _value: string;
  private _cursorPosition: number;
  private _selection: InputSelection | null;
  private _restrict: RegExp | null;
  private readonly _restrictRule: RestrictRule;
  private _maxLength: number | null;
  private _password: boolean;
  readonly type: InputType;

  constructor(options: {
    value?: string;
    type?: InputType | string;
    restrict?: RegExp | string | null;
    maxLength?: number | null;
    password?: boolean;
  } = {}) {
    const typeName = options.type ?? "text";

    if (!isValidInputType(typeName)) {
      throw new Error(`Invalid input type: "${typeName}"`);
    }

    this.type = typeName;
    this._password = options.password ?? false;
    this._maxLength = options.maxLength ?? null;
    this._restrictRule =
      options.restrict !== undefined && options.restrict !== null
        ? createCustomRestrictRule(options.restrict)
        : BUILTIN_RESTRICT[this.type];
    this._restrict = this._restrictRule.pattern;
    this._value = "";
    this._cursorPosition = 0;
    this._selection = null;

    // Apply initial value (bypass restrict for constructor)
    this._value = options.value ?? "";
    this._cursorPosition = this._value.length;
  }

  get value(): string {
    return this._value;
  }

  set value(next: string) {
    this._value = next;
    this._cursorPosition = Math.min(this._cursorPosition, next.length);
    this._selection = null;
  }

  get cursorPosition(): number {
    return this._cursorPosition;
  }

  set cursorPosition(value: number) {
    this._cursorPosition = Math.max(0, Math.min(value, this._value.length));
  }

  get selection(): InputSelection | null {
    return this._selection;
  }

  get selectedText(): string {
    if (this._selection === null) {
      return "";
    }

    const start = Math.min(this._selection.start, this._selection.end);
    const end = Math.max(this._selection.start, this._selection.end);
    return this._value.slice(start, end);
  }

  get password(): boolean {
    return this._password;
  }

  get maxLength(): number | null {
    return this._maxLength;
  }

  get restrict(): RegExp | null {
    return this._restrict;
  }

  select(start: number, end: number): void {
    this._selection = {
      start: Math.max(0, Math.min(start, this._value.length)),
      end: Math.max(0, Math.min(end, this._value.length)),
    };
  }

  selectAll(): void {
    this.select(0, this._value.length);
  }

  clearSelection(): void {
    this._selection = null;
  }

  deleteSelection(): boolean {
    if (this._selection === null) {
      return false;
    }

    const start = Math.min(this._selection.start, this._selection.end);
    const end = Math.max(this._selection.start, this._selection.end);

    if (start === end) {
      this._selection = null;
      return false;
    }

    this._value = this._value.slice(0, start) + this._value.slice(end);
    this._cursorPosition = start;
    this._selection = null;
    return true;
  }

  insert(text: string): boolean {
    this.deleteSelection();
    const before = this._value.slice(0, this._cursorPosition);
    const after = this._value.slice(this._cursorPosition);
    const proposed = before + text + after;

    if (!this.isAllowed(proposed)) {
      return false;
    }

    if (this._maxLength !== null && proposed.length > this._maxLength) {
      return false;
    }

    this._value = proposed;
    this._cursorPosition += text.length;
    return true;
  }

  delete(start: number, end: number): boolean {
    const normalizedStart = Math.max(0, Math.min(start, end, this._value.length));
    const normalizedEnd = Math.max(0, Math.min(Math.max(start, end), this._value.length));

    if (normalizedStart === normalizedEnd) {
      return false;
    }

    this._value = this._value.slice(0, normalizedStart) + this._value.slice(normalizedEnd);
    this._cursorPosition = Math.min(this._cursorPosition, this._value.length);
    return true;
  }

  replace(text: string, start: number, end: number): boolean {
    const normalizedStart = Math.max(0, Math.min(start, end, this._value.length));
    const normalizedEnd = Math.max(0, Math.min(Math.max(start, end), this._value.length));
    const proposed = this._value.slice(0, normalizedStart) + text + this._value.slice(normalizedEnd);

    if (!this.isAllowed(proposed)) {
      return false;
    }

    if (this._maxLength !== null && proposed.length > this._maxLength) {
      return false;
    }

    this._value = proposed;
    this._cursorPosition = normalizedStart + text.length;
    return true;
  }

  // Movement actions
  moveCursorLeft(): void {
    this._selection = null;
    this._cursorPosition = Math.max(0, this._cursorPosition - 1);
  }

  moveCursorRight(): void {
    this._selection = null;
    this._cursorPosition = Math.min(this._value.length, this._cursorPosition + 1);
  }

  moveCursorHome(): void {
    this._selection = null;
    this._cursorPosition = 0;
  }

  moveCursorEnd(): void {
    this._selection = null;
    this._cursorPosition = this._value.length;
  }

  moveCursorWordLeft(): void {
    this._selection = null;

    if (this._password) {
      this._cursorPosition = 0;
      return;
    }

    this._cursorPosition = this.findWordBoundaryLeft(this._cursorPosition);
  }

  moveCursorWordRight(): void {
    this._selection = null;

    if (this._password) {
      this._cursorPosition = this._value.length;
      return;
    }

    this._cursorPosition = this.findWordBoundaryRight(this._cursorPosition);
  }

  // Delete actions
  deleteLeft(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition === 0) {
      return false;
    }

    this._value =
      this._value.slice(0, this._cursorPosition - 1) + this._value.slice(this._cursorPosition);
    this._cursorPosition -= 1;
    return true;
  }

  deleteRight(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition >= this._value.length) {
      return false;
    }

    this._value =
      this._value.slice(0, this._cursorPosition) + this._value.slice(this._cursorPosition + 1);
    return true;
  }

  deleteWordLeft(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition === 0) {
      return false;
    }

    const boundary = this._password ? 0 : this.findWordBoundaryLeft(this._cursorPosition);
    this._value = this._value.slice(0, boundary) + this._value.slice(this._cursorPosition);
    this._cursorPosition = boundary;
    return true;
  }

  deleteWordRight(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition >= this._value.length) {
      return false;
    }

    const boundary = this._password
      ? this._value.length
      : this.findWordBoundaryRight(this._cursorPosition);
    this._value = this._value.slice(0, this._cursorPosition) + this._value.slice(boundary);
    return true;
  }

  deleteToStart(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition === 0) {
      return false;
    }

    this._value = this._value.slice(this._cursorPosition);
    this._cursorPosition = 0;
    return true;
  }

  deleteToEnd(): boolean {
    if (this.deleteSelection()) {
      return true;
    }

    if (this._cursorPosition >= this._value.length) {
      return false;
    }

    this._value = this._value.slice(0, this._cursorPosition);
    return true;
  }

  clear(): void {
    this._value = "";
    this._cursorPosition = 0;
    this._selection = null;
  }

  private isAllowed(proposed: string): boolean {
    return this._restrictRule.allows(proposed);
  }

  private findWordBoundaryLeft(position: number): number {
    let index = position - 1;

    // Skip whitespace
    while (index > 0 && /\s/.test(this._value[index])) {
      index -= 1;
    }

    // Skip word characters (including hyphens as word chars per spec)
    while (index > 0 && /\S/.test(this._value[index - 1])) {
      index -= 1;
    }

    return Math.max(0, index);
  }

  private findWordBoundaryRight(position: number): number {
    let index = position;

    // Skip current word characters
    while (index < this._value.length && /\S/.test(this._value[index])) {
      index += 1;
    }

    // Skip whitespace
    while (index < this._value.length && /\s/.test(this._value[index])) {
      index += 1;
    }

    return index;
  }
}
