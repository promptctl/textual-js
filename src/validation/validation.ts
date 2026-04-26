import { Content, type ContentInput } from "../content/index.js";

export type ValidationText = Exclude<ContentInput, null | undefined>;

export interface ValidationFailureInit {
  message: ValidationText;
  value?: unknown;
  description?: ValidationText;
  validator: Validator<unknown>;
}

export class Failure {
  readonly message: ValidationText;
  readonly value: unknown;
  readonly description: ValidationText | undefined;
  readonly validator: Validator<unknown>;

  constructor(validator: Validator<unknown>, description?: ValidationText);
  constructor(validator: Validator<unknown>, init: Omit<ValidationFailureInit, "validator">);
  constructor(
    validator: Validator<unknown>,
    descriptionOrInit: ValidationText | Omit<ValidationFailureInit, "validator"> = "",
  ) {
    const init = isValidationFailureInitPayload(descriptionOrInit)
      ? descriptionOrInit
      : { message: "", description: descriptionOrInit };

    this.validator = validator;
    this.message = init.message ?? "";
    this.value = init.value;
    this.description = init.description;
  }
}

export type ValidationFailure = Failure | ValidationFailureInit;

export class ValidationResult {
  readonly failures: readonly Failure[];

  private constructor(failures: readonly Failure[]) {
    this.failures = failures;
  }

  get isValid(): boolean {
    return this.failures.length === 0;
  }

  get is_valid(): boolean {
    // [LAW:one-source-of-truth] isValid is the canonical JS result flag; the
    // snake_case Stage 6 alias derives from it so validity cannot drift.
    return this.isValid;
  }

  get failureDescriptions(): Array<ValidationText> {
    return this.failures
      .map((failure) => failure.description ?? failure.message)
      .filter((description) => describeValidationText(description).length > 0);
  }

  get failure_descriptions(): Array<ValidationText> {
    // [LAW:one-source-of-truth] failureDescriptions is the canonical JS list;
    // the snake_case Stage 6 alias delegates to the same derived descriptions.
    return this.failureDescriptions;
  }

  merge(other: ValidationResult): ValidationResult {
    return new ValidationResult([...this.failures, ...other.failures]);
  }

  static success(): ValidationResult {
    return new ValidationResult([]);
  }

  static failure(failures: ValidationFailure[]): ValidationResult {
    return new ValidationResult(failures.map(normalizeFailure));
  }

  static merge(results: ValidationResult[]): ValidationResult {
    return new ValidationResult(results.flatMap((result) => result.failures));
  }
}

export type ValidateOn = "changed" | "submitted" | "blur";

const VALIDATE_ON_VALUES = new Set<ValidateOn>(["changed", "submitted", "blur"]);
const ALL_VALIDATE_ON = new Set<ValidateOn>(["changed", "submitted", "blur"]);

export function normalizeValidateOn(validateOn?: Iterable<string> | null): ReadonlySet<ValidateOn> {
  if (validateOn === undefined || validateOn === null) {
    return new Set(ALL_VALIDATE_ON);
  }

  return new Set(
    Array.from(validateOn).filter((value): value is ValidateOn =>
      VALIDATE_ON_VALUES.has(value as ValidateOn),
    ),
  );
}

export class InputValidationController {
  readonly validators: readonly Validator<string>[];
  readonly validEmpty: boolean;
  readonly validateOn: ReadonlySet<ValidateOn>;
  lastResult: ValidationResult | null = null;

  constructor(options: {
    validators?: readonly Validator<string>[];
    validEmpty?: boolean;
    valid_empty?: boolean;
    validateOn?: Iterable<string> | null;
  } = {}) {
    this.validators = options.validators ?? [];
    this.validEmpty = options.validEmpty ?? options.valid_empty ?? true;
    this.validateOn = normalizeValidateOn(options.validateOn);
  }

  get valid_empty(): boolean {
    return this.validEmpty;
  }

  validate(value: string, event: ValidateOn): ValidationResult | null {
    const active = this.validateOn.has(event);
    const result = active ? this.validateValue(value) : null;
    this.lastResult = result;
    return result;
  }

  private validateValue(value: string): ValidationResult {
    if (value.length === 0 && this.validEmpty) {
      return ValidationResult.success();
    }

    // [LAW:single-enforcer] Input validation runs through this controller so
    // changed/submitted/blur events cannot drift in empty-value or merge rules.
    return ValidationResult.merge(this.validators.map((validator) => validator.validate(value)));
  }
}

