import { describe, expect, it } from "vitest";

import {
  FunctionValidator,
  IntegerValidator,
  LengthValidator,
  NumberValidator,
  RegexValidator,
  URLValidator,
  ValidationResult,
} from "../src/index.js";

describe("ValidationResult", () => {
  it("distinguishes success from failure and merges results", () => {
    const success = ValidationResult.success();
    const failure = ValidationResult.failure([
      { message: "too short", description: "Must be longer", validator: new LengthValidator({ min: 5 }) },
    ]);

    expect(success.isValid).toBe(true);
    expect(success.failures).toEqual([]);
    expect(failure.isValid).toBe(false);
    expect(failure.failureDescriptions).toEqual(["Must be longer"]);

    const merged = ValidationResult.merge([success, failure]);
    expect(merged.isValid).toBe(false);
    expect(merged.failures).toHaveLength(1);
  });

  it("merges multiple failures from different validators", () => {
    const a = ValidationResult.failure([
      { message: "a", description: "Error A", validator: new LengthValidator() },
    ]);
    const b = ValidationResult.failure([
      { message: "b", description: "Error B", validator: new LengthValidator() },
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
});
