import { cellLen, RichText, Style, renderMarkup, type Segment } from "rich-js";

export interface Span {
  start: number;
  end: number;
  style: string;
}

export interface ContentFromTextOptions {
  markup?: boolean;
}

export interface ContentTruncateOptions {
  overflow?: "fold" | "crop" | "ellipsis";
}

export type ContentInput = string | Content | RichText | null | undefined;
export type ContentPart = string | Content | RichText | [string, string?];

function normalizeSpanStyle(style: string | Style): string {
  return typeof style === "string" ? style : style.toString();
}

function cloneSpans(spans: readonly Span[]): Span[] {
  return spans.map((span) => ({ ...span }));
}

export class Content {
  readonly plain: string;
  readonly spans: readonly Span[];

  constructor(text = "", spans: readonly Span[] = []) {
    this.plain = text.replace(/\r/g, "");
    this.spans = cloneSpans(
      spans.filter((span) => span.start < span.end && span.start < this.plain.length).map((span) => ({
        start: Math.max(0, span.start),
        end: Math.min(this.plain.length, span.end),
        style: span.style,
      })),
    );
  }

  get cellLength(): number {
    return cellLen(this.plain);
  }

  get firstLine(): Content {
    const newlineIndex = this.plain.indexOf("\n");
    const end = newlineIndex === -1 ? this.plain.length : newlineIndex;
    return new Content(
      this.plain.slice(0, end),
      this.spans
        .map((span) => ({
          start: Math.max(0, Math.min(span.start, end)),
          end: Math.max(0, Math.min(span.end, end)),
          style: span.style,
        }))
        .filter((span) => span.start < span.end),
    );
  }

  get isEmpty(): boolean {
    return this.plain.length === 0;
  }

  equals(other: string | Content): boolean {
    const otherText = typeof other === "string" ? other : other.plain;
    return this.plain === otherText;
  }

  compareTo(other: Content): number {
    return this.plain < other.plain ? -1 : this.plain > other.plain ? 1 : 0;
  }

  charAt(index: number): Content {
    const normalized = normalizeIndex(index, this.plain.length);
    return this.slice(normalized, normalized + 1);
  }

  slice(start: number, end?: number): Content {
    const length = this.plain.length;
    const resolvedStart = normalizeIndex(start, length);
    const resolvedEnd = end === undefined ? length : normalizeIndex(end, length);

    if (resolvedStart >= resolvedEnd) {
      return new Content("");
    }

    return new Content(
      this.plain.slice(resolvedStart, resolvedEnd),
      clipSpans(this.spans, resolvedStart, resolvedEnd),
    );
  }

  add(other: string | Content): Content {
    const rightContent = typeof other === "string" ? new Content(other) : other;
    return Content.assemble(this, rightContent);
  }

  stylizeBefore(style: string, start?: number, end?: number): Content {
    const length = this.plain.length;
    const resolvedStart = start === undefined ? 0 : normalizeIndex(start, length);
    const resolvedEnd = end === undefined ? length : normalizeIndex(end, length);

    if (resolvedStart >= resolvedEnd) {
      return this;
    }

    return new Content(this.plain, [
      {
        start: resolvedStart,
        end: resolvedEnd,
        style,
      },
      ...cloneSpans(this.spans),
    ]);
  }

  join(pieces: readonly (string | Content)[]): Content {
    if (pieces.length === 0) {
      return new Content("");
    }

    // [LAW:dataflow-not-control-flow] Single-item join returns the item
    // directly; the loop naturally handles this since the separator is never
    // inserted for a single piece.
    const parts: Content[] = [];

    for (let index = 0; index < pieces.length; index += 1) {
      if (index > 0) {
        parts.push(this);
      }

      parts.push(typeof pieces[index] === "string" ? new Content(pieces[index] as string) : (pieces[index] as Content));
    }

    return Content.assemble(...parts);
  }

  /**
   * Break this content into lines at word boundaries, no line wider than
   * `width` cells.
   *
   * Line breaks in the text are honoured as breaks, and every line is cut from
   * this content with `slice`, so styling survives the wrap. `fold` is the
   * blunter sibling: it breaks mid-word wherever the width runs out.
   */
  wrap(width: number): Content[] {
    if (width <= 0 || this.plain.length === 0) {
      return [new Content("")];
    }

    // [LAW:one-source-of-truth] Only the break *offsets* are computed here.
    // Turning an offset pair into content is `slice`'s job, so a wrapped line
    // carries the same spans the same characters had before the wrap — this
    // used to rebuild each line from `spans` clipped at zero, which gave every
    // line but the first the styling of the text's opening characters.
    return wrapOffsets(this.plain, width).map(([start, end]) => this.slice(start, end));
  }

