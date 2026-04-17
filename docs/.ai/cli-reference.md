# CLI reference — AI quick reference

Every `xomda` subcommand, its flags, and what it reads/writes. All
commands accept `--root <path>` to point at a project directory other than
the current working directory.

## Invocation

```bash
npx xomda [subcommand] [options]      # no install required
./xomdaw [subcommand] [options]       # if the user has run `xomda wrapper`, pinned version
```

The bundled `xomda` is **a single npm package** — running `npx xomda` pulls
the latest published version, caches it, and runs it. Internal
`@xomda/*` packages are not published separately.

## Subcommands

### `xomda` (default — same as `xomda serve`)

Starts the tRPC server and serves the SPA. The default action when no
subcommand is given.

```bash
xomda                                # :6431, no browser
xomda serve --port 9999              # custom port (the flag lives on serve)
xomda serve --open                   # open browser automatically
XOMDA_PORT=9999 xomda                # env-var equivalent of --port; works on
                                     # the implicit serve action too
```

The `--port` and `--open` flags are options on the `serve` subcommand, not
on the root command — `xomda --open` errors with "unknown option". Use
`xomda serve --open` or set `XOMDA_PORT` for the no-flag invocation.

While running, the terminal accepts keypresses:
- `o` — open the local URL in the default browser
- `h` — show the keypress help
- `q` / Ctrl-C — shut down

Falls back to the next free port if the requested one is busy.

### `xomda serve` (explicit form)

Same as `xomda` with no subcommand. Useful when you want to be explicit, or
to take advantage of `--root`:

```bash
xomda serve --root ../some-project --port 9999
```

### `xomda generate`

Runs every template against the model and writes generated files to disk.

```bash
xomda generate                       # write to <cwd>/<output paths>
xomda generate --root ../app         # write rooted at ../app
```

Reads `.xomda/model.json` and `.xomda/templates/**/*.template.json`. Writes
files at paths declared by `output` cells.

Exit code `0` on success, non-zero with a message on failure.

### `xomda preview`

Runs every template but writes nothing — prints what would be generated.

```bash
xomda preview                        # human-readable output
xomda preview --json                 # machine-readable, parseable
```

The JSON form is `Array<{ outputPath: string; content: string }>`.

### `xomda diff`

Shows which generated files differ from what's currently on disk.

```bash
xomda diff
xomda diff --json
```

Human output uses `[NEW]` for files that don't exist yet and `[CHANGED]`
for files whose content would change. The JSON form is
`Array<{ outputPath: string; changed: boolean; current: string | null; next: string }>`.

Useful in CI before deciding whether to run `xomda generate`.

### `xomda wrapper`

Generates `xomdaw` (POSIX) and `xomdaw.cmd` (Windows) wrapper scripts in
the project, plus `.xomda/wrapper/xomda-wrapper.json` that pins a specific
version. Once written, the project bootstraps its own xomda via the
wrapper script (no global install needed).

```bash
xomda wrapper                        # pin to the current xomda version
xomda wrapper --pin 1.2.0            # pin to a specific version
xomda wrapper --force                # rewrite existing wrapper scripts
```

After running, add `.xomda/wrapper/node_modules/` to `.gitignore`.

## Environment variables

| Variable | Effect |
| --- | --- |
| `XOMDA_PORT` | Default port for `serve` (same as `--port`). |
| `XOMDA_DIR` | Override the `.xomda/` directory name. |

## Exit codes

- `0` — success
- `1` — generic failure (port busy, validation error, file write error)

## Common patterns

```bash
# Sanity-check on every commit:
xomda diff && echo "no drift"

# In CI, regenerate and fail if anything changed:
xomda generate && git diff --exit-code

# Author + try templates interactively:
xomda serve --open
```
