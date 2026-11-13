// Small wording helpers for the screens. Pure functions.

/** "A", "A and B", "A, B and C". */
export function listText(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Text that someone typed, such as the approver's note, made into a sentence
 * that the screen's next sentence can follow: a full stop is added only if it
 * does not already end with one, a question mark or an exclamation mark
 * (closing quotes or brackets after it count). The text itself is kept as typed.
 */
export function asSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?…]["'”’)\]]*$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
