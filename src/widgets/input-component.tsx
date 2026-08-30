// [LAW:one-way-deps] Input consumes validation and suggestion services; those
// services do not import or know about the widget component.

import React from "react";
import { Box, type TextProps } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";
import { Key, Paste } from "../events/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import type { Widget } from "../framework/widget.js";
import { InputValidationController, type ValidateOn, type ValidationResult, type Validator } from "../validation/index.js";
import { SuggestionController, type Suggester } from "../suggestions/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
import { WidgetFrame } from "./widget-frame.js";
import {
  InputChanged,
  InputModel,
  InputSubmitted,
  createInputActions,
  type InputType,
} from "./input.js";

export interface InputProps extends WidgetComponentProps {
  value?: string;
  placeholder?: string;
  type?: InputType | string;
  restrict?: RegExp | string | null;
  maxLength?: number | null;
  password?: boolean;
  validators?: readonly Validator<string>[];
  validateOn?: Iterable<string> | null;
  validate_on?: Iterable<string> | null;
  validEmpty?: boolean;
  valid_empty?: boolean;
  suggester?: Suggester | null;
}

// [LAW:types-are-the-program] The public instance members this widget installs
// on its handle — `validate` is public API per spec/docs-spec/widget_input.md.
// Naming that surface lets a caller who queried an Input say so once, instead
// of restating a structural cast at every call site. This is a handle type,
// not a component alias; see src/widgets/README.md on the distinction.
export interface InputHandle extends Widget {
  validate(value?: string): ValidationResult;
  validEmpty: boolean;
  readonly suggestion: string;
}

// Textual obscures password input with U+2022 BULLET, not an asterisk.
const INPUT_PASSWORD_CHARACTER = "•";

// Textual's `Input { padding: 0 2 }`, drawn here rather than declared as a CSS
// `padding` rule: this widget paints its own border cells, and an Ink-applied
// box padding would push those cells inward off the frame edge.
const INPUT_HORIZONTAL_PADDING = 2;

// `▊` (left seven-eighths block) reversed paints a thin rule on the cell's
// right edge; `▎` (left one-quarter block) paints one on the left. Together
// they are Textual's `border: tall`, and they carry no background of their
// own — the screen shows through, exactly as the Python baseline records.
const INPUT_BORDER_LEFT = "▊";
const INPUT_BORDER_RIGHT = "▎";
const INPUT_BORDER_TOP = "▔";
const INPUT_BORDER_BOTTOM = "▁";
const INPUT_BORDER_CELLS = 2;

// [LAW:one-source-of-truth] Every colour the Input paints is resolved here and
// nowhere else. State is expressed as cascade data — the component below never
// asks whether it is focused or invalid, it only reads what the cascade
// resolved. Values are Textual's dark theme, verified cell-by-cell against
// visual-tests/snapshots/python/input_*.json.
const DEFAULT_CSS = `
  Input {
    width: 100%;
    height: 3;
    background: #1e1e1e;
    color: #e0e0e0;
    --input-border: #191919;
    --input-placeholder: #737373;
    --input-cursor-foreground: #121212;
    --input-cursor-background: #e0e0e0;
  }
  Input:focus {
    background: #272727;
    --input-border: #0178d4;
    --input-placeholder: #797979;
  }
  Input.-invalid {
    --input-border: #762b3d;
  }
  Input.-invalid:focus {
    --input-border: #ba3c5b;
  }
`;

interface InputPalette {
  background: string;
  foreground: string;
  border: string;
  placeholder: string;
  cursorForeground: string;
  cursorBackground: string;
}

// [LAW:no-defensive-null-guards] DEFAULT_CSS declares every one of these in the
// base rule, so the typed accessors fail loud on a broken cascade instead of
// each call site re-stating a hex literal already written above.
function readInputPalette(styles: ReturnType<typeof useStyles>): InputPalette {
  return {
    background: styles.getColor("background"),
    foreground: styles.getColor("color"),
    border: styles.getCustomColor("--input-border"),
    placeholder: styles.getCustomColor("--input-placeholder"),
    cursorForeground: styles.getCustomColor("--input-cursor-foreground"),
    cursorBackground: styles.getCustomColor("--input-cursor-background"),
  };
}

