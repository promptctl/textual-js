import { describe, expect, it } from "vitest";
import React from "react";

import {
  Content,
  Failure,
  Input,
  InputChanged,
  InputSubmitted,
  InputValidationController,
  FunctionValidator,
  IntegerValidator,
  LengthValidator,
  NumberValidator,
  RegexValidator,
  URLValidator,
  ValidationResult,
  Validator,
  runTest,
} from "../src/index.js";

describe("ValidationResult", () => {
  it("distinguishes success from failure and merges results", () => {
    const success = ValidationResult.success();
    const failure = ValidationResult.failure([
      new Failure(new LengthValidator({ min: 5 }), { message: "too short", description: "Must be longer" }),
    ]);

    expect(success.isValid).toBe(true);
    expect(success.is_valid).toBe(true);
    expect(success.failures).toEqual([]);
    expect(failure.isValid).toBe(false);
    expect(failure.failureDescriptions).toEqual(["Must be longer"]);
    expect(failure.failure_descriptions).toEqual(["Must be longer"]);

    const merged = ValidationResult.merge([success, failure]);
    expect(merged.isValid).toBe(false);
    expect(merged.failures).toHaveLength(1);
  });

  it("merges multiple failures from different validators", () => {
    const a = ValidationResult.failure([
      new Failure(new LengthValidator(), { message: "a", description: "Error A" }),
    ]);
    const b = ValidationResult.failure([
      new Failure(new LengthValidator(), { message: "b", description: "Error B" }),
    ]);

    const merged = ValidationResult.merge([a, b]);
    expect(merged.failures).toHaveLength(2);
    expect(merged.failureDescriptions).toEqual(["Error A", "Error B"]);
  });
});

describe("NumberValidator", () => {
  it("accepts valid numbers and rejects non-numeric values", () => {
    const validator = new NumberValidator();

    expect(validator.validate("42").isValid).toBe(true);
    expect(validator.validate("-3.14").isValid).toBe(true);
    expect(validator.validate("1e5").isValid).toBe(true);
    expect(validator.validate("").isValid).toBe(false);
    expect(validator.validate("abc").isValid).toBe(false);
    expect(validator.validate("inf").isValid).toBe(false);
    expect(validator.validate("-inf").isValid).toBe(false);
    expect(validator.validate("nan").isValid).toBe(false);
    expect(validator.validate("Infinity").isValid).toBe(false);
    expect(validator.validate("NaN").isValid).toBe(false);
  });

  it("enforces min/max range constraints", () => {
    const validator = new NumberValidator({ min: 0, max: 100 });

    expect(validator.validate("50").isValid).toBe(true);
    expect(validator.validate("0").isValid).toBe(true);
    expect(validator.validate("100").isValid).toBe(true);
    expect(validator.validate("-1").isValid).toBe(false);
    expect(validator.validate("101").isValid).toBe(false);
    expect(validator.validate("-1").failureDescriptions[0]).toContain("between");
  });

  it("supports minimum/maximum aliases and returns typed range failures", () => {
    const validator = new NumberValidator({ minimum: 0, maximum: 10 });
    const result = validator.validate("99");

    expect(result.failures[0]).toBeInstanceOf(NumberValidator.NotInRange);
  });
});

describe("IntegerValidator", () => {
  it("accepts valid integers and rejects floats and non-numeric values", () => {
    const validator = new IntegerValidator();

    expect(validator.validate("42").isValid).toBe(true);
    expect(validator.validate("-7").isValid).toBe(true);
    expect(validator.validate("123_456").isValid).toBe(true);
    expect(validator.validate("3.14").isValid).toBe(false);
    expect(validator.validate("1e5").isValid).toBe(false);
    expect(validator.validate("1.").isValid).toBe(false);
    expect(validator.validate("_1").isValid).toBe(false);
    expect(validator.validate("abc").isValid).toBe(false);
    expect(validator.validate("").isValid).toBe(false);
  });

  it("enforces min/max range constraints", () => {
    const validator = new IntegerValidator({ min: 1, max: 10 });

    expect(validator.validate("5").isValid).toBe(true);
    expect(validator.validate("0").isValid).toBe(false);
    expect(validator.validate("11").isValid).toBe(false);
  });
});

