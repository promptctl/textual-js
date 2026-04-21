import { Region, Size, Spacing } from "../geometry/index.js";
import type { BorderValue, ResolvedRuleMap } from "./resolved-styles.js";

type RuleReader = {
  getRule?: <TValue>(name: string) => TValue | undefined;
  rules?: Map<string, unknown> | ResolvedRuleMap;
};

function readRule<TValue>(styles: RuleReader, name: string): TValue | undefined {
  if (typeof styles.getRule === "function") {
    return styles.getRule<TValue>(name);
  }

  if (styles.rules instanceof Map) {
    return styles.rules.get(name) as TValue | undefined;
  }

  return (styles.rules as ResolvedRuleMap | undefined)?.[name] as TValue | undefined;
}

function hasBorder(styles: RuleReader): boolean {
  const border = readRule<BorderValue>(styles, "border");
  return border !== undefined && border.style.length > 0;
}

function readPadding(styles: RuleReader): Spacing {
  return readRule<Spacing>(styles, "padding") ?? new Spacing(0, 0, 0, 0);
}

export class StylesCache<TLine = string> {
  private readonly dirty = new Set<number>();
  private readonly lines = new Map<number, TLine>();
  private signature = "";

  setDirty(region: Region): void {
    for (let y = region.y; y < region.y + region.height; y += 1) {
      this.dirty.add(y);
    }
  }

  set_dirty(region: Region): void {
    this.setDirty(region);
  }

  isDirty(y: number): boolean {
    return this.dirty.has(y) || !this.lines.has(y);
  }

  is_dirty(y: number): boolean {
    return this.isDirty(y);
  }

  render(
    styles: RuleReader,
    size: Size,
    _baseColor: unknown,
    _backgroundColor: unknown,
    renderLine: (y: number) => TLine,
    crop?: Region,
  ): TLine[] {
    const nextSignature = JSON.stringify({
      width: size.width,
      height: size.height,
      border: readRule(styles, "border"),
      outline: readRule(styles, "outline"),
      padding: readRule(styles, "padding"),
    });

    if (this.signature !== nextSignature) {
      this.lines.clear();
      this.dirty.clear();
      this.signature = nextSignature;
    }

    const borderWidth = hasBorder(styles) ? 1 : 0;
    const padding = readPadding(styles);
    const output: TLine[] = [];

    for (let y = 0; y < size.height; y += 1) {
      const contentY = y - borderWidth - padding.top;
      const inContent =
        contentY >= 0 &&
        contentY < Math.max(0, size.height - borderWidth * 2 - padding.top - padding.bottom);

      if (inContent && this.isDirty(y)) {
        this.lines.set(y, renderLine(contentY));
        this.dirty.delete(y);
      }

      const line = this.lines.get(y);

      if (line !== undefined) {
        output.push(line);
      }
    }

    if (crop === undefined) {
      return output;
    }

    return output.slice(crop.y, crop.y + crop.height);
  }
}
