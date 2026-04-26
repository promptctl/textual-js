export function clamp(value: number, minimum: number, maximum: number): number {
  const lower = Math.min(minimum, maximum);
  const upper = Math.max(minimum, maximum);
  return Math.min(Math.max(value, lower), upper);
}
