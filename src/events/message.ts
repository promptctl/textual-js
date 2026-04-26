import { getActiveMessagePump } from "../services/concurrency.js";

let nextMessageId = 1;

export interface MessageConstructor<TMessage extends Message = Message> {
  new (...args: never[]): TMessage;
  readonly name: string;
  readonly canReplace?: boolean;
  readonly verbose?: boolean;
  readonly noDispatch?: boolean;
  readonly namespace?: string;
  readonly ALLOW_SELECTOR_MATCH?: Iterable<string>;
  readonly selectorAttribute?: string | null;
}

export interface MessageInit {
  bubble?: boolean;
  sender?: unknown;
  forwarded?: boolean;
  verbose?: boolean;
  noDispatch?: boolean;
}

export class Message {
  static readonly namespace = "";
  static readonly ALLOW_SELECTOR_MATCH = new Set<string>();
  static readonly selectorAttribute: string | null = null;
  static readonly verbose: boolean = false;

  readonly messageId = nextMessageId++;
  readonly bubble: boolean;
  readonly time = Date.now();
  readonly forwarded: boolean;
  readonly verbose: boolean;
  sender: unknown;
  private propagationStopped = false;
  private defaultPrevented = false;
  private readonly noDispatchValue: boolean;

  constructor(init: MessageInit = {}) {
    this.bubble = init.bubble ?? true;
    this.sender = init.sender ?? getActiveMessageSender();
    this.forwarded = init.forwarded ?? false;
    this.verbose = init.verbose ?? (this.constructor as MessageConstructor).verbose ?? false;
    this.noDispatchValue = init.noDispatch ?? (this.constructor as MessageConstructor).noDispatch ?? false;
  }

  get isPropagationStopped(): boolean {
    return this.propagationStopped;
  }

  get isDefaultPrevented(): boolean {
    return this.defaultPrevented;
  }

  get noDispatch(): boolean {
    return this.noDispatchValue;
  }

  get isForwarded(): boolean {
    return this.forwarded;
  }

  stop(): void {
    this.propagationStopped = true;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  setSender(sender: unknown): this {
    this.sender = sender;
    return this;
  }

  canReplace(_message: Message): boolean {
    // [LAW:one-source-of-truth] Queue coalescing defaults to one static flag on
    // the message class so built-ins and custom messages share the same contract.
    return (this.constructor as MessageConstructor).canReplace ?? false;
  }
}

export function messageHandlerNames(message: Message): string[] {
  const constructorName = message.constructor.name;
  const namespace = inferMessageNamespace(message);
  const legacyName = constructorName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
  const camelNamespace = namespace
    .split(/[_\s-]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join("");
  const snakeNamespace = namespace
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

  // [LAW:one-source-of-truth] Handler name derivation comes from the message
  // class metadata so namespaced and plain messages share one resolution path.
  return namespace.length > 0
    ? [`on${camelNamespace}${constructorName}`, `on_${snakeNamespace}_${legacyName}`, `on${constructorName}`, `on_${legacyName}`]
    : [`on${constructorName}`, `on_${legacyName}`];
}

function getActiveMessageSender(): unknown {
  try {
    return getActiveMessagePump();
  } catch {
    return null;
  }
}

function inferMessageNamespace(message: Message): string {
  const explicitNamespace = ((message.constructor as MessageConstructor).namespace ?? "").trim();

  if (explicitNamespace.length > 0) {
    return explicitNamespace;
  }

  const senderTypeName = (message.sender as { typeName?: unknown } | null)?.typeName;
  return typeof senderTypeName === "string" ? senderTypeName : "";
}
