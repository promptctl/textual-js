// [LAW:one-type-per-behavior] Checkbox is a ToggleButton whose inner glyph is
// `X`. Everything else — the model, the message, the bindings, the border, the
// component classes — lives in toggle-button-component.tsx and is shared with
// RadioButton.

import { makeToggleButton, type ToggleButtonProps } from "./toggle-button-component.js";

export type CheckboxProps = ToggleButtonProps;

export const Checkbox = makeToggleButton({ typeName: "Checkbox", buttonInner: "X" });