describe("LengthValidator", () => {
  it("validates string length within range", () => {
    const validator = new LengthValidator({ min: 2, max: 5 });

    expect(validator.validate("ab").isValid).toBe(true);
    expect(validator.validate("abcde").isValid).toBe(true);
    expect(validator.validate("a").isValid).toBe(false);
    expect(validator.validate("abcdef").isValid).toBe(false);
  });

  it("treats empty string with no constraints as valid", () => {
    const validator = new LengthValidator();
    expect(validator.validate("").isValid).toBe(true);
  });
});

describe("RegexValidator", () => {
  it("validates against a regex pattern with full match", () => {
    const validator = new RegexValidator("\\d+");

    expect(validator.validate("123").isValid).toBe(true);
    expect(validator.validate("abc").isValid).toBe(false);
    expect(validator.validate("12abc").isValid).toBe(false);
  });
});

describe("URLValidator", () => {
  it("accepts well-formed URLs and rejects malformed ones", () => {
    const validator = new URLValidator();

    expect(validator.validate("https://example.com").isValid).toBe(true);
    expect(validator.validate("http://localhost:3000/path").isValid).toBe(true);
    expect(validator.validate("www.example.com").isValid).toBe(false);
    expect(validator.validate("").isValid).toBe(false);
    expect(validator.validate("not a url").isValid).toBe(false);
  });
});

describe("FunctionValidator", () => {
  it("delegates validation to a custom function", () => {
    const validator = new FunctionValidator(
      (value) => value.startsWith("hello"),
      "Must start with hello",
    );

    expect(validator.validate("hello world").isValid).toBe(true);
    expect(validator.validate("goodbye").isValid).toBe(false);
    expect(validator.validate("goodbye").failureDescriptions).toEqual(["Must start with hello"]);
  });
});

describe("custom failure descriptions", () => {
  it("uses constructor failureDescription over inline description", () => {
    const validator = new NumberValidator({ failureDescription: "Custom error" });

    const result = validator.validate("abc");
    expect(result.isValid).toBe(false);
    expect(result.failureDescriptions).toEqual(["Custom error"]);
  });

  it("uses describe_failure when no constructor description is provided", () => {
    class CustomValidator extends Validator<string> {
      validate(value: string): ValidationResult {
        return this.failure("invalid", value, "inline");
      }

      protected override describe_failure(): string {
        return "from describe_failure";
      }
    }

    const validator = new CustomValidator();
    expect(validator.validate("x").failureDescriptions).toEqual(["from describe_failure"]);
  });

  it("keeps constructor failureDescription ahead of describe_failure and inline descriptions", () => {
    class CustomValidator extends Validator<string> {
      validate(value: string): ValidationResult {
        return this.failure("invalid", value, "inline");
      }

      protected override describe_failure(): string {
        return "from describe_failure";
      }
    }

    const validator = new CustomValidator("from constructor");
    expect(validator.validate("x").failureDescriptions).toEqual(["from constructor"]);
  });

  it("allows Content failure descriptions", () => {
    const validator = new NumberValidator({
      failureDescription: Content.styled("Styled error", "bold red"),
    });
    const result = validator.validate("abc");

    expect(Content.fromText(result.failureDescriptions[0]).plain).toBe("Styled error");
  });
});

