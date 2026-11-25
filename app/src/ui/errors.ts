// Turns any thrown value into text for a message. The data service throws
// errors with plain-language messages; anything else is shown as it is.
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
