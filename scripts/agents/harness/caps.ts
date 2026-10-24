// Caps can only be lowered (V1.7 forces error_max_turns / error_max_budget_usd); raising one would bypass the
// reviewed budget. The SDK rejects a budget of 0, so the floor is exclusive.
export function parseCapOverride(raw: string | undefined, flag: string, ceiling: number, integer: boolean): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value > ceiling || (integer && !Number.isInteger(value))) {
    throw new Error(`${flag} must be ${integer ? 'an integer' : 'a number'} above 0 and at most ${ceiling}`);
  }
  return value;
}
