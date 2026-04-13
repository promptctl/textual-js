/**
 * Message — base class for all messages in the Textual event/message system.
 *
 * Messages flow through the widget tree via MessagePump. They can bubble
 * upward from child to parent, be stopped, or be prevented from bubbling.
 */

let _nextMessageId = 0;

export abstract class Message {
  readonly messageId: number;
  private _stopped = false;
  private _forwarded = false;
  private _sender: MessageTarget | null = null;

  /** Whether this message bubbles up the DOM tree. Subclasses override. */
  static readonly bubble: boolean = true;

  /** Whether newer messages of this type replace older queued ones. */
  static readonly canReplace: boolean = false;

  constructor() {
    this.messageId = _nextMessageId++;
  }

  get bubble(): boolean {
    return (this.constructor as typeof Message).bubble;
  }

  get canReplace(): boolean {
    return (this.constructor as typeof Message).canReplace;
  }

  get sender(): MessageTarget | null {
    return this._sender;
  }

  get isStopped(): boolean {
    return this._stopped;
  }

  get isForwarded(): boolean {
    return this._forwarded;
  }

  stop(): void {
    this._stopped = true;
  }

  preventDefault(): void {
    this._stopped = true;
  }

  /** @internal */
  _setSender(sender: MessageTarget): void {
    this._sender = sender;
  }

  /** @internal */
  _setForwarded(): void {
    this._forwarded = true;
  }
}

/**
 * Minimal interface for anything that can receive messages.
 * MessagePump implements this. Defined here to avoid circular deps.
 */
export interface MessageTarget {
  postMessage(message: Message): void;
}
