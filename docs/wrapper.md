# The xomda wrapper

The xomda wrapper is an **optional** convenience, modelled after the
[Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html). It lets a project pin the exact xomda
version it expects, and lets contributors run xomda without installing it globally — they only need Node.js.

The wrapper is purely additive. xomda continues to work without it: `npx xomda generate`, a global install, or a
project devDependency all keep working.

## What it gives you

A downstream project ends up with:

```
<project>/
├── xomdaw                          # POSIX shell script (executable) — at project root
├── xomdaw.cmd                      # Windows batch script — at project root
└── .xomda/
    ├── model.json
    ├── templates/
    └── wrapper/
        ├── xomda-wrapper.json      # { "version": "1.2.3" }   ← checked in
        └── node_modules/xomda/…    # bootstrapped install      ← gitignored
```

Contributors only need Node.js. The first `./xomdaw generate` downloads the pinned version into the project-local
cache at `.xomda/wrapper/`; subsequent invocations reuse it.

## Generating the wrapper

In your project root:

```bash
npx xomda wrapper                 # pins the version of xomda you just ran
npx xomda wrapper --pin 1.2.3     # or pin an explicit version
npx xomda wrapper --force         # overwrite existing xomdaw / xomdaw.cmd
```

Then add to `.gitignore`:

```
.xomda/wrapper/node_modules/
```

Commit `xomdaw`, `xomdaw.cmd`, and `.xomda/wrapper/xomda-wrapper.json`.

## Using it

```bash
./xomdaw generate
./xomdaw preview
./xomdaw diff
```

Anything you can pass to `xomda` works through `xomdaw` — the wrapper forwards all arguments verbatim.

## How it works

1. `xomdaw` reads the pinned version from `.xomda/wrapper/xomda-wrapper.json`.
2. If `.xomda/wrapper/node_modules/xomda/` is missing or its version doesn't match the pin, it writes a minimal
   `package.json` next to it and runs `npm install` to fetch the pinned `xomda` from the npm registry.
3. It resolves the `bin.xomda` entry from the installed package and execs `node .../xomda/<bin>` with your arguments.

`npm` is bundled with Node, so the only prerequisite on a contributor's machine is Node itself.

## CI

Cache `.xomda/wrapper/node_modules/` keyed on the contents of `.xomda/wrapper/xomda-wrapper.json` to avoid
re-downloading xomda on every build.

## Why not just `npx xomda@<version>`?

You can. The wrapper adds three things on top:

- **Discoverability.** `./xomdaw` in the repo root is an obvious entry point. Newcomers don't need to know which
  version to type.
- **Version pinning in one place.** The pin lives in `xomda-wrapper.json`, not scattered across CI scripts and
  developer aliases.
- **No global state.** No reliance on the npm cache being warm or on a globally installed xomda.

If those aren't constraints you have, skip the wrapper — `npx xomda@<version>` is fine.
