let nextMessageId = 1;

export interface MessageConstructor<TMessage extends Message = Message> {
  new (...args: never[]): TMessage;
  readonly name: string;
}

export interface MessageInit {
  bubble?: boolean;
  sender?: unknown;
}

export class Message {
  readonly messageId = nextMessageId++;
  readonly bubble: boolean;
  sender: unknown;
  private propagationStopped = false;
  private defaultPrevented = false;

  constructor(init: MessageInit = {}) {
    this.bubble = init.bubble ?? true;
    this.sender = init.sender ?? null;
  }

  get isPropagationStopped(): boolean {
    return this.propagationStopped;
  }

  get isDefaultPrevented(): boolean {
    return this.defaultPrevented;
  }

  stop(): void {
    this.propagationStopped = true;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
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
