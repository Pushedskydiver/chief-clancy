/**
 * Type shim for CSS module imports.
 *
 * `tsc` does not natively understand non-`.ts(x)` imports; without this shim,
 * `import styles from './<Name>.module.css'` would fail the typecheck step.
 * The shim declares the runtime shape (class-name → generated identifier
 * record) so consumers of CSS modules typecheck cleanly. Vitest and any
 * future production bundler (Vite) handle the actual module resolution at
 * runtime.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