describe("InputValidationController", () => {
  it("normalizes validateOn defaults, combinations, empty sets, and unknown values", () => {
    const validator = new LengthValidator({ min: 2 });
    const all = new InputValidationController({ validators: [validator] });
    const changedOnly = new InputValidationController({ validators: [validator], validateOn: ["changed", "fried"] });
    const disabled = new InputValidationController({ validators: [validator], validateOn: [] });

    expect(all.validate("x", "changed")?.isValid).toBe(false);
    expect(all.validate("x", "submitted")?.isValid).toBe(false);
    expect(all.validate("x", "blur")?.isValid).toBe(false);
    expect(changedOnly.validate("x", "changed")?.isValid).toBe(false);
    expect(changedOnly.validate("x", "submitted")).toBeNull();
    expect(disabled.validate("x", "changed")).toBeNull();
  });

  it("treats empty values as valid when validEmpty is true", () => {
    const controller = new InputValidationController({
      validators: [new LengthValidator({ min: 2 })],
      validEmpty: true,
    });

    expect(controller.validate("", "changed")?.isValid).toBe(true);
  });

  it("defaults validEmpty to true and exposes the snake_case alias", () => {
    const controller = new InputValidationController({
      validators: [new LengthValidator({ min: 2 })],
    });

    expect(controller.validEmpty).toBe(true);
    expect(controller.valid_empty).toBe(true);
    expect(controller.validate("", "changed")?.isValid).toBe(true);
  });
});

describe("Input validation integration", () => {
  it("attaches validation results to changed messages and toggles validity classes", async () => {
    const changed: InputChanged[] = [];
    const session = await runTest(
      React.createElement(Input, {
        validators: [new RegexValidator("\\d+")],
        validateOn: ["changed"],
      }),
      {
        // Typing only reaches an Input that holds focus, so the app names it as
        // its auto-focus target the way a Textual app's AUTO_FOCUS selector does.
        appProps: { autoFocus: "Input" },
        messageHook: (message) => {
          if (message instanceof InputChanged) {
            changed.push(message);
          }
        },
      },
    );

    await session.pilot.type("a");

    const input = session.app.findWidgets("Input")[0]!;
    expect(changed[0]?.validationResult?.isValid).toBe(false);
    expect(changed[0]?.validation_result?.isValid).toBe(false);
    expect(input.hasClass("-invalid")).toBe(true);
    expect(input.hasClass("-valid")).toBe(false);

    session.unmount();
  });

  it("leaves changed messages inactive when validateOn excludes changed", async () => {
    const changed: InputChanged[] = [];
    const submitted: InputSubmitted[] = [];
    const session = await runTest(
      React.createElement(Input, {
        validators: [new RegexValidator("\\d+")],
        validateOn: ["submitted"],
      }),
      {
        appProps: { autoFocus: "Input" },
        messageHook: (message) => {
          if (message instanceof InputChanged) {
            changed.push(message);
          } else if (message instanceof InputSubmitted) {
            submitted.push(message);
          }
        },
      },
    );

    await session.pilot.type("a");
    const input = session.app.findWidgets("Input")[0]!;

    expect(changed[0]?.validationResult).toBeNull();
    expect(input.hasClass("-invalid")).toBe(false);

    await session.pilot.press("enter");

    expect(submitted[0]?.validationResult?.isValid).toBe(false);
    expect(input.hasClass("-invalid")).toBe(true);

    session.unmount();
  });

  it("exposes valid_empty on the live input widget and revalidates when it changes", async () => {
    const session = await runTest(
      React.createElement(Input, {
        value: "",
        validators: [new LengthValidator({ min: 2 })],
        validateOn: ["changed"],
        validEmpty: false,
      }),
    );

    const input = session.app.findWidgets("Input")[0] as {
      valid_empty: boolean;
      hasClass: (name: string) => boolean;
    };

    input.valid_empty = false;

    expect(input.hasClass("-valid")).toBe(false);
    expect(input.hasClass("-invalid")).toBe(true);

    input.valid_empty = true;

    expect(input.hasClass("-valid")).toBe(true);
    expect(input.hasClass("-invalid")).toBe(false);

    session.unmount();
  });
});
