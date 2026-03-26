/** Check whether an error has a specific Node.js error code. */
export function hasErrorCode(err: unknown, code: string): boolean {
  return (
    // Safe: instanceof Error guarantees err is an object; code is a Node.js extension
    err instanceof Error && (err as { readonly code?: string }).code === code
  );
}
