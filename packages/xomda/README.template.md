# xomda

`xomda` is a model-driven code generation platform. You describe your domain
once (entities, attributes, enums, packages) and templates regenerate the rest
of your codebase whenever the model changes.

The published `xomda` package bundles the CLI, the tRPC server, and a
pre-built Vue/Vuetify/Monaco SPA into a single npm artifact. Run it with no
install:

```bash
npx xomda
```

The default action starts an HTTP server on `:6431` (or the next free port)
and serves the SPA. Press `O` in the terminal to open your browser, or pass
`--open` for that to happen automatically. `--port <number>` overrides the
default.

## Subcommands

```
xomda                   # start the server + SPA (default)
xomda serve [--port N] [--open]
xomda generate          # write generated files to disk
xomda preview [--json]  # show generated output without writing
xomda diff [--json]     # show which generated files differ from disk
xomda wrapper [--pin V] # create xomdaw / xomdaw.cmd to pin a version per repo
```

All subcommands take `--root <path>` to point at a project directory other
than the current one.

## Requirements

- Node.js **22.6** or newer (uses native ESM and modern crypto/path APIs).
- For the SPA, a modern browser supporting `<script type="importmap">` (Chrome
  89+, Firefox 108+, Safari 16.4+).

## For AI agents

Authoritative guidance for AI coding assistants reading this package lives in
[`docs/.ai/`](./docs/.ai/). The folder is bundled in the published tarball on
purpose — agents working in a downstream project that depends on `xomda` should
read those files before generating templates or editing `.xomda/model.json`.

## License

[MIT](./LICENSE) © Joris Aerts.

See the [project homepage](https://github.com/JorisAerts/modelman) for source,
issues, and contribution guidelines.
