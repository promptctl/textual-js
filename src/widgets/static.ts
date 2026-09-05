// [LAW:one-source-of-truth] `visual` is the canonical render representation;
// `content` preserves the original source value fed into that seam.

import { visualize, type Visual, type VisualInput } from "../content/index.js";

// [LAW:one-source-of-truth] The public `Static` name is reserved for the
// React widget component; this state holder stays behind the model seam.
export class StaticModel {
  private _content: VisualInput;
  private _visual: Visual;

  constructor(content: VisualInput = "") {
    this._content = content ?? "";
    this._visual = visualize(this._content);
  }

  get content(): VisualInput {
    return this._content;
  }

  get visual(): Visual {
    return this._visual;
  }

  update(content: VisualInput): void {
    this._content = content ?? "";
    this._visual = visualize(this._content);
  }
}
