/**
 * Built-in event types used by the framework.
 */

import { Message } from "./message.js";

/** Dispatched when a widget should run compose(). */
export class Compose extends Message {
  static override readonly bubble = false;
}

/** Dispatched after a widget is mounted in the DOM. */
export class Mount extends Message {
  static override readonly bubble = false;
}

/** Dispatched before a widget is removed from the DOM. */
export class Unmount extends Message {
  static override readonly bubble = false;
}

/** Dispatched when focus is received. */
export class Focus extends Message {
  static override readonly bubble = false;
}

/** Dispatched when focus is lost. */
export class Blur extends Message {
  static override readonly bubble = false;
}

/** Dispatched when the terminal/viewport is resized. */
export class Resize extends Message {
  static override readonly bubble = false;
  static override readonly canReplace = true;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    super();
  }
}

/** Dispatched on idle ticks for deferred work. */
export class Idle extends Message {
  static override readonly bubble = false;
  static override readonly canReplace = true;
}

/** Key press event — posted by the renderer. */
export class Key extends Message {
  static override readonly bubble = true;

  constructor(
    readonly key: string,
    readonly character: string | null = null,
  ) {
    super();
  }
}

/** Mouse event — posted by the renderer. */
export class MouseDown extends Message {
  static override readonly bubble = true;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly button: number,
  ) {
    super();
  }
}

export class MouseUp extends Message {
  static override readonly bubble = true;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly button: number,
  ) {
    super();
  }
}

export class MouseMove extends Message {
  static override readonly bubble = true;
  static override readonly canReplace = true;

  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    super();
  }
}

export class Click extends Message {
  static override readonly bubble = true;

  constructor(
    readonly x: number,
    readonly y: number,
  ) {
    super();
  }
}

/** Scroll wheel event. */
export class ScrollEvent extends Message {
  static override readonly bubble = true;

  constructor(
    readonly x: number,
    readonly y: number,
    readonly deltaX: number,
    readonly deltaY: number,
  ) {
    super();
  }
}
