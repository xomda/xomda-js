# `.backlog/` — plans pending future thought

This folder holds **standalone plan files** for work that has been thought
about but not committed to. Each `*.md` file is one self-contained idea:
context, recommended approach, critical files, verification steps.

Think of it as the place where the loose ends of "we should look at this
some day" live, alongside half-baked designs that might mature, get
adapted, or be discarded.

This is distinct from [`../TODO.md`](../TODO.md), which is the structured
**roadmap** of larger initiatives. Items here are smaller, exploratory,
or single-topic — and may graduate into TODO.md, into a real change, or
into the bin.

## Lifecycle of an item

Each plan file passes through one of four end states:

| End state      | What to do                                                          |
| -------------- | ------------------------------------------------------------------- |
| **Done**       | Delete the file. The git history is the receipt.                    |
| **Deprecated** | Delete the file. (Optionally note _why_ in the commit message.)     |
| **Adapted**    | Edit the file in-place to reflect the new framing. Bump the date.   |
| **Pending**    | Leave it. Periodically re-read to confirm it's still relevant.      |

When a plan ships, the file goes away — it does not stay around as a
monument.

## Rules for AI agents

**Do not auto-traverse this folder.** This is the load-bearing rule.

- During a normal task (bug fix, feature, refactor, review), **do not
  read, scan, or grep this folder**. It is intentionally hidden
  (dot-prefix) so default `ls`/glob walks skip it.
- **Do not** proactively check whether the change you're making
  satisfies, contradicts, or relates to anything in here.
- **Do** read or list items here when, and only when:
  1. The user explicitly asks ("check the backlog", "any plan for X?",
     "is there a future-plan note about Y?", "review the backlog").
  2. You just finished work that **clearly** matches the title of an
     item you happen to remember — in that case, **ask the user** before
     opening or modifying anything here. Do not silently mark items done.

Auto mode / agent loops must not include "scan `.backlog/`" as a step.
Maintenance is a human-initiated activity.

When the user asks you to maintain the backlog:

- Re-read each file. For each, ask the user (one at a time, or in
  small batches) which end state applies — done, deprecated, adapted,
  pending — and act accordingly.
- Flag items whose **Context** section no longer matches reality
  (e.g. the referenced files moved or the problem dissolved) — those
  are candidates for deprecation.

## File conventions

- **Name**: `kebab-case-topic.md`. No date prefix, no priority prefix.
- **Structure** (mirrors the plan-mode output the agent harness emits):
  - `# <Title>`
  - `## Context` — _why_ this plan exists; the problem or need it
    addresses.
  - Design / approach sections (recommended approach only, not all
    alternatives).
  - `## Critical files` — paths the eventual change would touch.
  - `## Verification` — how to confirm it worked, end-to-end.

Files written by `/plan` mode at `~/.claude/plans/*.md` can be moved
here verbatim — the structure already matches.