type ValidatorOptions = {
  failureDescription?: ValidationText;
  failure_description?: ValidationText;
};

export abstract class Validator<T = string> {
  readonly failureDescription: ValidationText | undefined;

  constructor(failureDescription?: ValidationText);
  constructor(options?: ValidatorOptions);
  constructor(failureDescriptionOrOptions?: ValidationText | ValidatorOptions) {
    if (!isValidatorOptions(failureDescriptionOrOptions)) {
      this.failureDescription = failureDescriptionOrOptions;
      return;
    }

    this.failureDescription = failureDescriptionOrOptions.failureDescription ?? failureDescriptionOrOptions.failure_description;
  }

  get failure_description(): ValidationText | undefined {
    return this.failureDescription;
  }

  abstract validate(value: T): ValidationResult;

  protected success(): ValidationResult {
    return ValidationResult.success();
  }

  protected failure(message: ValidationText, value?: T, description?: ValidationText): ValidationResult {
    const unresolved = new Failure(this as Validator<unknown>, { message, value, description });
    const resolvedDescription =
      this.failureDescription ??
      this.describeFailure(unresolved) ??
      unresolved.description ??
      unresolved.message;

    return ValidationResult.failure([
      new Failure(this as Validator<unknown>, {
        message: unresolved.message,
        value: unresolved.value,
        description: resolvedDescription,
      }),
    ]);
  }

  protected describe_failure(_failure: Failure): ValidationText | undefined {
    return undefined;
  }

  protected describeFailure(failure: Failure): ValidationText | undefined {
    return this.describe_failure(failure);
  }
}

type RangeValidatorOptions = ValidatorOptions & {
  min?: number;
  max?: number;
  minimum?: number;
  maximum?: number;
};

export class NumberValidator extends Validator<string> {
  static readonly InvalidValue = class NumberInvalidValue extends Failure {};

  static readonly NotInRange = class NumberNotInRange extends Failure {
    readonly minimum: number | undefined;
    readonly maximum: number | undefined;

    constructor(
      validator: Validator<unknown>,
      value: unknown,
      minimum: number | undefined,
      maximum: number | undefined,
      description: ValidationText,
    ) {
      super(validator, {
        message: "Must be a valid number.",
        value,
        description,
      });
      this.minimum = minimum;
      this.maximum = maximum;
    }
  };

  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: RangeValidatorOptions = {}) {
    super(options);
    // [LAW:one-source-of-truth] minimum/maximum are the canonical range
    // fields; min/max are accepted only as constructor aliases for Stage 6.
    this.minimum = options.minimum ?? options.min;
    this.maximum = options.maximum ?? options.max;
  }

  validate(value: string): ValidationResult {
    const trimmed = value.trim();

    if (trimmed === "" || trimmed === "inf" || trimmed === "-inf" || trimmed === "nan" || trimmed === "Infinity" || trimmed === "-Infinity" || trimmed === "NaN") {
      return ValidationResult.failure([
        new NumberValidator.InvalidValue(this, {
          message: "Must be a valid number.",
          value,
          description: this.failureDescription ?? "Must be a valid number.",
        }),
      ]);
    }

    const number = Number(trimmed);

    if (!Number.isFinite(number)) {
      return ValidationResult.failure([
        new NumberValidator.InvalidValue(this, {
          message: "Must be a valid number.",
          value,
          description: this.failureDescription ?? "Must be a valid number.",
        }),
      ]);
    }

    if (this.minimum !== undefined && number < this.minimum) {
      return ValidationResult.failure([
        new NumberValidator.NotInRange(this, value, this.minimum, this.maximum, resolveRangeDescription(this)),
      ]);
    }

    if (this.maximum !== undefined && number > this.maximum) {
      return ValidationResult.failure([
        new NumberValidator.NotInRange(this, value, this.minimum, this.maximum, resolveRangeDescription(this)),
      ]);
    }

    return this.success();
  }
}

export class IntegerValidator extends Validator<string> {
  static readonly InvalidValue = class IntegerInvalidValue extends Failure {};

