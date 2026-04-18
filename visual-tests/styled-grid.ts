import stringWidth from "string-width";

export interface StyledCell {
  text: string;
  foreground: string | null;
  background: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
  continuation: boolean;
}

export interface StyledGrid {
  rows: StyledCell[][];
}

export interface StyledCellDiff {
  row: number;
  col: number;
  python: StyledCell;
  js: StyledCell;
}

interface StyleState {
  foreground: string | null;
  background: string | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
}

const DEFAULT_STYLE_STATE: StyleState = {
  foreground: null,
  background: null,
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strikethrough: false,
  inverse: false,
};

const AMBIENT_BACKGROUNDS = new Set(["#121212"]);

function cloneStyleState(state: StyleState): StyleState {
  return { ...state };
}

function createCell(text: string, style: StyleState, continuation = false): StyledCell {
  return {
    text,
    continuation,
    ...style,
  };
}

function isDefaultBlankCell(cell: StyledCell | undefined): boolean {
  return (
    cell !== undefined &&
    cell.text === " " &&
    cell.foreground === null &&
    cell.background === null &&
    cell.bold === false &&
    cell.dim === false &&
    cell.italic === false &&
    cell.underline === false &&
    cell.strikethrough === false &&
    cell.inverse === false &&
    cell.continuation === false
  );
}

function trimStyledRow(row: StyledCell[]): StyledCell[] {
  const trimmed = [...row];

  while (isDefaultBlankCell(trimmed.at(-1))) {
    trimmed.pop();
  }

  return trimmed;
}

function trimStyledRows(rows: StyledCell[][]): StyledCell[][] {
  const trimmed = rows.map(trimStyledRow);

  while ((trimmed.at(-1)?.length ?? 0) === 0) {
    trimmed.pop();
  }

  return trimmed;
}

function normalizeAmbientCell(cell: StyledCell): StyledCell {
  return cell.background !== null && AMBIENT_BACKGROUNDS.has(cell.background)
    ? { ...cell, background: null }
    : cell;
}

export function normalizeStyledGrid(grid: StyledGrid): StyledGrid {
  return {
    // [LAW:one-source-of-truth] The normalized grid preserves the original
    // row/column origin so compare-step consumers can detect translation and
    // overlay-placement regressions instead of re-anchoring content locally.
    rows: trimStyledRows(grid.rows.map((row) => trimStyledRow(row.map(normalizeAmbientCell)))),
  };
}

