# textual.markup

Utilities for content markup -- a Rich-like markup language used to style `Content` objects with inline style tags.

## Module Exports

`__all__ = ["MarkupError", "escape", "to_content"]`

## MarkupError

`MarkupError(Exception)` -- Raised when content markup cannot be parsed. All parsing exceptions are wrapped into this type by `to_content`.

## Constants

- `STYLES: set[str]` -- Set of recognized style token names: `"bold"`, `"dim"`, `"italic"`, `"underline"`, `"underline2"`, `"reverse"`, `"strike"`, `"blink"`.
- `STYLE_ABBREVIATIONS: dict[str, str]` -- Short aliases mapping to full style names: `"b"` -> `"bold"`, `"d"` -> `"dim"`, `"i"` -> `"italic"`, `"u"` -> `"underline"`, `"uu"` -> `"underline2"`, `"r"` -> `"reverse"`, `"s"` -> `"strike"`.

## MarkupTokenizer

`MarkupTokenizer(TokenizerState)` -- Tokenizes content markup strings into a stream of tokens representing text, opening tags, closing tags, and tag content. Uses the `expect_markup` expectation as its base state.

### Class Variables

- `EXPECT` -- Base expectation state for the tokenizer (markup with EOF handling).
- `STATE_MAP` -- Maps token names to follow-up expectations:
  - `"open_tag"` -> `expect_markup_tag`
  - `"open_closing_tag"` -> `expect_markup_tag`
  - `"end_tag"` -> `expect_markup`
  - `"key"` -> `expect_markup_expression`
- `STATE_PUSH` -- Tokens that push nested expression states (parentheses, square brackets, curly braces).
- `STATE_POP` -- Tokens that pop nested expression states (closing parentheses, brackets, braces).

## StyleTokenizer

`StyleTokenizer(TokenizerState)` -- Tokenizes a style string (e.g. the content inside markup tags). Uses `expect_style` as its base state.

### Class Variables

- `EXPECT` -- Base expectation state for style tokenization.
- `STATE_MAP` -- Maps `"key"` to `expect_markup_expression`.
- `STATE_PUSH` -- Tokens that push nested expression states.

## Functions

### escape

```python
def escape(markup: str) -> str
```

Escapes text so that it will not be interpreted as markup. Square brackets that would begin tags are escaped with backslashes. Trailing single backslashes are doubled.

- **Parameters:**
  - `markup: str` -- Content to be inserted into markup.
- **Returns:** `str` -- Markup with square brackets escaped.

### parse_style

```python
def parse_style(style: str, variables: dict[str, str] | None = None) -> Style
```

Parse a style string into a `Style` object, with CSS variable substitution.

- **Parameters:**
  - `style: str` -- Style encoded as a string (e.g. `"bold red on blue"`).
  - `variables: dict[str, str] | None` -- Mapping of CSS variable names to values. If `None`, variables are imported from the active app's stylesheet.
- **Returns:** `Style` -- A parsed `Style` object.

The parser recognizes:
- Color values (foreground and background via `on` keyword).
- Style tokens (`bold`, `italic`, etc.) and their abbreviations.
- `not` keyword to negate a style (e.g. `not bold`).
- `auto` keyword for automatic colors.
- Percentage values to adjust color alpha.
- `link` keyword for link metadata.
- Key-value pairs (`key=value`) stored as metadata.
- CSS variable references (substituted from `variables` or the active app).

### to_content

```python
def to_content(
    markup: str,
    style: str | Style = "",
    template_variables: Mapping[str, object] | None = None,
) -> Content
```

Convert a markup string into a `Content` object.

- **Parameters:**
  - `markup: str` -- String containing markup with style tags.
  - `style: str | Style` -- Optional base style applied to all text.
  - `template_variables: Mapping[str, object] | None` -- Mapping of `string.Template` variables for `$variable` substitution in text segments.
- **Raises:** `MarkupError` -- If the markup is invalid (unclosed brackets, unmatched closing tags, etc.).
- **Returns:** `Content` -- Content object that renders the styled markup.

#### Markup Syntax

- `[style]text[/style]` -- Apply a named style to text.
- `[/]` -- Auto-close the most recently opened tag.
- `[/style]` -- Close a specific named style tag.
- `\[` -- Escaped literal square bracket (not interpreted as a tag).
- Tags that cannot be parsed as styles are rendered as literal text.
- Empty or whitespace-only tags (e.g. `[]` or `[ ]`) are rendered as literal text.
- Unclosed tags at the end of the markup are implicitly closed at the end of the text.
- Style tags are normalized for matching (closing tag matches opening tag by normalized form).
- Template variables use `$name` or `${name}` syntax (Python `string.Template.safe_substitute`).
