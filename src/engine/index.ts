// Typing session and metrics, no DOM access (SPEC §6). Implemented in phase 3.

/** Characters per minute from a character count and elapsed time. */
export function cpm(chars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (chars / elapsedMs) * 60_000;
}
