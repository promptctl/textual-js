// [LAW:one-way-deps] Input consumes validation and suggestion services; those
// services do not import or know about the widget component.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";
import { Key } from "../events/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
import { InputValidationController, type ValidateOn, type Validator } from "../validation/index.js";
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

// [LAW:single-enforcer] InputChanged/InputSubmitted and validity classes are
// produced by this component after the model mutates; callers do not post them.
export const Input = observer(function Input({
  id,
  classes,
  value = "",
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

  if (modelRef.current === undefined) {
    modelRef.current = new InputModel({ value, type, restrict, maxLength, password });
  }

  if (suggestionControllerRef.current === undefined) {
    suggestionControllerRef.current = new SuggestionController(suggester);
  }

  const validation = React.useMemo(
    () =>
      new InputValidationController({
        validators,
        validEmpty: validEmpty ?? valid_empty ?? false,
        validateOn: validateOn ?? validate_on,
      }),
    [validEmpty, valid_empty, validateOn, validate_on, validators],
  );
  const widget = useWidget({
    id,
    classes: composeWidgetClasses(classes),
    typeName: "Input",
    focusable: true,
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
  });
  const styles = useStyles(widget.handle);

  const applyValidation = React.useCallback((event: ValidateOn) => {
    const result = validation.validate(modelRef.current!.value, event);

    if (result === null) {
      return result;
    }

    widget.handle.toggleClass("-valid", result.isValid);
    widget.handle.toggleClass("-invalid", !result.isValid);
    return result;
  }, [validation, widget.handle]);

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

  const displayValue = modelRef.current.password
    ? "*".repeat(modelRef.current.value.length)
    : modelRef.current.value;
  const suggestion = suggestionControllerRef.current.suggestion;
  const suffix = suggestion.startsWith(modelRef.current.value)
    ? suggestion.slice(modelRef.current.value.length)
    : "";
  const content = Content.assemble(
    displayValue,
    suffix.length === 0 ? "" : Content.styled(suffix, "dim"),
  );

  return (
    <WidgetScope widget={widget.handle}>
      <Box {...styles.box}>
        {renderContent(content, styles.text, `input:${widget.nodeId}`)}
      </Box>
    </WidgetScope>
  );
});
