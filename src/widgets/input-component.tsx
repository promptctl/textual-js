// [LAW:one-way-deps] Input consumes validation and suggestion services; those
// services do not import or know about the widget component.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";
import { Key } from "../events/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { mixColor } from "../styles/index.js";
import { InputValidationController, type ValidateOn, type ValidationResult, type Validator } from "../validation/index.js";
import { SuggestionController, type Suggester } from "../suggestions/index.js";
import { composeWidgetClasses, type WidgetComponentProps } from "./component-pattern.js";
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

const INPUT_BINDINGS = [
  { key: "left", action: "cursor_left" },
  { key: "right", action: "cursor_right" },
  { key: "home", action: "home" },
  { key: "end", action: "end" },
  { key: "backspace", action: "delete_left" },
  { key: "delete", action: "delete_right" },
];

// [LAW:one-source-of-truth] Input's default visual contract lives in TCSS.
// Render code reads cursor colors from the resolved cascade instead of
// duplicating theme literals beside the widget markup.
const DEFAULT_CSS = `
  Input {
    width: 100w;
    height: 3;
    padding: 0 2;
    background: #1e1e1e;
    color: #e0e0e0;
    border: tall #181818;
    --input-cursor-color: #121212;
    --input-cursor-background: #e0e0e0;
  }
  Input:focus {
    background: #272727;
    border: tall #0178d4;
  }
  Input.-invalid {
    border: tall #b93c5b;
  }
`;

const PASSWORD_MASK = "•";
const TEXT_DISABLED_MIX = 0.378;

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
    modelRef.current = new InputModel({ value, placeholder, type, restrict, maxLength, password });
  }
  modelRef.current.placeholder = placeholder;

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

  const recomputeValidationState = React.useCallback((): ValidationResult => {
    const controller = new InputValidationController({
      validators: validatorsRef.current,
      validEmpty: validEmptyRef.current,
      validateOn: ["changed", "submitted", "blur"],
    });
    return controller.validate(modelRef.current!.value, "changed")!;
  }, []);

  const applyValidation = React.useCallback((event: ValidateOn) => {
    const result = validationControllerRef.current!.validate(modelRef.current!.value, event);
    syncValidationClasses(result);
    return result;
  }, [syncValidationClasses]);

  React.useLayoutEffect(() => {
    // [LAW:single-enforcer] The validation controller owns validity classes
    // for both initial data and later events; fixtures do not carry duplicate
    // imperative setup just to expose an invalid initial value.
    const result = validationControllerRef.current!.validate(modelRef.current!.value, "changed");
    syncValidationClasses(result);
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
    };

    Object.defineProperties(inputHandle, {
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
  }, [rebuildValidationController, recomputeValidationState, syncValidationClasses, widget.handle]);

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

  if (!widget.lifecycleReady) {
    return <WidgetScope widget={widget.handle}><></></WidgetScope>;
  }

  const displayValue = modelRef.current.password
    ? PASSWORD_MASK.repeat(modelRef.current.value.length)
    : modelRef.current.value;
  const suggestion = suggestionControllerRef.current.suggestion;
  const suffix = resolveSuggestionSuffix(modelRef.current.value, suggestion, suggester);
  const width = readNumericBoxValue(styles.box.width) ?? 80;
  const paddingLeft = readNumericBoxValue(styles.box.paddingLeft) ?? 0;
  const paddingRight = readNumericBoxValue(styles.box.paddingRight) ?? 0;
  const background = styles.getColor("background");
  const foreground = styles.getColor("color");
  const border = typeof styles.box.borderColor === "string" ? styles.box.borderColor : background;
  const content = buildInputContent(
    displayValue,
    modelRef.current.placeholder,
    modelRef.current.cursorPosition,
    suffix,
    widget.handle.isFocused,
    {
      foreground,
      background,
      color: styles.getCustomColor("--input-cursor-color"),
      cursorBackground: styles.getCustomColor("--input-cursor-background"),
    },
  );
  const rows = renderInputRows(content, {
    width,
    paddingLeft,
    paddingRight,
    background,
    border,
    quietBorder: border === "#181818",
    nodeId: widget.nodeId,
  });

  return (
    <WidgetScope widget={widget.handle}>
      <Box flexDirection="column">{rows}</Box>
    </WidgetScope>
  );
});

interface CursorPalette {
  foreground: string;
  background: string;
  color: string;
  cursorBackground: string;
}