  static readonly NotInRange = class IntegerNotInRange extends Failure {
    readonly minimum: number | undefined;
    readonly maximum: number | undefined;

    constructor(
      validator: Validator<unknown>,
      value: unknown,
      minimum: number | undefined,
      maximum: number | undefined,
      description: ValidationText,
    ) {
      super(validator, {
        message: "Must be a valid integer.",
        value,
        description,
      });
      this.minimum = minimum;
      this.maximum = maximum;
    }
  };

  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: RangeValidatorOptions = {}) {
    super(options);
    // [LAW:one-source-of-truth] minimum/maximum are the canonical range
    // fields; min/max are accepted only as constructor aliases for Stage 6.
    this.minimum = options.minimum ?? options.min;
    this.maximum = options.maximum ?? options.max;
  }

  validate(value: string): ValidationResult {
    const raw = value.trim();
    const unsigned = raw.replace(/^-/, "");

    if (
      raw === "" ||
      raw.includes(".") ||
      /[eE]/.test(raw) ||
      !/^-?[\d_]+$/.test(raw) ||
      unsigned.startsWith("_") ||
      unsigned.endsWith("_")
    ) {
      return ValidationResult.failure([
        new IntegerValidator.InvalidValue(this, {
          message: "Must be a valid integer.",
          value,
          description: this.failureDescription ?? "Must be a valid integer.",
        }),
      ]);
    }

    const trimmed = raw.replace(/_/g, "");
    const number = Number(trimmed);

    if (!Number.isInteger(number)) {
      return ValidationResult.failure([
        new IntegerValidator.InvalidValue(this, {
          message: "Must be a valid integer.",
          value,
          description: this.failureDescription ?? "Must be a valid integer.",
        }),
      ]);
    }

    if (this.minimum !== undefined && number < this.minimum) {
      return ValidationResult.failure([
        new IntegerValidator.NotInRange(this, value, this.minimum, this.maximum, resolveRangeDescription(this)),
      ]);
    }

    if (this.maximum !== undefined && number > this.maximum) {
      return ValidationResult.failure([
        new IntegerValidator.NotInRange(this, value, this.minimum, this.maximum, resolveRangeDescription(this)),
      ]);
    }

    return this.success();
  }
}

export class LengthValidator extends Validator<string> {
  readonly minimum: number | undefined;
  readonly maximum: number | undefined;

  constructor(options: RangeValidatorOptions = {}) {
    super(options);
    this.minimum = options.minimum ?? options.min;
    this.maximum = options.maximum ?? options.max;
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

  constructor(pattern: string | RegExp, failureDescription?: ValidationText);
  constructor(pattern: string | RegExp, options?: ValidatorOptions);
  constructor(pattern: string | RegExp, failureDescriptionOrOptions?: ValidationText | ValidatorOptions) {
    super(failureDescriptionOrOptions as ValidatorOptions & ValidationText);
    this.pattern = typeof pattern === "string" ? new RegExp(`^(?:${pattern})$`) : pattern;
  }

  validate(value: string): ValidationResult {
    return this.pattern.test(value)
      ? this.success()
      : this.failure("Value does not match the required pattern.", value);
  }
}

export class URLValidator extends Validator<string> {
  constructor(failureDescription?: ValidationText);
  constructor(options?: ValidatorOptions);
  constructor(failureDescriptionOrOptions?: ValidationText | ValidatorOptions) {
    super(failureDescriptionOrOptions as ValidatorOptions & ValidationText);
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

  constructor(fn: (value: string) => boolean, failureDescription?: ValidationText);
  constructor(fn: (value: string) => boolean, options?: ValidatorOptions);
  constructor(fn: (value: string) => boolean, failureDescriptionOrOptions?: ValidationText | ValidatorOptions) {
    super(failureDescriptionOrOptions as ValidatorOptions & ValidationText);
    this.fn = fn;
  }

  validate(value: string): ValidationResult {
    return this.fn(value)
      ? this.success()
      : this.failure("Validation failed.", value);
  }
}

function normalizeFailure(failure: ValidationFailure): Failure {
  return failure instanceof Failure ? failure : new Failure(failure.validator, failure);
}

function describeValidationText(value: ValidationText): string {
  return typeof value === "string" ? value : Content.fromText(value).plain;
}

function resolveRangeDescription(validator: { minimum: number | undefined; maximum: number | undefined; failureDescription?: ValidationText }): ValidationText {
  return validator.failureDescription ?? `Must be between ${validator.minimum ?? "-∞"} and ${validator.maximum ?? "∞"}.`;
}

function isValidationFailureInitPayload(
  value: ValidationText | Omit<ValidationFailureInit, "validator">,
): value is Omit<ValidationFailureInit, "validator"> {
  return typeof value === "object" && value !== null && "message" in value;
}

function isValidatorOptions(value: ValidationText | ValidatorOptions | undefined): value is ValidatorOptions {
  return typeof value === "object" && value !== null && !(value instanceof Content);
}
