/** Check whether an error has a specific Node.js error code. */
export function hasErrorCode(err: unknown, code: string): boolean {
  return (
    err instanceof Error && (err as { readonly code?: string }).code === code
  );
}
