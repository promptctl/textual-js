// [LAW:one-type-per-behavior] Shared widget component inputs are defined once
// so each widget does not invent local id/classes handling.

export type WidgetClassInput = string | readonly string[] | null | undefined;

export interface WidgetComponentProps {
  id?: string;
  classes?: string | string[];
  borderTitle?: string;
  borderSubtitle?: string;
}

function normalizeWidgetClasses(classes: WidgetClassInput): string[] {
  return classes === undefined || classes === null
    ? []
    : typeof classes === "string"
      ? classes === "" ? [] : [classes]
      : [...classes];
}

export function composeWidgetClasses(...groups: readonly WidgetClassInput[]): string[] {
  return groups.flatMap((group) => normalizeWidgetClasses(group));
}
