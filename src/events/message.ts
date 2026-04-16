let nextMessageId = 1;

export interface MessageConstructor<TMessage extends Message = Message> {
  new (...args: never[]): TMessage;
  readonly name: string;
  readonly noDispatch?: boolean;
}

export interface MessageInit {
  bubble?: boolean;
  sender?: unknown;
  forwarded?: boolean;
  noDispatch?: boolean;
}

export class Message {
  readonly messageId = nextMessageId++;
  readonly bubble: boolean;
  readonly time = Date.now();
  readonly forwarded: boolean;
  sender: unknown;
  private propagationStopped = false;
  private defaultPrevented = false;
  private readonly noDispatchValue: boolean;

  constructor(init: MessageInit = {}) {
    this.bubble = init.bubble ?? true;
    this.sender = init.sender ?? null;
    this.forwarded = init.forwarded ?? false;
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
    return false;
  }
}

export function messageHandlerNames(message: Message): string[] {
  const constructorName = message.constructor.name;
  const legacyName = constructorName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

  return [`on${constructorName}`, `on_${legacyName}`];
}
