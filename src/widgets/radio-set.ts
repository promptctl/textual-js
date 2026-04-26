import { Message, type MessageInit } from "../events/message.js";
import { ToggleButtonModel } from "./toggle.js";

export class RadioSetChanged extends Message {
  constructor(
    readonly index: number,
    readonly pressed: ToggleButtonModel,
    init?: MessageInit,
  ) {
    super(init);
  }
}

// [LAW:single-enforcer] RadioSet is the single enforcer of mutual exclusion
// among its child toggle buttons. No child manages its own exclusion.
// [LAW:one-source-of-truth] The public `RadioSet` name is reserved for the
// React widget component; this group state holder stays behind the model seam.
export class RadioSetModel {
  private readonly buttons: ToggleButtonModel[];
  private _pressedIndex: number;

  constructor(buttons: Array<ToggleButtonModel | string>) {
    this.buttons = buttons.map((entry) =>
      typeof entry === "string" ? new ToggleButtonModel(entry, false) : entry,
    );

    // [LAW:one-source-of-truth] When multiple buttons arrive with value=true,
    // only the first is kept. The rest are silently cleared.
    const firstOnIndex = this.buttons.findIndex((button) => button.value);

    for (let index = 0; index < this.buttons.length; index += 1) {
      if (index !== firstOnIndex) {
        this.buttons[index].value = false;
      }
    }

    this._pressedIndex = firstOnIndex;
  }

  get pressedIndex(): number {
    return this._pressedIndex;
  }

  get pressedButton(): ToggleButtonModel | null {
    return this._pressedIndex === -1 ? null : this.buttons[this._pressedIndex];
  }

  get length(): number {
    return this.buttons.length;
  }

  getButton(index: number): ToggleButtonModel {
    return this.buttons[index];
  }

  press(index: number): boolean {
    if (index < 0 || index >= this.buttons.length) {
      return false;
    }

    if (index === this._pressedIndex) {
      return false;
    }

    // [LAW:single-enforcer] Mutual exclusion: turn off previous, turn on next.
    if (this._pressedIndex >= 0) {
      this.buttons[this._pressedIndex].value = false;
    }

    this.buttons[index].value = true;
    this._pressedIndex = index;
    return true;
  }
}
