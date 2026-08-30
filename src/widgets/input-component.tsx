// [LAW:one-way-deps] Input consumes validation and suggestion services; those
// services do not import or know about the widget component.

import React from "react";
import { Box } from "ink";
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

// [LAW:types-are-the-program] The Input installs extra members on its widget
// handle (Textual's `Input` API surface). Naming that surface lets a caller
// that queried an Input say so once, instead of reaching for `any` at the
// point of every call.
export interface InputWidget extends Widget {
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

interface InputRun {
  text: string;
  style: string;
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

// [LAW:composability] Fitting a run list to an exact cell width knows nothing
// about inputs: crop what overflows, pad what falls short. Any run list, any
// width.
function fitRuns(runs: readonly InputRun[], width: number, fillStyle: string): InputRun[] {
  let remaining = Math.max(0, width);
  const cropped = runs.map((run) => {
    const text = run.text.slice(0, remaining);
    remaining -= text.length;
    return { text, style: run.style };
  });

  return [...cropped, { text: " ".repeat(remaining), style: fillStyle }];
}

// [LAW:composability] Overlaying a one-cell style at an index is independent of
// what Input means by "cursor" — it is a run-list operation.
// [LAW:dataflow-not-control-flow] The fold runs over every run unconditionally.
// A null index is the identity overlay: it matches no cell and the list comes
// back unchanged, so an unfocused Input takes the same code path as a focused
// one and simply carries no cursor.
function overlayCell(runs: readonly InputRun[], index: number | null, style: string): InputRun[] {
  let consumed = 0;

  return runs.flatMap((run) => {
    const local = index === null ? -1 : index - consumed;
    consumed += run.text.length;

    if (local < 0 || local >= run.text.length) {
      return [run];
    }

    return [
      { text: run.text.slice(0, local), style: run.style },
      { text: run.text.slice(local, local + 1), style },
      { text: run.text.slice(local + 1), style: run.style },
    ];
  });
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
): InputRun {
  if (value.length === 0) {
    return { text: placeholder, style: `${palette.placeholder} on ${palette.background}` };
  }

  return {
    text: password ? INPUT_PASSWORD_CHARACTER.repeat(value.length) : value,
    style: `${palette.foreground} on ${palette.background}`,
  };
}

function inputBorderRuns(inner: readonly InputRun[], palette: InputPalette): InputRun[] {
  return [
    { text: INPUT_BORDER_LEFT, style: `${palette.border} reverse` },
    ...inner,
    { text: INPUT_BORDER_RIGHT, style: palette.border },
  ];
}

function renderInputRow(runs: readonly InputRun[], key: string): React.JSX.Element {
  return (
    <Box key={key}>
      {runs
        .filter((run) => run.text.length > 0)
        .map((run, index) => (
          // renderContent keys the spans it emits but not the element it
          // returns; the fragment supplies the list key React needs here.
          <React.Fragment key={`${key}:${index}`}>
            {renderContent(Content.styled(run.text, run.style), {}, `${key}:${index}`)}
          </React.Fragment>
        ))}
    </Box>
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

  if (validationControllerRef.current === undefined) {
    rebuildValidationController(validEmptyRef.current);
  } else {
    rebuildValidationController(validEmptyRef.current);
  }

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
      validate?: InputWidget["validate"];
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
  const innerWidth = Math.max(0, frameWidth - INPUT_BORDER_CELLS);
  const areaWidth = Math.max(0, innerWidth - INPUT_HORIZONTAL_PADDING * 2);
  const surfaceStyle = `on ${palette.background}`;
  const paddingRun: InputRun = { text: " ".repeat(INPUT_HORIZONTAL_PADDING), style: surfaceStyle };

  const suggestion = suggestionControllerRef.current.suggestion;
  const suffix = resolveSuggestionSuffix(modelRef.current.value, suggestion, suggester);
  const display = resolveInputDisplay(
    modelRef.current.value,
    placeholder,
    modelRef.current.password,
    palette,
  );
  // [LAW:dataflow-not-control-flow] Cursor visibility is data, not a branch:
  // an index when the widget holds focus, null when it does not. Both feed the
  // same overlay.
  const cursorIndex = widget.handle.isFocused ? modelRef.current.cursorPosition : null;
  const areaRuns = overlayCell(
    fitRuns(
      [display, { text: suffix, style: `${palette.foreground} dim ${surfaceStyle}` }],
      areaWidth,
      surfaceStyle,
    ),
    cursorIndex,
    `${palette.cursorForeground} on ${palette.cursorBackground}`,
  );
  const edgeRun = (glyph: string): InputRun => ({
    text: glyph.repeat(innerWidth),
    style: `${palette.border} ${surfaceStyle}`,
  });

  return (
    <WidgetScope widget={widget.handle}>
      {/* Every surface cell carries its own `on <background>` rather than
          relying on a container fill: Textual leaves the two border columns
          transparent (the screen shows through), which a full-width fill
          would paint over. */}
      <WidgetFrame widget={widget.handle} styles={styles} boxProps={{ flexDirection: "column" }}>
        {renderInputRow(
          inputBorderRuns([edgeRun(INPUT_BORDER_TOP)], palette),
          `input:${widget.nodeId}:top`,
        )}
        {renderInputRow(
          inputBorderRuns([paddingRun, ...areaRuns, paddingRun], palette),
          `input:${widget.nodeId}:value`,
        )}
        {renderInputRow(
          inputBorderRuns([edgeRun(INPUT_BORDER_BOTTOM)], palette),
          `input:${widget.nodeId}:bottom`,
        )}
      </WidgetFrame>
    </WidgetScope>
  );
});

function resolveSuggestionSuffix(value: string, suggestion: string, suggester: Suggester | null): string {
  const caseSensitive = suggester?.caseSensitive ?? true;
  const prefixMatches = caseSensitive
    ? suggestion.startsWith(value)
    : suggestion.toLowerCase().startsWith(value.toLowerCase());

  return prefixMatches ? suggestion.slice(value.length) : "";
}
