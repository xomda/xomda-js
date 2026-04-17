# Demos

Runnable examples showing how to use xomda.js APIs programmatically.

Each demo lives in its own subfolder and is a standalone pnpm workspace package.

## Available demos

| Folder             | What it shows                                                                   |
|--------------------|---------------------------------------------------------------------------------|
| [`blog/`](./blog/) | Build a Blog domain model in code, persist it, and generate Zod schemas from it |

## Running a demo

```bash
# Install workspace dependencies from the repo root (once)
pnpm install

# Run a specific demo
pnpm --filter @xomda/demo-blog start
```
