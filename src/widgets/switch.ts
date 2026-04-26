import { Message, type MessageInit } from "../events/message.js";

export class SwitchChanged extends Message {
  constructor(
    readonly value: boolean,
    init?: MessageInit,
  ) {
    super(init);
  }
}

// [LAW:one-source-of-truth] The public `Switch` name is reserved for the
// React widget component; this state holder stays behind the model seam.
export class SwitchModel {
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
