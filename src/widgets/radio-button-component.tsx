// [LAW:one-type-per-behavior] RadioButton is a ToggleButton whose inner glyph is
// `●`. Everything else lives in toggle-button-component.tsx and is shared with
// Checkbox.
// [LAW:single-enforcer] When a RadioButton lives inside a RadioSet, the
// enclosing set enforces mutual exclusion. Standalone RadioButtons toggle
// themselves like a Checkbox.

import { makeToggleButton, type ToggleButtonProps } from "./toggle-button-component.js";

export type RadioButtonProps = ToggleButtonProps;

export const RadioButton = makeToggleButton({ typeName: "RadioButton", buttonInner: "●" });
