import { Message, type MessageInit } from "./message.js";

export class Compose extends Message {}

export class Mount extends Message {}

export class Unmount extends Message {}

export class Focus extends Message {}

export class Blur extends Message {}

export class Idle extends Message {}

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
  constructor(
    readonly key: string,
    readonly input: string,
    readonly meta: KeyMeta = {},
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class MouseEvent extends Message {
  constructor(
    readonly x: number,
    readonly y: number,
    init?: MessageInit,
  ) {
    super(init);
  }
}

export class MouseDown extends MouseEvent {}

export class MouseUp extends MouseEvent {}

export class MouseMove extends MouseEvent {}

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

export class ScrollEvent extends MouseEvent {
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
