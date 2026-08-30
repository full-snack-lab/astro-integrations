/** Normalizes one required public string option. */
export function nonEmptyString(value: unknown, optionName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`@fullsnacklab/astro-emdash: ${optionName} must be a non-empty string.`);
  }
  return value.trim();
}