// [LAW:dataflow-not-control-flow] Placeholder, plain value and obscured value
// are one value selection feeding one render path — not three render paths.
// Textual shows the placeholder exactly when the value is empty, in password
// mode too.
function resolveInputDisplay(
  value: string,
  placeholder: string,
  password: boolean,
  palette: InputPalette,
): Content {
  if (value.length === 0) {
    return Content.styled(placeholder, palette.placeholder);
  }

  return Content.styled(
    password ? INPUT_PASSWORD_CHARACTER.repeat(value.length) : value,
    palette.foreground,
  );
}

// The value row's visible window.
//
// [LAW:one-source-of-truth] Every width decision here goes through Content's
// cell-aware measurement (`cellLength`, `truncate`) — the same utilities
// widget-frame.tsx uses — rather than raw string length, so wide and astral
// characters are neither split nor mis-measured.
//
// [LAW:dataflow-not-control-flow] The cursor is a value, not a branch: an empty
// range (0, 0) when the widget is unfocused, which `stylize` returns unchanged,
// so focused and unfocused take the same path.
//
// Where the window sits and whether a cursor is drawn are two separate
// questions, and only the second depends on focus. `caret` is the model's
// cursor position, which focus does not change, so the window holds still
// across blur and refocus; `cursorIndex` is null when unfocused and only
// suppresses the overlay.
//
// Textual scrolls the window to keep the cursor visible. This offset is
// derived from the caret each render rather than stored as a sticky
// `view_position`, so it re-anchors on every move instead of holding — and an
// Input constructed with an overflowing value opens on its tail, since the
// model starts the caret at the end. Tracked as textual-input-view-position-zwi.
function buildInputArea(
  body: Content,
  caret: number,
  cursorIndex: number | null,
  areaWidth: number,
  palette: InputPalette,
): Content {
  const viewOffset = Math.max(0, caret - areaWidth + 1);
  const visible = body.slice(viewOffset).truncate(areaWidth, { overflow: "crop" });
  const area = Content.assemble(visible, " ".repeat(Math.max(0, areaWidth - visible.cellLength)));
  const cursorStart = cursorIndex === null ? 0 : cursorIndex - viewOffset;
  const cursorEnd = cursorIndex === null ? 0 : cursorStart + 1;

  return area.stylize(
    `${palette.cursorForeground} on ${palette.cursorBackground}`,
    cursorStart,
    cursorEnd,
  );
}

// The border columns carry no background of their own — the screen shows
// through them — so the surface fill is applied to `inner` alone.
//
// [LAW:dataflow-not-control-flow] `borderCells` is a width budget, not a
// condition: each glyph is emitted through a slice, so one column yields the
// left rule alone and zero yields an empty row without either case being a
// branch. A frame narrower than the border (every Input's first paint, before
// the layout reader measures it) must not render wider than it was allocated.
function inputRow(inner: Content, palette: InputPalette, borderCells: number): Content {
  return Content.assemble(
    Content.styled(INPUT_BORDER_LEFT.slice(0, Math.min(1, borderCells)), `${palette.border} reverse`),
    inner.stylizeBefore(`on ${palette.background}`),
    Content.styled(INPUT_BORDER_RIGHT.slice(0, Math.max(0, borderCells - 1)), palette.border),
  );
}

const INPUT_BINDINGS = [
  { key: "left", action: "cursor_left" },
  { key: "right", action: "cursor_right" },
  { key: "home", action: "home" },
  { key: "end", action: "end" },
  { key: "backspace", action: "delete_left" },
  { key: "delete", action: "delete_right" },
];

