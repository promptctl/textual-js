# Types

## Overview

**Module:** `textual.types`

A convenience re-export module that gathers commonly used types from across the Textual framework into a single import location. These types are used in type annotations, widget configuration, and error handling.

---

## Exported Types

| Name | Source Module | Description |
|---|---|---|
| `ActionParseResult` | `textual.actions` | Result type from parsing action strings. |
| `Animatable` | `textual._animator` | Protocol for objects that can be animated. |
| `AnimationLevel` | `textual._types` | Literal type for animation levels. |
| `CallbackType` | `textual._types` | Type alias for callback functions. |
| `CSSPathError` | `textual._path` | Exception raised for invalid CSS paths. |
| `CSSPathType` | `textual._path` | Type alias for CSS path specifications. |
| `DirEntry` | `textual.widgets._directory_tree` | Data class representing a directory entry in `DirectoryTree`. |
| `Direction` | `textual._widget_navigation` | Type for navigation direction. |
| `DuplicateID` | `textual.widgets._option_list` | Exception raised when a duplicate ID is used in `OptionList`. |
| `EasingFunction` | `textual._animator` | Type alias for easing functions used in animation. |
| `IgnoreReturnCallbackType` | `textual._types` | Callback type where the return value is ignored. |
| `InputValidationOn` | `textual.widgets._input` | Literal type specifying when input validation occurs. |
| `MessageTarget` | `textual._types` | Type alias for message targets. |
| `NoActiveAppError` | `textual._context` | Exception raised when no active app exists in context. |
| `NoSelection` | `textual.widgets._select` | Sentinel type representing no selection in `Select`. |
| `OptionDoesNotExist` | `textual.widgets._option_list` | Exception raised when referencing a non-existent option. |
| `OptionListContent` | `textual.widgets._option_list` | Type alias for content accepted by `OptionList`. |
| `PlaceholderVariant` | `textual.widgets._placeholder` | Literal type for `Placeholder` widget variants. |
| `RenderStyles` | `textual.css.styles` | Resolved styles object used during rendering. |
| `SelectType` | `textual.widgets._select` | TypeVar for the value type of `Select`. |
| `UnusedParameter` | `textual._types` | Sentinel class for detecting unused/default parameters. |
| `WatchCallbackType` | `textual._types` | Type alias for reactive watcher callbacks. |

---

## Usage

```python
from textual.types import CSSPathType, CallbackType, NoActiveAppError
```

All names listed in `__all__` are the public API of this module.