interface InputRowsOptions {
  width: number;
  paddingLeft: number;
  paddingRight: number;
  background: string;
  border: string;
  quietBorder: boolean;
  nodeId: string;
}

function readNumericBoxValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildInputContent(
  displayValue: string,
  placeholder: string,
  cursorPosition: number,
  suggestionSuffix: string,
  focused: boolean,
  cursor: CursorPalette,
): Content {
  const textStyle = `${cursor.foreground} on ${cursor.background}`;
  const placeholderStyle = `${mixColor(cursor.background, "#ffffff", TEXT_DISABLED_MIX)} on ${cursor.background}`;
  const placeholderActive = displayValue.length === 0 && placeholder.length > 0;
  const visibleValue = placeholderActive ? placeholder : displayValue;
  const base = Content.styled(visibleValue, placeholderActive ? placeholderStyle : textStyle);
  const content = Content.assemble(
    base,
    suggestionSuffix.length === 0 || placeholderActive ? "" : Content.styled(suggestionSuffix, placeholderStyle),
  );

  if (!focused) {
    return content;
  }

  const cursorIndex = placeholderActive ? 0 : cursorPosition;
  const cursorGlyph = visibleValue[cursorIndex] ?? " ";

  // [LAW:dataflow-not-control-flow] Focus changes the cursor segment data;
  // the surrounding Input frame and content assembly path stay unchanged.
  return Content.assemble(
    Content.styled(content.plain.slice(0, cursorIndex), placeholderActive ? placeholderStyle : textStyle),
    Content.styled(cursorGlyph, `${cursor.color} on ${cursor.cursorBackground}`),
    Content.styled(content.plain.slice(cursorIndex + cursorGlyph.length), placeholderActive ? placeholderStyle : textStyle),
  );
}

function renderInputRows(content: Content, options: InputRowsOptions): React.JSX.Element[] {
  const clampedWidth = Math.max(2, options.width);
  const contentWidth = Math.max(0, clampedWidth - 2 - options.paddingLeft - options.paddingRight);
  const visibleContent = content.truncate(contentWidth, { overflow: "crop" });
  const fillWidth = Math.max(0, contentWidth - visibleContent.cellLength);
  const surfaceStyle = `on ${options.background}`;
  const borderStyle = `${options.border}`;
  const activeBorderStyle = `${options.border} on ${options.background}`;
  const edgeStyle = `${options.border} on ${options.background}`;
  // [LAW:dataflow-not-control-flow] The same three-row renderer runs for
  // plain, focused, and invalid inputs. Border intensity is row data: the
  // default state paints only edge cells, while focused/invalid states paint
  // the whole tall border row.
  const top = options.quietBorder
    ? Content.assemble(Content.styled("▊", borderStyle), Content.blank(clampedWidth - 2, surfaceStyle), Content.styled("▎", borderStyle))
    : Content.assemble(Content.styled("▊", activeBorderStyle), Content.styled("▔".repeat(clampedWidth - 2), activeBorderStyle), Content.styled("▎", activeBorderStyle));
  const middle = Content.assemble(
    Content.styled("▊", edgeStyle),
    Content.blank(options.paddingLeft, surfaceStyle),
    visibleContent,
    Content.blank(fillWidth, surfaceStyle),
    Content.blank(options.paddingRight, surfaceStyle),
    Content.styled("▎", edgeStyle),
  );
  const bottom = options.quietBorder
    ? Content.assemble(Content.styled("▊", borderStyle), Content.blank(clampedWidth - 2, surfaceStyle), Content.styled("▎", borderStyle))
    : Content.assemble(Content.styled("▊", activeBorderStyle), Content.styled("▁".repeat(clampedWidth - 2), activeBorderStyle), Content.styled("▎", activeBorderStyle));

  return [top, middle, bottom].map((row, index) => (
    <Box key={`input:${options.nodeId}:row:${index}`}>
      {renderContent(row, {}, `input:${options.nodeId}:row:${index}`, clampedWidth)}
    </Box>
  ));
}

function resolveSuggestionSuffix(value: string, suggestion: string, suggester: Suggester | null): string {
  const caseSensitive = suggester?.caseSensitive ?? true;
  const prefixMatches = caseSensitive
    ? suggestion.startsWith(value)
    : suggestion.toLowerCase().startsWith(value.toLowerCase());

  return prefixMatches ? suggestion.slice(value.length) : "";
}
