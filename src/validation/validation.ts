// [LAW:one-type-per-behavior] All validators share one base class and one
// result type. Built-in validators are instances of this one type hierarchy.

export interface ValidationFailure {
  message: string;
  value?: unknown;
  description?: string;
  validator: Validator<unknown>;
}

export class ValidationResult {
  readonly failures: readonly ValidationFailure[];

  private constructor(failures: readonly ValidationFailure[]) {
    this.failures = failures;
  }

  get isValid(): boolean {
    return this.failures.length === 0;
  }

  get failureDescriptions(): string[] {
    return this.failures
      .map((failure) => failure.description ?? failure.message)
      .filter((description) => description.length > 0);
  }

  merge(other: ValidationResult): ValidationResult {
    return new ValidationResult([...this.failures, ...other.failures]);
  }

  static success(): ValidationResult {
    return new ValidationResult([]);
  }

  static failure(failures: ValidationFailure[]): ValidationResult {
    return new ValidationResult(failures);
  }

  static merge(results: ValidationResult[]): ValidationResult {
    const failures = results.flatMap((result) => result.failures);
    return new ValidationResult(failures);
  }
}

export abstract class Validator<T = string> {
  readonly failureDescription: string | undefined;

  constructor(failureDescription?: string) {
    this.failureDescription = failureDescription;
  }

  abstract validate(value: T): ValidationResult;

  protected success(): ValidationResult {
    return ValidationResult.success();
  }

  protected failure(message: string, value?: T, description?: string): ValidationResult {
    // [LAW:dataflow-not-control-flow] Description resolution always runs through
    // the same priority chain: constructor > describeFailure > inline.
    const resolvedDescription =
      this.failureDescription ?? this.describeFailure(message, value) ?? description ?? message;

    return ValidationResult.failure([
      {
        message,
        value,
        description: resolvedDescription,
        validator: this,
      },
    ]);
  }

  protected describeFailure(_message: string, _value?: T): string | undefined {
    return undefined;
  }
}

export class NumberValidator extends Validator<string> {
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: { min?: number; max?: number; failureDescription?: string } = {}) {
    super(options.failureDescription);
    this.minimum = options.min;
    this.maximum = options.max;
  }

  validate(value: string): ValidationResult {
    const trimmed = value.trim();

    if (trimmed === "" || trimmed === "inf" || trimmed === "-inf" || trimmed === "nan" || trimmed === "Infinity" || trimmed === "-Infinity" || trimmed === "NaN") {
      return this.failure("Must be a valid number.", value);
    }

    const number = Number(trimmed);

    if (!Number.isFinite(number)) {
      return this.failure("Must be a valid number.", value);
    }

    if (this.minimum !== undefined && number < this.minimum) {
      return this.failure(`Must be between ${this.minimum} and ${this.maximum ?? "∞"}.`, value);
    }

    if (this.maximum !== undefined && number > this.maximum) {
      return this.failure(`Must be between ${this.minimum ?? "-∞"} and ${this.maximum}.`, value);
    }

    return this.success();
  }
}

export class IntegerValidator extends Validator<string> {
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: { min?: number; max?: number; failureDescription?: string } = {}) {
    super(options.failureDescription);
    this.minimum = options.min;
    this.maximum = options.max;
  }

  validate(value: string): ValidationResult {
    const trimmed = value.trim().replace(/_/g, "");

    if (trimmed === "" || !/^-?\d+$/.test(trimmed)) {
      return this.failure("Must be a valid integer.", value);
    }

    const number = Number(trimmed);

    if (!Number.isInteger(number)) {
      return this.failure("Must be a valid integer.", value);
    }

    if (this.minimum !== undefined && number < this.minimum) {
      return this.failure(`Must be between ${this.minimum} and ${this.maximum ?? "∞"}.`, value);
    }

    if (this.maximum !== undefined && number > this.maximum) {
      return this.failure(`Must be between ${this.minimum ?? "-∞"} and ${this.maximum}.`, value);
    }

    return this.success();
  }
}

export class LengthValidator extends Validator<string> {
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: { min?: number; max?: number; failureDescription?: string } = {}) {
    super(options.failureDescription);
    this.minimum = options.min;
    this.maximum = options.max;
  }

  validate(value: string): ValidationResult {
    if (this.minimum !== undefined && value.length < this.minimum) {
      return this.failure(`Must be at least ${this.minimum} characters.`, value);
    }

    if (this.maximum !== undefined && value.length > this.maximum) {
      return this.failure(`Must be at most ${this.maximum} characters.`, value);
    }

    return this.success();
  }
}

export class RegexValidator extends Validator<string> {
  readonly pattern: RegExp;

  constructor(pattern: string | RegExp, failureDescription?: string) {
    super(failureDescription);
    this.pattern = typeof pattern === "string" ? new RegExp(`^(?:${pattern})$`) : pattern;
  }

  validate(value: string): ValidationResult {
    return this.pattern.test(value)
      ? this.success()
      : this.failure("Value does not match the required pattern.", value);
  }
}

export class URLValidator extends Validator<string> {
  constructor(failureDescription?: string) {
    super(failureDescription);
  }

  validate(value: string): ValidationResult {
    try {
      const url = new URL(value);
      return url.protocol.length > 0 && url.hostname.length > 0
        ? this.success()
        : this.failure("Must be a valid URL.", value);
    } catch {
      return this.failure("Must be a valid URL.", value);
    }
  }
}

export class FunctionValidator extends Validator<string> {
  private readonly fn: (value: string) => boolean;

  constructor(fn: (value: string) => boolean, failureDescription?: string) {
    super(failureDescription);
    this.fn = fn;
  }

  validate(value: string): ValidationResult {
    return this.fn(value)
      ? this.success()
      : this.failure("Validation failed.", value);
  }
}
