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
