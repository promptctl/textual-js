# textual.errors

General exception classes for the Textual framework.

## TextualError

`TextualError(Exception)` -- Base class for all Textual errors.

## NoWidget

`NoWidget(TextualError)` -- Raised when a specified widget was not found.

## RenderError

`RenderError(TextualError)` -- Raised when an object could not be rendered.

## DuplicateKeyHandlers

`DuplicateKeyHandlers(TextualError)` -- Raised when more than one handler is defined for a single key press. For example, if both `key_ctrl_i` and `key_tab` handlers are defined on the same widget.
