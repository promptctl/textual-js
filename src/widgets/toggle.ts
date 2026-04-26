// [LAW:one-type-per-behavior] Checkbox and RadioButton share identical toggle
// behavior. They are instances of one ToggleButton type, not separate classes.

import { Message, type MessageInit } from "../events/message.js";
import { Content, type ContentInput } from "../content/index.js";

export class ToggleChanged extends Message {
  constructor(
    readonly value: boolean,
    init?: MessageInit,
  ) {
    super(init);
  }
}

// [LAW:one-source-of-truth] The public Checkbox/RadioButton widget names are
// reserved for React components; this shared state holder stays internal.
export class ToggleButtonModel {
  private _value: boolean;
  private _label: Content;

  constructor(label: ContentInput = "", value = false) {
    this._label = Content.fromText(label);
    this._value = value;
  }

  get value(): boolean {
    return this._value;
  }

  set value(next: boolean) {
    this._value = next;
  }

  get label(): Content {
    return this._label;
  }

  set label(next: ContentInput) {
    this._label = Content.fromText(next);
  }

  toggle(): boolean {
    this._value = !this._value;
    return this._value;
  }
}
