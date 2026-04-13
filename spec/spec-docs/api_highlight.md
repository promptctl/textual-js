# textual.highlight

Syntax highlighting utilities that use Pygments to tokenize code and produce styled `Content` objects for display in Textual widgets.

## Type Aliases

- `TokenType = Tuple[str, ...]` -- A Pygments token type, represented as a tuple of strings.

## HighlightTheme Class

`HighlightTheme` (`textual.highlight`) contains the style definitions used by the `highlight` function.

### Class Variables

- `STYLES: dict[TokenType, str]` -- Mapping from Pygments token types to Textual style strings. Covers comments, errors, generics, keywords, literals, names, numbers, operators, strings, and whitespace. Styles use Textual design system tokens (e.g. `$text-accent`, `$text-success 90%`, `$text-error on $error-muted`).

### Default Token Styles

The following token types have default style mappings:

- `Token.Comment` -- `"$text 60%"`
- `Token.Error` -- `"$text-error on $error-muted"`
- `Token.Generic.Strong` -- `"bold"`
- `Token.Generic.Emph` -- `"italic"`
- `Token.Generic.Error` -- `"$text-error on $error-muted"`
- `Token.Generic.Heading` -- `"$text-primary underline"`
- `Token.Generic.Subheading` -- `"$text-primary"`
- `Token.Keyword` -- `"$text-accent"`
- `Token.Keyword.Constant` -- `"bold $text-success 80%"`
- `Token.Keyword.Namespace` -- `"$text-error"`
- `Token.Keyword.Type` -- `"bold"`
- `Token.Literal.Number` -- `"$text-warning"`
- `Token.Literal.String.Backtick` -- `"$text 60%"`
- `Token.Literal.String` -- `"$text-success 90%"`
- `Token.Literal.String.Doc` -- `"$text-success 80% italic"`
- `Token.Literal.String.Double` -- `"$text-success 90%"`
- `Token.Name` -- `"$text-primary"`
- `Token.Name.Attribute` -- `"$text-warning"`
- `Token.Name.Builtin` -- `"$text-accent"`
- `Token.Name.Builtin.Pseudo` -- `"italic"`
- `Token.Name.Class` -- `"$text-warning bold"`
- `Token.Name.Constant` -- `"$text-error"`
- `Token.Name.Decorator` -- `"$text-primary bold"`
- `Token.Name.Function` -- `"$text-warning underline"`
- `Token.Name.Function.Magic` -- `"$text-warning underline"`
- `Token.Name.Tag` -- `"$text-primary bold"`
- `Token.Name.Variable` -- `"$text-secondary"`
- `Token.Number` -- `"$text-warning"`
- `Token.Operator` -- `"bold"`
- `Token.Operator.Word` -- `"bold $text-error"`
- `Token.String` -- `"$text-success"`
- `Token.Whitespace` -- `""` (empty string, no styling)

## Module-Level Functions

### guess_language

```python
def guess_language(code: str, path: str | None) -> str
```

Guess the programming language of a code string, returning a Pygments lexer alias name suitable for use with the `highlight` function.

**Parameters:**

- `code: str` -- The code to analyze.
- `path: str | None` -- An optional file path to assist in guessing.

**Returns:** `str` -- The guessed language name (a Pygments lexer alias).

**Behavior:**

1. If `path` ends with `.tcss`, returns `"scss"` (special case for Textual CSS files).
2. If `code` is provided and `path` is provided, attempts `guess_lexer_for_filename`.
3. If no lexer found yet and `code` is provided, attempts `guess_lexer` from Pygments.
4. If no lexer found yet and `path` is provided, attempts to derive a lexer from the file extension using `get_lexer_by_name`.
5. Returns the lexer's first alias if available, otherwise the lexer name. Falls back to `"default"` if no lexer is found.

### highlight

```python
def highlight(
    code: str,
    *,
    language: str | None = None,
    path: str | None = None,
    theme: type[HighlightTheme] = HighlightTheme,
    tab_size: int = 8,
) -> Content
```

Apply syntax highlighting to a string, producing a `Content` object with styled spans.

**Parameters:**

- `code: str` -- The code string to highlight.
- `language: str | None = None` -- The language to highlight. If not provided, the language is guessed via `guess_language`.
- `path: str | None = None` -- An optional file path, used for language guessing when `language` is not specified.
- `theme: type[HighlightTheme] = HighlightTheme` -- A `HighlightTheme` class (the type, not an instance) providing the token-to-style mapping.
- `tab_size: int = 8` -- Number of spaces per tab character.

**Returns:** `Content` -- A `Content` instance with syntax-highlighted spans, suitable for use in a widget.

**Behavior:**

1. If `language` is not provided, calls `guess_language(code, path)`.
2. Normalizes the code by joining on newlines (stripping any `\r`).
3. Obtains a Pygments lexer via `get_lexer_by_name`. Falls back to the `"text"` lexer if the requested language is not found.
4. Iterates over tokens from the lexer. For each token, looks up the token type in the theme's `STYLES` dict, walking up the token type hierarchy (via `token_type.parent`) until a match is found.
5. Wraps the code in a `Content` object with the collected `Span` list and applies a base `"$text"` style via `stylize_before`.
