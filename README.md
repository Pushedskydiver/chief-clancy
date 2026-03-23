# Clancy

**Autonomous, board-driven development for Claude Code.**

> [!WARNING]
> This monorepo is under active development. It will replace the current [`chief-clancy`](https://www.npmjs.com/package/chief-clancy) package once feature parity is reached.

## Packages

| Package                                         | Description                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`@chief-clancy/core`](./packages/core)         | Board intelligence, schemas, types, ticket lifecycle, phase pipeline, shared utilities |
| [`@chief-clancy/terminal`](./packages/terminal) | Installer, slash commands, hooks, AFK runner, agents, Claude CLI bridge                |
| [`chief-clancy`](./packages/chief-clancy)       | Thin bin wrapper — `npx chief-clancy` delegates to `@chief-clancy/terminal`            |

## License

[MIT](./LICENSE)
