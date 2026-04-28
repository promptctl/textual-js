// [LAW:single-enforcer] CommandService is the sole owner of palette
// orchestration state (appCommandProviders, systemCommandResolver,
// activeCommandPalette, publicApp) and the search/open/close pipeline.
// Framework methods are thin delegators that read through it.
// [LAW:one-source-of-truth] Provider composition (app providers + active
// screen providers) is resolved in exactly one place: this service.
// [LAW:one-way-deps] The service depends only on a narrow injected deps
// interface; it does NOT import TextualFramework.

import "./mobx-config.js";

import React from "react";
import { makeAutoObservable } from "mobx";

import {
  CommandPalette,
  CommandPaletteScreen,
  SimpleCommandProvider,
  SystemCommandsProvider,
  type CommandPaletteOptions,
  type Provider,
  type ProviderConstructor,
  type ProviderContext,
} from "../commands/index.js";
import type { Message } from "../events/message.js";
import type { Widget } from "./widget.js";
import type {
  Screen,
  ScreenOptions,
  SimpleCommand,
  SystemCommand,
  SystemCommandResolver,
} from "./app-framework.js";

// [LAW:one-way-deps] Narrow capability interface the service requires from
// its host (typically TextualFramework). The service never imports the host
// class — only this shape.
export interface CommandServiceDeps {
  getActiveScreen(): Screen | null;
  getFocusedNodeId(): string | null;
  getWidget(id: string): Widget | undefined;
  pushScreen(element: React.ReactElement, options: ScreenOptions): Screen;
  popScreen(result: unknown): Screen | null;
  postAppMessage(message: Message): void;
}

export class CommandService {
  private appCommandProviders: ReadonlySet<ProviderConstructor> | null = null;
  private systemCommandResolver: SystemCommandResolver = () => [];
  activeCommandPalette: CommandPalette | null = null;
  private publicApp: unknown = null;
  private readonly deps: CommandServiceDeps;

  constructor(deps: CommandServiceDeps) {
    this.deps = deps;

    makeAutoObservable(
      this,
      {
        deps: false,
        appCommandProviders: false,
        systemCommandResolver: false,
        publicApp: false,
      } as never,
      { autoBind: true },
    );
  }

  setAppCommandProviders(providers: Iterable<ProviderConstructor> | null | undefined): void {
    // [LAW:one-source-of-truth] App COMMANDS are normalized into one provider
    // set here; palette launches derive from it instead of re-reading props.
    this.appCommandProviders = providers === undefined || providers === null ? null : new Set(providers);
  }

  setSystemCommandResolver(resolver: SystemCommandResolver | undefined): void {
    this.systemCommandResolver = resolver ?? (() => []);
  }

  setPublicApp(app: unknown): void {
    // [LAW:one-source-of-truth] The public App wrapper is registered once on
    // the service so provider contexts derive from the running app object.
    this.publicApp = app;
  }

  getSystemCommands(screen: Screen | null): SystemCommand[] {
    return Array.from(this.systemCommandResolver(screen));
  }

  async searchCommands(commands: readonly SimpleCommand[]): Promise<CommandPalette> {
    const provider = new SimpleCommandProvider(commands);
    const palette = new CommandPalette(
      [provider],
      this.createProviderContext(this.deps.getActiveScreen(), this.getFocusedWidget()),
    );

    await palette.startup();
    await palette.open();
    this.activeCommandPalette = palette;
    this.deps.pushScreen(React.createElement(CommandPaletteScreen, { palette }), { name: CommandPalette.SCREEN_NAME });
    this.deps.postAppMessage(new CommandPalette.Opened());
    return palette;
  }

  async openCommandPalette(options: CommandPaletteOptions = {}): Promise<CommandPalette> {
    const baseScreen = this.deps.getActiveScreen();
    const focused = this.getFocusedWidget();
    const providers = this.createCommandProviders(baseScreen);
    const palette = new CommandPalette(providers, this.createProviderContext(baseScreen, focused), options);

    await palette.startup();
    await palette.open();
    this.activeCommandPalette = palette;
    this.deps.pushScreen(React.createElement(CommandPaletteScreen, { palette }), { name: CommandPalette.SCREEN_NAME });
    this.deps.postAppMessage(new CommandPalette.Opened());
    return palette;
  }

  async closeActiveCommandPalette(optionSelected: boolean, command?: () => void): Promise<void> {
    const palette = this.activeCommandPalette;

    if (palette !== null) {
      await palette.shutdown();
    }

    if (this.deps.getActiveScreen()?.name === CommandPalette.SCREEN_NAME) {
      this.deps.popScreen(optionSelected);
    }

    this.activeCommandPalette = null;
    this.deps.postAppMessage(new CommandPalette.Closed(optionSelected));
    command?.();
  }

  private createCommandProviders(baseScreen: Screen | null): Provider[] {
    const appProviders = this.appCommandProviders ?? new Set<ProviderConstructor>([SystemCommandsProvider]);
    const screenProviders = baseScreen?.commandProviders ?? new Set<ProviderConstructor>();

    // [LAW:one-source-of-truth] Provider composition is resolved once per
    // palette launch from app replacement providers plus active screen additions.
    return Array.from(new Set<ProviderConstructor>([...appProviders, ...screenProviders]))
      .map((ProviderClass) => new ProviderClass());
  }

  private getFocusedWidget(): Widget | null {
    const focusedNodeId = this.deps.getFocusedNodeId();
    return focusedNodeId === null ? null : this.deps.getWidget(focusedNodeId) ?? null;
  }

  private createProviderContext(baseScreen: Screen | null, focused: Widget | null): ProviderContext {
    // [LAW:one-source-of-truth] Providers always observe the public App; the
    // framework is reachable via app.framework. publicApp is set in App's
    // constructor so this must be present by the time a palette opens.
    if (this.publicApp === null) {
      throw new Error("Command palette requires a public App; framework-only harnesses cannot open a palette");
    }

    return {
      app: this.publicApp as ProviderContext["app"],
      screen: baseScreen,
      focused,
    };
  }
}
