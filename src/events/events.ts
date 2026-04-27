import {
  Message,
  type MessageDispatchKind,
  type MessageInit,
  type MessageSuppressionCategory,
} from "./message.js";

export class Compose extends Message {}

export class Mount extends Message {
  static override readonly markLifecycleReadyAfterDispatch = true;
}

export class Unmount extends Message {}

export class Show extends Message {}

export class Hide extends Message {}

export class Ready extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class Focus extends Message {}

export class Blur extends Message {}

export class DescendantFocus extends Message {
  static override readonly verbose = true;
}

export class DescendantBlur extends Message {
  static override readonly verbose = true;
}

export class AppBlur extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class AppFocus extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class Idle extends Message {
  static readonly canReplace = true;
}

export class Callback extends Message {
  static override readonly verbose = true;
  static override readonly dispatchKind = "self-invoke";
  static override readonly discardOnShutdown = true;

  constructor(
    private readonly callback: () => void,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }

  invoke(): void {
    this.callback();
  }
}

export class Timer extends Message {
  static override readonly verbose = true;
  static override readonly dispatchKind = "self-invoke";

  constructor(
    private readonly callback: () => void,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }

  invoke(): void {
    this.callback();
    this.preventDefault();
    this.stop();
  }
}

export class ScreenResume extends Message {
  constructor(
    readonly screenName: string | null,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class ScreenSuspend extends Message {
  constructor(
    readonly screenName: string | null,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class ModeChanged extends Message {
  constructor(
    readonly mode: string,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class Resize extends Message {
  static readonly canReplace = true;

  constructor(
    readonly width: number,
    readonly height: number,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export interface KeyMeta {
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  paste?: boolean;
}

export class Key extends Message {
  static override readonly suppressionCategory = "user-input";
  static override readonly handlesKeyBindings = true;

  readonly input: string;
  readonly character: string | null;

  constructor(
    readonly key: string,
    character: string | null = null,
    readonly meta: KeyMeta = {},
    init?: MessageInit,
  ) {
    super(init);
    this.character = character;
    this.input = character ?? "";
  }
}

export class Paste extends Message {
  constructor(
    readonly text: string,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class MouseEvent extends Message {
  static override readonly suppressionCategory: MessageSuppressionCategory = "user-input";

  constructor(
    readonly x: number,
    readonly y: number,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class MouseDown extends MouseEvent {
  readonly button: number;

  constructor(
    x: number,
    y: number,
    buttonOrInit: number | MessageInit = 1,
    init?: MessageInit,
  ) {
    const resolvedInit = typeof buttonOrInit === "number" ? init : buttonOrInit;
    super(x, y, resolvedInit);
    this.button = typeof buttonOrInit === "number" ? buttonOrInit : 1;
  }
}

export class MouseUp extends MouseEvent {
  readonly button: number;

  constructor(
    x: number,
    y: number,
    buttonOrInit: number | MessageInit = 1,
    init?: MessageInit,
  ) {
    const resolvedInit = typeof buttonOrInit === "number" ? init : buttonOrInit;
    super(x, y, resolvedInit);
    this.button = typeof buttonOrInit === "number" ? buttonOrInit : 1;
  }
}

export class MouseMove extends MouseEvent {
  static readonly canReplace = true;
}

export class Click extends MouseEvent {
  constructor(
    x: number,
    y: number,
    readonly chain: number = 1,
    init?: MessageInit,
  ) {
    super(x, y, init);
  }
}

export class Enter extends Message {
  static override readonly verbose = true;
}

export class Leave extends Message {
  static override readonly verbose = true;
}

export class MouseScrollUp extends MouseEvent {
  static override readonly suppressionCategory = "scroll";
}

export class MouseScrollDown extends MouseEvent {
  static override readonly suppressionCategory = "scroll";
}

export class MouseScrollLeft extends MouseEvent {
  static override readonly suppressionCategory = "scroll";
}

export class MouseScrollRight extends MouseEvent {
  static override readonly suppressionCategory = "scroll";
}

export class MouseCapture extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class MouseRelease extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export interface TextSelectionEndpoint {
  widget: unknown;
  offset: number;
}

export interface TextSelectionRange {
  start: TextSelectionEndpoint;
  end: TextSelectionEndpoint;
}

export class TextSelected extends Message {
  constructor(
    readonly text: unknown,
    readonly range: TextSelectionRange,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class ScrollEvent extends MouseEvent {
  static override readonly suppressionCategory = "scroll";

  constructor(
    x: number,
    y: number,
    readonly deltaX: number,
    readonly deltaY: number,
    init?: MessageInit,
  ) {
    super(x, y, init);
  }
}

export class CursorPosition extends Message {
  constructor(
    readonly x: number,
    readonly y: number,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class DeliveryComplete extends Message {
  constructor(
    readonly id: string,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class DeliveryFailed extends Message {
  constructor(
    readonly id: string,
    readonly error: unknown,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class Notify extends Message {
  constructor(
    readonly notification: unknown,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class Print extends Message {
  static override readonly verbose = true;

  constructor(
    readonly text: string,
    readonly stderr = false,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}

export class CloseMessages extends Message {
  constructor(init?: MessageInit) {
    super({ bubble: false, ...init });
  }
}

export class ExitApp extends Message {
  constructor(
    readonly result?: unknown,
    init?: MessageInit,
  ) {
    super({ bubble: false, ...init });
  }
}
