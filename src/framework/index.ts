// [LAW:one-source-of-truth] This barrel is the *internal* framework surface.
// `App` (src/app/app.tsx) is the only runtime authority; `AppRuntime`
// is a private collaborator and must not be re-exported from src/index.ts.
// Mechanical enforcement lives in scripts/check-framework-imports.ts.
// See design-docs/true-north-arch-refactor.md (Phase 1, Principle 1).

export {
  type ActiveBinding,
  type ActiveTooltip,
  ActiveModeError,
  type AppDriver,
  type AnimationLevel,
  type ActionTargetDescriptor,
  type BindingClash,
  type BindingNamespace,
  InvalidModeError,
  type KeymapInput,
  type MessageSubscriber,
  type NotifyOptions,
  type PointerLocation,
  type PointerShape,
  DuplicateKeyHandlers,
  ScreenStackError,
  type SimpleCommand,
  type SystemCommand,
  type SystemCommandResolver,
  StylesheetError,
  SuspendNotSupported,
  UnknownModeError,
  formatKey,
  getKeyDisplay,
  keyToCharacter,
  normalizeKeyName,
  type RegisterWidgetOptions,
  type RegisterWidgetTypeOptions,
  type ScreenDescriptor,
  type Screen,
  type ScreenOptions,
  type WidgetTypeMetadata,
} from "./_app-runtime.js";
export {
  StylesReader,
  TextualProvider,
  WidgetScope,
  WidgetHost,
  useBindings,
  useCurrentWidget,
  useResolvedTitle,
  useStyles,
  useTimer,
  useTextual,
  useWorker,
  useWidget,
  type UseWidgetOptions,
  type UseWidgetResult,
  type WidgetHostProps,
} from "./context.js";
export { DOMQuery, DeclarationError, NoMatches, TooManyMatches, WrongType, type QueryTypeConstraint } from "./dom-query.js";
export { MeasuredSizeReader, type MeasuredSize, type MeasuredSizeReaderProps } from "./measured-size.js";
export { OnDecoratorError, on, type OnOptions } from "./on.js";
export {
  WidgetRegistry,
  NodeList,
  DuplicateIds,
  type WidgetActionCallback,
  type WidgetActions,
  type WidgetCheckAction,
  type WidgetHandlers,
  type WidgetIdentity,
  type WidgetMessageHandler,
} from "./widget-registry.js";
export {
  BadIdentifier,
  BadWidgetName,
  MountError,
  Widget,
  WidgetError,
  type ScrollAnimationState,
  type ScrollToOptions,
  type WalkChildrenOptions,
  type WidgetInit,
  type WidgetOptions,
} from "./widget.js";
export {
  find_first_enabled,
  find_last_enabled,
  find_next_enabled,
  find_next_enabled_no_wrap,
  get_directed_distance,
  type EnabledCandidate,
} from "./widget-navigation.js";
export {
  NO_TITLE_OVERRIDE,
  resolveTitle,
  type ResolvedTitle,
  type TitleOverride,
} from "./title-resolution.js";
