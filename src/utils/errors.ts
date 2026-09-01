/** Read a message off a caught value without assuming it's an Error - catch clauses are typed unknown. */
export const getErrorMessage = (
  err: unknown,
  fallback = 'An unexpected error occurred'
): string => (err instanceof Error ? err.message : fallback);