// [LAW:single-enforcer] InputChanged/InputSubmitted and validity classes are
// produced by this component after the model mutates; callers do not post them.
export const Input = observer(function Input({
  id,
  classes,
  borderTitle,
  borderSubtitle,
  value = "",
  placeholder = "",
  type = "text",
  restrict,
  maxLength,
  password,
  validators = [],
  validateOn,
  validate_on,
  validEmpty,
  valid_empty,
  suggester = null,
}: InputProps): React.JSX.Element {
  const [, forceRender] = React.useReducer((current: number) => current + 1, 0);
  const modelRef = React.useRef<InputModel>();
  const suggestionControllerRef = React.useRef<SuggestionController>();
  const validationControllerRef = React.useRef<InputValidationController>();
  const validatorsRef = React.useRef(validators);
  const validateOnRef = React.useRef(validateOn ?? validate_on);
  const validEmptyRef = React.useRef(validEmpty ?? valid_empty ?? true);

  if (modelRef.current === undefined) {
    modelRef.current = new InputModel({ value, type, restrict, maxLength, password });
  }

  if (suggestionControllerRef.current === undefined) {
    suggestionControllerRef.current = new SuggestionController(suggester);
  }

  validatorsRef.current = validators;
  validateOnRef.current = validateOn ?? validate_on;
  validEmptyRef.current = validEmpty ?? valid_empty ?? validEmptyRef.current;

  const rebuildValidationController = React.useCallback((nextValidEmpty = validEmptyRef.current) => {
    validationControllerRef.current = new InputValidationController({
      validators: validatorsRef.current,
      validEmpty: nextValidEmpty,
      validateOn: validateOnRef.current,
    });
  }, []);

  rebuildValidationController(validEmptyRef.current);

  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Input",
    borderTitle,
    borderSubtitle,
    focusable: true,
    defaultCss: DEFAULT_CSS,
    bindings: INPUT_BINDINGS,
    actions: createInputActions(modelRef.current),
    handlers: {
      onKey: (message) => {
        handleInputKey(message as Key);
      },
      onPaste: (message) => {
        handleInputPaste(message as Paste);
      },
      onBlur: () => {
        applyValidation("blur");
      },
    },
    typeToken: Input,
  });
  const styles = useStyles(widget.handle);

  const syncValidationClasses = React.useCallback((result: ValidationResult | null): void => {
    if (result === null) {
      return;
    }

    widget.handle.toggleClass("-valid", result.isValid);
    widget.handle.toggleClass("-invalid", !result.isValid);
  }, [widget.handle]);

  // [LAW:one-source-of-truth] The "run every validator regardless of which
  // events the widget subscribes to" controller is built here and nowhere
  // else; both the `validEmpty` setter and the public `validate()` read it.
  const validateValue = React.useCallback((candidate: string): ValidationResult => {
    const controller = new InputValidationController({
      validators: validatorsRef.current,
      validEmpty: validEmptyRef.current,
      validateOn: ["changed", "submitted", "blur"],
    });
    return controller.validate(candidate, "changed")!;
  }, []);

  const recomputeValidationState = React.useCallback(
    (): ValidationResult => validateValue(modelRef.current!.value),
    [validateValue],
  );

  const applyValidation = React.useCallback((event: ValidateOn) => {
    const result = validationControllerRef.current!.validate(modelRef.current!.value, event);
    syncValidationClasses(result);
    return result;
  }, [syncValidationClasses]);

  const refreshSuggestion = React.useCallback(() => {
    void suggestionControllerRef.current!.update(modelRef.current!.value, (message) => {
      widget.postMessage(message);
    }).then(() => {
      forceRender();
    });
  }, [widget]);

  const postChanged = React.useCallback(() => {
    const result = applyValidation("changed");
    widget.postMessage(new InputChanged(modelRef.current!.value, result));
    refreshSuggestion();
    forceRender();
  }, [applyValidation, refreshSuggestion, widget]);

  const acceptSuggestion = React.useCallback((): boolean => {
    const suggestion = suggestionControllerRef.current!.suggestion;

    if (suggestion.length === 0) {
      return false;
    }

    modelRef.current!.value = suggestion;
    postChanged();
    return true;
  }, [postChanged]);

  React.useLayoutEffect(() => {
    const inputHandle = widget.handle as typeof widget.handle & {
      validEmpty?: boolean;
      valid_empty?: boolean;
      suggestion?: string;
      _suggestion?: string;
      validate?: InputHandle["validate"];
    };

    Object.defineProperties(inputHandle, {
      // Textual's public `Input.validate(value)`: run every validator now and
      // publish the outcome as the -valid/-invalid classes the cascade styles
      // against. Textual validates on value *changes*, so a widget built with
      // an initial value carries no verdict until someone asks for one.
      validate: {
        configurable: true,
        value: (candidate: string = modelRef.current!.value): ValidationResult => {
          const result = validateValue(candidate);
          syncValidationClasses(result);
          forceRender();
          return result;
        },
      },
      validEmpty: {
        configurable: true,
        get: () => validEmptyRef.current,
        set: (nextValue: boolean) => {
          validEmptyRef.current = Boolean(nextValue);
          rebuildValidationController(validEmptyRef.current);
          syncValidationClasses(recomputeValidationState());
          forceRender();
        },
      },
      valid_empty: {
        configurable: true,
        get: () => validEmptyRef.current,
        set: (nextValue: boolean) => {
          inputHandle.validEmpty = nextValue;
        },
      },
      suggestion: {
        configurable: true,
        get: () => suggestionControllerRef.current!.suggestion,
      },
      _suggestion: {
        configurable: true,
        get: () => suggestionControllerRef.current!.suggestion,
      },
    });
  }, [rebuildValidationController, recomputeValidationState, syncValidationClasses, validateValue, widget.handle]);

  function handleInputKey(message: Key): void {
    const model = modelRef.current!;
    const keyActions = new Map<string, () => boolean | void>([
      ["enter", () => {
        const result = applyValidation("submitted");
        widget.postMessage(new InputSubmitted(model.value, result));
      }],
      ["left", () => model.moveCursorLeft()],
      ["right", () => {
        return acceptSuggestion() || model.moveCursorRight();
      }],
      ["home", () => model.moveCursorHome()],
      ["end", () => model.moveCursorEnd()],
      ["backspace", () => model.deleteLeft() && postChanged()],
      ["delete", () => model.deleteRight() && postChanged()],
    ]);
    const action = keyActions.get(message.key);

    message.stop();

    if (action !== undefined) {
      action();
      forceRender();
      return;
    }

    if (message.input.length > 0 && model.insert(message.input)) {
      postChanged();
    }
  }

  function handleInputPaste(message: Paste): void {
    const model = modelRef.current!;
    message.stop();

    if (message.text.length > 0 && model.insert(message.text)) {
      postChanged();
      forceRender();
    }
  }

  // [LAW:dataflow-not-control-flow] On the very first render the widget is not
  // yet registered and `styles` is empty — the typed accessors below would
  // throw. Gate on `lifecycleReady` so styles are read only once the framework
  // guarantees the cascade has populated them, mirroring Button and Switch.
  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  const palette = readInputPalette(styles);
  // [LAW:one-source-of-truth] The frame width is the region Ink measured for
  // this widget (`width: 100%` stretching to the screen), not a literal copied
  // from the terminal geometry. The first paint measures zero and the layout
  // reader re-renders with the real width.
  const frameWidth = widget.handle.screenRegion.width;
  const borderCells = Math.min(INPUT_BORDER_CELLS, frameWidth);
  const innerWidth = frameWidth - borderCells;
  // [LAW:one-source-of-truth] Padding and text area are carved from one width
  // budget, so `padding * 2 + area === innerWidth` holds at every width and the
  // value row can never render wider than the border rows above and below it.
  // Together with `borderCells`, this keeps
  // `borderCells + leftPadding + areaWidth + rightPadding === frameWidth` true
  // at every width.
  // Padding is budgeted as a total, not capped per side. Capping each side at
  // half the inner width makes the text area oscillate as the widget grows
  // (0, 1, 0, 1, 0, 1, 2 …) because the per-side cap reaches its maximum one
  // step before the area would have grown. Taking the padding as one budget
  // keeps the area monotonic in the width, and matches Textual, where
  // `padding: 0 2` is fixed and the content box simply shrinks to nothing.
  const totalPadding = Math.min(INPUT_HORIZONTAL_PADDING * 2, innerWidth);
  const leftPadding = Math.min(INPUT_HORIZONTAL_PADDING, totalPadding);
  const rightPadding = totalPadding - leftPadding;
  const areaWidth = innerWidth - totalPadding;

  const suggestion = suggestionControllerRef.current.suggestion;
  const suffix = resolveSuggestionSuffix(
    modelRef.current.value,
    suggestion,
    suggester,
    modelRef.current.password,
  );
  const textAttributes = textAttributesOf(styles.text);
  const body = Content.assemble(
    resolveInputDisplay(modelRef.current.value, placeholder, modelRef.current.password, palette),
    Content.styled(suffix, `${palette.foreground} dim`),
  );
  // [LAW:dataflow-not-control-flow] Cursor visibility is data, not a branch:
  // an index when the widget holds focus, null when it does not.
  const cursorIndex = widget.handle.isFocused ? modelRef.current.cursorPosition : null;
  const valueRow = Content.assemble(
    " ".repeat(leftPadding),
    buildInputArea(body, modelRef.current.cursorPosition, cursorIndex, areaWidth, palette),
    " ".repeat(rightPadding),
  );
  const edgeRow = (glyph: string): Content =>
    Content.styled(glyph.repeat(innerWidth), palette.border);

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        <Box key={`input:${widget.nodeId}:top`}>
          {renderContent(inputRow(edgeRow(INPUT_BORDER_TOP), palette, borderCells), textAttributes, `input:${widget.nodeId}:top`)}
        </Box>
        <Box key={`input:${widget.nodeId}:value`}>
          {renderContent(inputRow(valueRow, palette, borderCells), textAttributes, `input:${widget.nodeId}:value`)}
        </Box>
        <Box key={`input:${widget.nodeId}:bottom`}>
          {renderContent(inputRow(edgeRow(INPUT_BORDER_BOTTOM), palette, borderCells), textAttributes, `input:${widget.nodeId}:bottom`)}
        </Box>
      </WidgetFrame>
    </WidgetScope>
  );
});

