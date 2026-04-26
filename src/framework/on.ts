import type { Message, MessageConstructor } from "../events/message.js";
import { InvalidQueryFormat, type ParsedSelector, parseSelectorList } from "../styles/selectors.js";
import type { WidgetHandlers, WidgetMessageHandler } from "./widget-registry.js";

const ON_HANDLER_METADATA = Symbol("textual.on-handler");
let nextRegistrationOrder = 1;

type SelectorAttributeSource = Iterable<string> | undefined;

export interface OnOptions {
  [attribute: string]: string;
}

export interface OnHandlerRegistration<TMessage extends Message = Message> {
  messageType: MessageConstructor<TMessage>;
  selector: ParsedSelector[] | null;
  attributeSelectors: ReadonlyMap<string, ParsedSelector[]>;
  order: number;
}

export interface OnHandlerCandidate {
  identity: WidgetMessageHandler;
  callable: WidgetMessageHandler;
  registrations: readonly OnHandlerRegistration[];
}

interface DecoratedHandler<TMessage extends Message = Message> extends WidgetMessageHandler<TMessage> {
  [ON_HANDLER_METADATA]?: OnHandlerRegistration<TMessage>[];
}

export class OnDecoratorError extends Error {}

type OnDecorator = <
  TTarget extends object,
  TValue extends WidgetMessageHandler,
>(
  target: TTarget,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<TValue>,
) => TypedPropertyDescriptor<TValue>;

export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  handler: WidgetMessageHandler<TMessage>,
): WidgetMessageHandler<TMessage>;
export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  selector: string,
  handler: WidgetMessageHandler<TMessage>,
): WidgetMessageHandler<TMessage>;
export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  options: OnOptions,
  handler: WidgetMessageHandler<TMessage>,
): WidgetMessageHandler<TMessage>;
export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  selector?: string,
): OnDecorator;
export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  options?: OnOptions,
): OnDecorator;
export function on<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  selectorOrOptions?: OnOptions | string | WidgetMessageHandler<TMessage>,
  maybeHandler?: WidgetMessageHandler<TMessage>,
): OnDecorator | WidgetMessageHandler<TMessage> {
  const registration = createRegistration(messageType, selectorOrOptions, maybeHandler);

  if (typeof maybeHandler === "function" || typeof selectorOrOptions === "function") {
    const handler = (maybeHandler ?? selectorOrOptions) as WidgetMessageHandler<TMessage>;
    return attachRegistration(handler, registration);
  }

  return <TTarget extends object, TValue extends WidgetMessageHandler>(
    _target: TTarget,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<TValue>,
  ): TypedPropertyDescriptor<TValue> => {
    if (typeof descriptor.value !== "function") {
      throw new OnDecoratorError("The on() decorator can only be applied to methods.");
    }

    descriptor.value = attachRegistration(descriptor.value, registration) as TValue;
    return descriptor;
  };
}

export function discoverOnHandlers(handlers: WidgetHandlers | undefined): OnHandlerCandidate[] {
  if (handlers === undefined) {
    return [];
  }

  const discovered: OnHandlerCandidate[] = [];
  let current: object | null = handlers;

  while (current !== null && current !== Object.prototype) {
    for (const propertyName of Object.getOwnPropertyNames(current)) {
      if (propertyName === "constructor") {
        continue;
      }

      const value = Object.getOwnPropertyDescriptor(current, propertyName)?.value;

      if (typeof value !== "function") {
        continue;
      }

      const registrations = getOnHandlerRegistrations(value);

      if (registrations.length === 0) {
        continue;
      }

      // [LAW:one-source-of-truth] Every handler invocation is rebound from the
      // original function object so decorator metadata and callable behavior
      // travel together across plain objects and prototype methods.
      discovered.push({
        identity: value,
        callable: value.bind(handlers) as WidgetMessageHandler,
        registrations,
      });
    }

    current = Object.getPrototypeOf(current);
  }

  return discovered;
}

