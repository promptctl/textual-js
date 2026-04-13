/**
 * App — the root of a Textual application.
 *
 * Owns the screen stack, the active mode, and serves as the entry
 * point for the renderer. The renderer calls app.run() with a driver,
 * and the app orchestrates lifecycle, events, and screen management.
 *
 * // [LAW:one-way-deps] App sits at the top. Screens and widgets look
 * // upward to App for coordination but App never depends downward on
 * // specific widget implementations.
 */

import { Widget } from "./widget.js";
import { Screen } from "./screen.js";
import { Size } from "./geometry/size.js";
import { Compose, Mount, Resize } from "./events/events.js";

export class App extends Widget {
  private _screenStack: Screen[] = [];
  private _appRunning = false;

  constructor() {
    super();
  }

  // --- Screen stack ---

  get screenStack(): ReadonlyArray<Screen> {
    return this._screenStack;
  }

  get activeScreen(): Screen | null {
    return this._screenStack.length > 0
      ? this._screenStack[this._screenStack.length - 1]!
      : null;
  }

  pushScreen(screen: Screen): void {
    this._screenStack.push(screen);
    this._mountChild(screen);
    screen.postMessage(new Compose());
    screen.postMessage(new Mount());
    this.refresh({ layout: true });
  }

  popScreen(): Screen | null {
    if (this._screenStack.length <= 1) return null;
    const screen = this._screenStack.pop()!;
    this._unmountChild(screen);
    this.refresh({ layout: true });
    return screen;
  }

  switchScreen(screen: Screen): void {
    // Remove current screen
    if (this._screenStack.length > 0) {
      const current = this._screenStack.pop()!;
      this._unmountChild(current);
    }
    // Push new screen
    this.pushScreen(screen);
  }

  // --- Lifecycle ---

  /**
   * Start the application. The renderer calls this.
   *
   * The app creates a default screen, runs compose on it, and begins
   * processing messages.
   */
  async run(options?: { width?: number; height?: number }): Promise<void> {
    if (options?.width) this._size = new Size(options.width, this._size.height);
    if (options?.height) this._size = new Size(this._size.width, options.height);

    this._appRunning = true;
    await this.start(); // Start MessagePump

    // Create and push default screen
    const defaultScreen = this.createDefaultScreen();
    this.pushScreen(defaultScreen);

    // Compose the app itself (in case subclass has compose())
    this.postMessage(new Compose());
    this.postMessage(new Mount());

    await this.processMessages();
  }

  /**
   * Create the default screen. Subclasses can override to customize.
   */
  protected createDefaultScreen(): Screen {
    return new Screen();
  }

  /**
   * Handle a resize event from the renderer.
   */
  handleResize(width: number, height: number): void {
    this._size = new Size(width, height);
    this.postMessage(new Resize(width, height));
    this.refresh({ layout: true });
  }

  /**
   * Get the current application size.
   */
  override get size(): Size {
    return this._size;
  }

  override get isRunning(): boolean {
    return this._appRunning;
  }

  /**
   * Shut down the application.
   */
  async exit(): Promise<void> {
    this._appRunning = false;
    await this.stop();
  }
}