function normalizeRgb(red: number, green: number, blue: number): string {
  return `#${red.toString(16).padStart(2, "0")}${green.toString(16).padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
}

function applySgrCode(state: StyleState, code: number, params: number[], index: number): number {
  if (code === 0) {
    Object.assign(state, DEFAULT_STYLE_STATE);
    return index;
  }

  if (code === 1) {
    state.bold = true;
    return index;
  }

  if (code === 2) {
    state.dim = true;
    return index;
  }

  if (code === 3) {
    state.italic = true;
    return index;
  }

  if (code === 4) {
    state.underline = true;
    return index;
  }

  if (code === 7) {
    state.inverse = true;
    return index;
  }

  if (code === 9) {
    state.strikethrough = true;
    return index;
  }

  if (code === 22) {
    state.bold = false;
    state.dim = false;
    return index;
  }

  if (code === 23) {
    state.italic = false;
    return index;
  }

  if (code === 24) {
    state.underline = false;
    return index;
  }

  if (code === 27) {
    state.inverse = false;
    return index;
  }

  if (code === 29) {
    state.strikethrough = false;
    return index;
  }

  if (code >= 30 && code <= 37) {
    state.foreground = `standard:${code - 30}`;
    return index;
  }

  if (code >= 40 && code <= 47) {
    state.background = `standard:${code - 40}`;
    return index;
  }

  if (code >= 90 && code <= 97) {
    state.foreground = `standard:${code - 90 + 8}`;
    return index;
  }

  if (code >= 100 && code <= 107) {
    state.background = `standard:${code - 100 + 8}`;
    return index;
  }

  if (code === 39) {
    state.foreground = null;
    return index;
  }

  if (code === 49) {
    state.background = null;
    return index;
  }

  if ((code === 38 || code === 48) && index + 1 < params.length) {
    const target = code === 38 ? "foreground" : "background";
    const mode = params[index + 1];

    if (mode === 5 && index + 2 < params.length) {
      state[target] = `eight-bit:${params[index + 2]}`;
      return index + 2;
    }

    if (mode === 2 && index + 4 < params.length) {
      state[target] = normalizeRgb(params[index + 2], params[index + 3], params[index + 4]);
      return index + 4;
    }
  }

  return index;
}

function readEscapeSequenceEnd(output: string, startIndex: number): number {
  const nextCharacter = output[startIndex + 1];

  if (nextCharacter === "[") {
    let index = startIndex + 2;

    while (index < output.length) {
      const character = output[index];

      if (character >= "@" && character <= "~") {
        return index + 1;
      }

      index += 1;
    }
  }

  if (nextCharacter === "]") {
    let index = startIndex + 2;

    while (index < output.length) {
      if (output[index] === "\u0007") {
        return index + 1;
      }

      if (output[index] === "\u001B" && output[index + 1] === "\\") {
        return index + 2;
      }

      index += 1;
    }
  }

  return Math.min(output.length, startIndex + 2);
}

function applySgrParameters(sequence: string, state: StyleState): void {
  const paramsText = sequence.slice(2, -1);
  const params = (paramsText.length === 0 ? ["0"] : paramsText.split(";"))
    .map((value) => Number.parseInt(value, 10))
    .map((value) => (Number.isNaN(value) ? 0 : value));

  for (let index = 0; index < params.length; index += 1) {
    index = applySgrCode(state, params[index], params, index);
  }
}

function appendGlyph(row: StyledCell[], glyph: string, style: StyleState): void {
  const width = stringWidth(glyph);

  if (width === 0) {
    const previous = row.at(-1);

    if (previous !== undefined) {
      previous.text += glyph;
    }

    return;
  }

  row.push(createCell(glyph, cloneStyleState(style)));

  for (let index = 1; index < width; index += 1) {
    row.push(createCell("", cloneStyleState(style), true));
  }
}

export function parseAnsiToStyledGrid(output: string): StyledGrid {
  const rows: StyledCell[][] = [[]];
  const style = cloneStyleState(DEFAULT_STYLE_STATE);
  let index = 0;

  while (index < output.length) {
    const character = output[index];

    if (character === "\u001B") {
      const end = readEscapeSequenceEnd(output, index);
      const sequence = output.slice(index, end);

      if (sequence.startsWith("\u001B[") && sequence.endsWith("m")) {
        applySgrParameters(sequence, style);
      }

      index = end;
      continue;
    }

    if (character === "\r") {
      index += 1;
      continue;
    }

    if (character === "\n") {
      rows.push([]);
      index += 1;
      continue;
    }

    const codePoint = output.codePointAt(index);

    if (codePoint === undefined) {
      break;
    }

    const glyph = String.fromCodePoint(codePoint);
    appendGlyph(rows[rows.length - 1], glyph, style);
    index += glyph.length;
  }

  return { rows: trimStyledRows(rows) };
}

export function styledGridToText(grid: StyledGrid): string {
  return grid.rows
    .map((row) => row.filter((cell) => !cell.continuation).map((cell) => cell.text).join(""))
    .join("\n");
}

function getComparableCell(row: StyledCell[] | undefined, column: number): StyledCell {
  return row?.[column] ?? createCell(" ", DEFAULT_STYLE_STATE);
}

function cellsEqual(left: StyledCell, right: StyledCell): boolean {
  return (
    left.text === right.text &&
    left.foreground === right.foreground &&
    left.background === right.background &&
    left.bold === right.bold &&
    left.dim === right.dim &&
    left.italic === right.italic &&
    left.underline === right.underline &&
    left.strikethrough === right.strikethrough &&
    left.inverse === right.inverse &&
    left.continuation === right.continuation
  );
}

export function diffStyledGrids(python: StyledGrid, js: StyledGrid): {
  diffs: StyledCellDiff[];
  matchPercentage: number;
} {
  const normalizedPython = normalizeStyledGrid(python);
  const normalizedJs = normalizeStyledGrid(js);
  const maxRows = Math.max(normalizedPython.rows.length, normalizedJs.rows.length);
  const diffs: StyledCellDiff[] = [];
  let totalCells = 0;
  let matchingCells = 0;

  for (let row = 0; row < maxRows; row += 1) {
    const pythonRow = normalizedPython.rows[row];
    const jsRow = normalizedJs.rows[row];
    const maxCols = Math.max(pythonRow?.length ?? 0, jsRow?.length ?? 0);

    for (let col = 0; col < maxCols; col += 1) {
      const pythonCell = getComparableCell(pythonRow, col);
      const jsCell = getComparableCell(jsRow, col);
      totalCells += 1;

      if (cellsEqual(pythonCell, jsCell)) {
        matchingCells += 1;
      } else {
        diffs.push({ row, col, python: pythonCell, js: jsCell });
      }
    }
  }

  return {
    diffs,
    matchPercentage: totalCells === 0 ? 100 : (matchingCells / totalCells) * 100,
  };
}

export function formatStyledCell(cell: StyledCell): string {
  return JSON.stringify({
    text: cell.text,
    foreground: cell.foreground,
    background: cell.background,
    bold: cell.bold,
    dim: cell.dim,
    italic: cell.italic,
    underline: cell.underline,
    strikethrough: cell.strikethrough,
    inverse: cell.inverse,
    continuation: cell.continuation,
  });
}
