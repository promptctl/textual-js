import { Message, type MessageInit } from "../events/message.js";

export class InputChanged extends Message {
  constructor(
    readonly value: string,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class InputSubmitted extends Message {
  constructor(
    readonly value: string,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export interface InputSelection {
  start: number;
  end: number;
}

export type InputType = "text" | "integer" | "number";

const BUILTIN_RESTRICT: Record<InputType, RegExp | null> = {
  text: null,
  integer: /^-?\d*$/,
  number: /^-?\d*\.?\d*$/,
};

function isValidInputType(value: string): value is InputType {
  return value in BUILTIN_RESTRICT;
}

// [LAW:single-enforcer] The Input model is the single enforcer of value
// constraints (restrict pattern, max length). All mutation paths flow through
// applyEdit which runs both checks.
export class Input {
  private _value: string;
  private _cursorPosition: number;
  private _selection: InputSelection | null;
  private _restrict: RegExp | null;
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
    this._restrict =
      options.restrict !== undefined && options.restrict !== null
        ? typeof options.restrict === "string"
          ? new RegExp(options.restrict)
          : options.restrict
        : BUILTIN_RESTRICT[this.type];
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
    if (this._restrict === null) {
      return true;
    }

    return this._restrict.test(proposed);
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
