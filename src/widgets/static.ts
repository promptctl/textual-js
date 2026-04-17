// [LAW:one-source-of-truth] `visual` is the canonical Content representation;
// `content` is the plain-text projection derived from it.

import { Content, type ContentInput } from "../content/index.js";

export class Static {
  private _visual: Content;

  constructor(content: ContentInput = "") {
    this._visual = Content.fromText(content);
  }

  get content(): string {
    return this._visual.plain;
  }

  get visual(): Content {
    return this._visual;
  }

  update(content: ContentInput): void {
    this._visual = Content.fromText(content);
  }
}

export class InvalidPlaceholderVariant extends Error {}

const VALID_PLACEHOLDER_VARIANTS = new Set([
  "default",
  "size",
  "text",
  "css",
]);

function validatePlaceholderVariant(variant: string): string {
  if (!VALID_PLACEHOLDER_VARIANTS.has(variant)) {
    throw new InvalidPlaceholderVariant(`Invalid placeholder variant: "${variant}"`);
  }

  return variant;
}

export class Placeholder {
  private _variant: string;

  constructor(variant = "default") {
    this._variant = validatePlaceholderVariant(variant);
  }

  get variant(): string {
    return this._variant;
  }

  set variant(value: string) {
    this._variant = validatePlaceholderVariant(value);
  }
}
