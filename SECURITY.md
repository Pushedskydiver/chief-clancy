# Security Policy

## Reporting a vulnerability

If you find a security vulnerability in Clancy, please report it responsibly.

**Do not open a public issue.** Instead, email [alex@clapperton.dev](mailto:alex@clapperton.dev) with:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact

You should receive a response within 48 hours. The issue will be assessed, fixed, and disclosed responsibly.

## Scope

Clancy handles API credentials (board tokens, git tokens) and executes shell commands. Security-relevant areas include:

- **Credential handling** — `.clancy/.env` files, environment variables
- **Shell execution** — git commands, esbuild, hook scripts
- **Network requests** — API calls to board platforms (Jira, GitHub, Linear, Shortcut, Notion, Azure DevOps)
- **Hook execution** — CommonJS hooks running on Claude Code events

## Practices

- `execFileSync` with argument arrays — never `execSync` with string interpolation
- Credential guard hook blocks accidental credential exposure
- Test credential values constructed at runtime to avoid push protection triggers
- `.env` files are gitignored
- Azure DevOps WIQL queries use `isSafeWiqlValue()` for injection defence
