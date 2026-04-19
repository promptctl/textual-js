import { Message, type MessageInit } from "../events/message.js";
import { Content, type ContentInput } from "../content/index.js";

export type ButtonVariant = "default" | "primary" | "success" | "warning" | "error";

const VALID_VARIANTS = new Set<ButtonVariant>(["default", "primary", "success", "warning", "error"]);

export class ButtonPressed extends Message {
  constructor(init?: MessageInit) {
    super(init);
  }
}

// [LAW:one-source-of-truth] The public `Button` name is reserved for the
// React widget component; this state holder stays behind the model seam.
export class ButtonModel {
  private _label: Content;
  readonly variant: ButtonVariant;

  constructor(label: ContentInput = "", variant: ButtonVariant = "default") {
    this._label = Content.fromText(label);

    if (!VALID_VARIANTS.has(variant)) {
      throw new Error(`Invalid button variant: "${variant}"`);
    }

    this.variant = variant;
  }

  get label(): Content {
    return this._label;
  }

  set label(value: ContentInput) {
    this._label = Content.fromText(value);
  }
}
