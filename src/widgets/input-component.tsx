// [LAW:one-way-deps] Input consumes validation and suggestion services; those
// services do not import or know about the widget component.

import React from "react";
import { Box } from "ink";
import { observer } from "mobx-react-lite";

import { Content, renderContent } from "../content/index.js";
import { Key, Paste } from "../events/index.js";
import { WidgetScope, useStyles, useWidget } from "../framework/context.js";
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
  borderTitle,
  borderSubtitle,
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

  function handleInputPaste(message: Paste): void {
    const model = modelRef.current!;
    message.stop();

    if (message.text.length > 0 && model.insert(message.text)) {
      postChanged();
      forceRender();
    }
  }

  const displayValue = modelRef.current.password
    ? "*".repeat(modelRef.current.value.length)
    : modelRef.current.value;
  const suggestion = suggestionControllerRef.current.suggestion;
  const suffix = resolveSuggestionSuffix(modelRef.current.value, suggestion, suggester);
  const content = Content.assemble(
    displayValue,
    suffix.length === 0 ? "" : Content.styled(suffix, "dim"),
  );

  return (
    <WidgetScope widget={widget.handle}>
      <WidgetFrame widget={widget.handle} styles={styles}>
        {renderContent(content, styles.text, `input:${widget.nodeId}`)}
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
