import { Message, type MessageInit } from "../events/message.js";

export class SwitchChanged extends Message {
  constructor(
    readonly value: boolean,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class Switch {
  private _value: boolean;

  constructor(value = false) {
    this._value = value;
  }

  get value(): boolean {
    return this._value;
  }

  set value(next: boolean) {
    this._value = next;
  }

  toggle(): boolean {
    this._value = !this._value;
    return this._value;
  }
}