  fold(width: number): Content[] {
    if (width <= 0) {
      return [new Content("")];
    }

    if (this.plain.length === 0) {
      return [new Content("")];
    }

    const lines = this.plain.split("\n");
    const result: Content[] = [];
    let offset = 0;

    for (const line of lines) {
      if (line.length === 0) {
        result.push(new Content("", clipSpans(this.spans, offset, offset)));
        offset += 1;
        continue;
      }

      let lineOffset = 0;

      while (lineOffset < line.length) {
        let cellCount = 0;
        let charIndex = lineOffset;

        while (charIndex < line.length && cellCount < width) {
          const char = line[charIndex]!;
          const codePoint = char.codePointAt(0) ?? 0;
          const charWidth = codePoint > 0xffff ? 2 : 1;

          if (cellCount + charWidth > width) {
            break;
          }

          cellCount += charWidth;
          charIndex += char.length;
        }

        result.push(
          new Content(
            line.slice(lineOffset, charIndex),
            clipSpans(this.spans, offset + lineOffset, offset + charIndex),
          ),
        );
        lineOffset = charIndex;
      }

      offset += line.length + 1;
    }

    return result.length === 0 ? [new Content("")] : result;
  }

  expandTabs(tabWidth: number): Content {
    if (!this.plain.includes("\t")) {
      return this;
    }

    const lines = this.plain.split("\n");
    const expandedLines: string[] = [];
    const expandedSpans: Span[] = [];
    let originalOffset = 0;
    let expandedOffset = 0;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex]!;
      let expandedLine = "";
      let lineExpandedOffset = 0;

      for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
        const char = line[charIndex]!;

        if (char === "\t") {
          const column = cellLen(expandedLine);
          const spaces = tabWidth - (column % tabWidth);
          expandedLine += " ".repeat(spaces);
          lineExpandedOffset += spaces - 1;
        } else {
          expandedLine += char;
        }
      }

      for (const span of this.spans) {
        const lineStart = originalOffset;
        const lineEnd = originalOffset + line.length;

        if (span.end <= lineStart || span.start >= lineEnd) {
          continue;
        }

        const clippedStart = Math.max(span.start, lineStart) - lineStart;
        const clippedEnd = Math.min(span.end, lineEnd) - lineStart;
        let expandedStart = 0;
        let expandedEnd = 0;
        let pos = 0;

        for (let i = 0; i < line.length; i += 1) {
          const expandedPos = pos;

          if (line[i] === "\t") {
            pos += tabWidth - (pos % tabWidth);
          } else {
            pos += 1;
          }

          if (i < clippedStart) {
            expandedStart = pos;
            expandedEnd = pos;
          }

          if (i >= clippedStart && i < clippedEnd) {
            if (expandedEnd === expandedStart && i === clippedStart) {
              expandedStart = expandedPos;
            }

            expandedEnd = pos;
          }
        }

        expandedSpans.push({
          start: expandedOffset + expandedStart,
          end: expandedOffset + expandedEnd,
          style: span.style,
        });
      }

      expandedLines.push(expandedLine);
      originalOffset += line.length + 1;
      expandedOffset += expandedLine.length + 1;
    }

    return new Content(expandedLines.join("\n"), expandedSpans);
  }

  simplify(): Content {
    if (this.spans.length <= 1) {
      return this;
    }

    const sorted = cloneSpans(this.spans).sort((a, b) => a.start - b.start || a.end - b.end);
    const merged: Span[] = [sorted[0]!];

    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      const last = merged[merged.length - 1]!;

      if (current.start === last.end && current.style === last.style) {
        last.end = current.end;
      } else {
        merged.push(current);
      }
    }

    // [LAW:one-source-of-truth] simplify mutates this.spans in place per the
    // spec contract — callers own the Content instance.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).spans = merged;
    return this;
  }

  stylize(style: string, start?: number, end?: number): Content {
    const length = this.plain.length;
    const resolvedStart = start === undefined ? 0 : normalizeIndex(start, length);
    const resolvedEnd = end === undefined ? length : normalizeIndex(end, length);

    if (resolvedStart >= resolvedEnd) {
      return this;
    }

    return new Content(this.plain, [
      ...this.spans,
      {
        start: resolvedStart,
        end: resolvedEnd,
        style,
      },
    ]);
  }

  addSpans(spans: readonly Span[]): Content {
    return new Content(this.plain, [...this.spans, ...cloneSpans(spans)]);
  }

  truncate(width: number, options: ContentTruncateOptions = {}): Content {
    const richText = this.toRichText();
    richText.truncate(width, options);
    return Content.fromRichText(richText);
  }

  toRichText(): RichText {
    const richText = new RichText(this.plain, { end: "" });

    for (const span of this.spans) {
      if (span.style.trim().length === 0) {
        continue;
      }

      richText.stylize(span.style, span.start, span.end);
    }

    return richText;
  }

  toSegments(maxWidth = this.cellLength): Segment[] {
    return [...this.toRichText().render({ maxWidth })].filter((segment) => segment.text !== "\n");
  }

  static styled(text: string, style: string): Content {
    return new Content(text, text.length === 0 ? [] : [{ start: 0, end: text.length, style }]);
  }

  static fromMarkup(markup: string): Content {
    return Content.fromRichText(renderMarkup(markup));
  }

  static fromRichText(text: RichText): Content {
    return new Content(
      text.plain,
      text.spans.map((span) => ({
        start: span.start,
        end: span.end,
        style: normalizeSpanStyle(span.style),
      })),
    );
  }

  static fromText(value: ContentInput, options: ContentFromTextOptions = {}): Content {
    if (value instanceof Content) {
      return value;
    }

    if (value instanceof RichText) {
      return Content.fromRichText(value);
    }

    if (value === null || value === undefined) {
      return new Content("");
    }

    return options.markup === false ? new Content(value) : Content.fromMarkup(value);
  }

  static blank(width: number, style?: string): Content {
    const text = " ".repeat(Math.max(0, width));
    return style === undefined ? new Content(text) : Content.styled(text, style);
  }

  static assemble(...parts: ContentPart[]): Content {
    let plain = "";
    const spans: Span[] = [];

    for (const part of parts) {
      const content =
        Array.isArray(part)
          ? (part[1] === undefined ? new Content(part[0]) : Content.styled(part[0], part[1]))
          : Content.fromText(part);
      const offset = plain.length;
      plain += content.plain;

      for (const span of content.spans) {
        spans.push({
          start: span.start + offset,
          end: span.end + offset,
          style: span.style,
        });
      }
    }

    return new Content(plain, spans);
  }
}

function normalizeIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, index < 0 ? length + index : index));
}

/** The `[start, end)` offset of each wrapped line, greedily filling `width` cells. */
function wrapOffsets(text: string, width: number): [number, number][] {
  let start = 0;

  return text.split("\n").flatMap((paragraph) => {
    const offsets = paragraphOffsets(paragraph, start, width);
    // The break itself is one character, and belongs to no line.
    start += paragraph.length + 1;

    return offsets;
  });
}

function paragraphOffsets(paragraph: string, offset: number, width: number): [number, number][] {
  const lines: [number, number][] = [];
  let start = 0;

  while (start < paragraph.length) {
    const [end, next] = nextLineBreak(paragraph, start, width);
    lines.push([offset + start, offset + end]);
    start = next;
  }

  // An empty paragraph is a blank line, not the absence of one: a text with a
  // doubled break draws that break as a row.
  return lines.length === 0 ? [[offset, offset]] : lines;
}

/** Where a line starting at `start` ends, and where the next one begins. */
function nextLineBreak(paragraph: string, start: number, width: number): [number, number] {
  let cells = 0;
  let lastSpace = -1;
  let index = start;

  while (index < paragraph.length) {
    const character = String.fromCodePoint(paragraph.codePointAt(index)!);
    const characterCells = cellLen(character);

    if (cells + characterCells > width) {
      // Whitespace at a break belongs to neither line. Two consequences: a line
      // whose last word ends exactly on the width still fits, because the space
      // that overflowed is the break rather than part of the next line; and the
      // whole run of spaces goes, not one of them, so "hello  world" at width 5
      // gives "hello" and "world" rather than a line starting with a space.
      // Both match Rich and Textual, which is what the pinned baselines expect.
      const space = character === " " ? index : lastSpace > start ? lastSpace : -1;

      if (space >= 0) {
        return [space, skipSpaces(paragraph, space)];
      }

      // No space to break at: a word longer than the line is cut where the
      // width ran out. A character wider than the whole line leaves nothing to
      // cut, so it takes the line by itself — an empty line here would return
      // the caller its own `start` and spin forever.
      const cut = index === start ? index + character.length : index;

      return [cut, cut];
    }

    lastSpace = character === " " ? index : lastSpace;
    cells += characterCells;
    index += character.length;
  }

  return [paragraph.length, paragraph.length];
}

/** The first index at or after `from` that is not a space. */
function skipSpaces(paragraph: string, from: number): number {
  let index = from;

  while (paragraph[index] === " ") {
    index += 1;
  }

  return index;
}

function clipSpans(spans: readonly Span[], start: number, end: number): Span[] {
  return spans
    .map((span) => ({
      start: Math.max(0, span.start - start),
      end: Math.min(end - start, Math.max(0, span.end - start)),
      style: span.style,
    }))
    .filter((span) => span.start < span.end && span.end > 0);
}