function resolveSuggestionSuffix(
  value: string,
  suggestion: string,
  suggester: Suggester | null,
  password: boolean,
): string {
  // An empty value completes nothing: `"anything".startsWith("")` is vacuously
  // true, so without this an emptied field would show the whole stale
  // suggestion glued onto the placeholder.
  //
  // A masked field shows no suffix at all rather than a masked one — the length
  // of a completion is itself a fact about the secret being typed.
  if (value.length === 0 || password) {
    return "";
  }

  const caseSensitive = suggester?.caseSensitive ?? true;
  const prefixMatches = caseSensitive
    ? suggestion.startsWith(value)
    : suggestion.toLowerCase().startsWith(value.toLowerCase());

  return prefixMatches ? suggestion.slice(value.length) : "";
}

// `styles.text` minus the two colours this widget paints itself. The cascade
// writes `color` and `backgroundColor` into it from the `color`/`background`
// rules; passing those through would fill the border columns, which Textual
// leaves transparent. Everything else — bold, italic, underline and whatever
// Ink adds next — is carried, so `Input { text-style: bold }` still applies.
function textAttributesOf(text: Partial<TextProps>): Partial<TextProps> {
  const { color, backgroundColor, ...attributes } = text;
  void color;
  void backgroundColor;
  return attributes;
}