export function resolveNamedHandler(handlers: WidgetHandlers | undefined, name: string): OnHandlerCandidate | null {
  if (handlers === undefined) {
    return null;
  }

  let current: object | null = handlers;

  while (current !== null && current !== Object.prototype) {
    const value = Object.getOwnPropertyDescriptor(current, name)?.value;

    if (typeof value === "function") {
      return {
        identity: value,
        callable: value.bind(handlers) as WidgetMessageHandler,
        registrations: getOnHandlerRegistrations(value),
      };
    }

    current = Object.getPrototypeOf(current);
  }

  return null;
}

function createRegistration<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  selectorOrOptions?: OnOptions | string | WidgetMessageHandler<TMessage>,
  maybeHandler?: WidgetMessageHandler<TMessage>,
): OnHandlerRegistration<TMessage> {
  const selectorInput = typeof selectorOrOptions === "string" ? selectorOrOptions : null;
  const optionsInput =
    typeof selectorOrOptions === "object" && selectorOrOptions !== null && maybeHandler !== undefined
      ? selectorOrOptions
      : {};

  return {
    messageType,
    selector: parseControlSelector(messageType, selectorInput),
    attributeSelectors: parseAttributeSelectors(messageType, optionsInput),
    order: nextRegistrationOrder++,
  };
}

function attachRegistration<TMessage extends Message>(
  handler: WidgetMessageHandler<TMessage>,
  registration: OnHandlerRegistration<TMessage>,
): WidgetMessageHandler<TMessage> {
  const decoratedHandler = handler as DecoratedHandler<TMessage>;
  const existing = decoratedHandler[ON_HANDLER_METADATA] ?? [];

  decoratedHandler[ON_HANDLER_METADATA] = [...existing, registration];
  return handler;
}

function getOnHandlerRegistrations(handler: unknown): readonly OnHandlerRegistration[] {
  if (typeof handler !== "function") {
    return [];
  }

  return (handler as DecoratedHandler)[ON_HANDLER_METADATA] ?? [];
}

function parseSelectorValue(selector: string | null): ParsedSelector[] | null {
  if (selector === null) {
    return null;
  }

  try {
    return parseSelectorList(selector);
  } catch (error) {
    if (error instanceof InvalidQueryFormat) {
      throw new OnDecoratorError(error.message);
    }

    throw error;
  }
}

function parseControlSelector<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  selector: string | null,
): ParsedSelector[] | null {
  if (selector !== null && getSelectorAttribute(messageType) === null) {
    // [LAW:single-enforcer] Positional selector eligibility is validated at
    // registration time from message-class metadata so dispatch stays simple.
    throw new OnDecoratorError(
      `Message ${messageType.name} does not expose a selector target for positional on() matching.`,
    );
  }

  return parseSelectorValue(selector);
}


function parseAttributeSelectors<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
  options: OnOptions,
): ReadonlyMap<string, ParsedSelector[]> {
  const allowedAttributes = new Set(getAllowedSelectorAttributes(messageType));
  const entries = Object.entries(options).map(([attribute, selector]) => {
    if (!allowedAttributes.has(attribute)) {
      throw new OnDecoratorError(
        `Message ${messageType.name} does not allow selector matching on "${attribute}".`,
      );
    }

    return [attribute, parseSelectorValue(selector) ?? []] as const;
  });

  return new Map(entries);
}

function getAllowedSelectorAttributes<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
): SelectorAttributeSource {
  return (messageType as MessageConstructor<TMessage> & { ALLOW_SELECTOR_MATCH?: SelectorAttributeSource })
    .ALLOW_SELECTOR_MATCH;
}

export function getSelectorAttribute<TMessage extends Message>(
  messageType: MessageConstructor<TMessage>,
): string | null {
  return (messageType as MessageConstructor<TMessage> & { selectorAttribute?: string | null }).selectorAttribute ?? null;
}
