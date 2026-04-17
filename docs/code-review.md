# Code-review instructions for AI agents

> Instruction set for any review, audit, critique, or "code review" of the xomda
> codebase. When the user asks for any of those, read this file first, then
> follow it. AGENTS.md remains the source of truth for project rules — this
> file is the source of truth for **how to conduct a review**.

## 0. Before you start

1. Re-read `AGENTS.md`. The "Essential rules" (§"Essential rules" 1–19), the
   "Canonical composables and stores" table, and the "Bans (anti-patterns)"
   block are the standards you measure findings against.
2. Identify the scope: a focused bug review, a feature audit, or a full
   platform-level audit. Scale your output (§5) to match — do not produce 18
   sections for a 30-line change.
3. If the scope is unclear, ask one sharp clarifying question. Otherwise
   proceed with the multi-angle audit described below.

## 1. The quality bar

Hold the codebase to **Apple-style craftsmanship**. Direct user phrasing
captured from this project's history:

- _"Every detail counts. Every interaction considered, every edge case handled
  gracefully, every transition deliberate."_
- _"Smart, reusable ideas — but no over-engineering. Everything must fall in
  place because the principles are right."_
- _"This codebase should be an example of dedicated and well-thought-of
  craftsmanship, intellect, smart thinking, clever solutions."_
- _"The most epic product ever."_

The bar is **not**:

- Cargo-culted enterprise patterns.
- Architecture-astronaut over-abstraction.
- Performative thoroughness — flagging 50 nits to look thorough.
- Shallow "best practice" advice the user could get from a blog post.
- Trendiness for its own sake.
- Lint-level commentary that the configured ESLint/Stylelint already catches.

### Entropy and abstraction — when to centralise, when to leave it alone

Entropy is the thing we manage; it is **not** the thing we minimise at any
cost. Centralisation and abstraction reduce entropy _only when they pay for
themselves_. A review that flags every repeated five-line block as
"duplication" creates more entropy than it removes — by relocating
complexity to a place no one expects to find it.

Heuristics for proposing (or accepting) a centralisation finding:

- **Specific purpose, not "does it all".** Generic code must serve a _named_
  job. If you cannot state the abstraction's purpose in one sentence
  without weasel words ("flexible", "configurable", "supports various"),
  the abstraction isn't ready yet — leave the duplication.
- **Two occurrences are coincidence. Three is a pattern.** Resist
  DRY-for-DRY's-sake on the second case; wait for the third before
  extracting. Premature shared abstractions are expensive to undo because
  every consumer becomes a constraint.
- **The consumer must read better, not just shorter.** A refactor that
  replaces three readable inline blocks with three opaque
  `useThing({ mode: 'x', variant: 'y', overrides: {...} })` call sites is
  a net loss. The call site is the design surface; if it reads like a
  configuration object handed to an oracle, the abstraction is
  wrong-shaped.
- **The contract has to be sharp.** If the JSDoc for the new helper needs
  more than two sentences to describe its purpose, or has to list
  exceptions for each consumer ("returns X, except when called from Y, in
  which case Z"), it has not yet earned generalisation. Split it or wait.
- **No bolt-on optional parameters to absorb the next caller.** If
  consumer N+1 only fits the abstraction by growing an `opts.X?` flag,
  the prior generalisation didn't cleanly subsume the earlier cases —
  it modelled some-of-them well and the rest by exception. That's
  entropy disguised as reuse.
- **Local complexity is cheap; shared complexity is expensive.** A
  10-line inline state machine living next to its only consumer is
  trivial to refactor when requirements change. The same 10 lines as a
  shared composable couples N consumers to its contract — every future
  change pays the coupling tax.
- **Refactors must make sense on their own.** A refactor whose only
  justification is "consistency" — without a concrete pain it eliminates
  (an actual bug class, a measurable cognitive cost, a real onboarding
  trap) — is performative.

When the right call is to _leave_ duplication alone, say so explicitly in
the review: e.g. _"three occurrences, but the right abstraction isn't
visible yet — re-evaluate at five."_ Naming the deferral is part of the
review; silent omission is not.

## 2. The roles to hold — simultaneously

Don't fragment the review by switching hats. Hold all of these at once; let
each lens inform the others.

- **Staff / principal engineer** — architecture quality, hidden complexity,
  brittle abstractions, framework abuse, leaky boundaries, scalability risks.
- **Tech lead** — long-term maintainability, code ownership clarity, dev
  velocity, onboarding cost, consistency across modules, technical-debt
  trajectory.
- **Product engineer** — does the architecture support rapid feature work?
  Does the structure map to the product domain (MDA two-tier: model layer +
  template layer)?
- **UX/UI expert** — design-system coherence, component-API quality,
  visual hierarchy, accessibility, interaction quality, perceived
  performance, spacing/typography/density consistency.
- **Functional analyst** — is business logic explicit? Is terminology
  consistent? Are business rules centralised or fragmented?
- **Project manager** — delivery risk, release confidence, operational
  risk, hidden complexity that would slow future delivery.
- **QA / test architect** — test pyramid balance, flakiness, missing
  integration / contract / E2E coverage, testability of the architecture
  itself.
- **DevOps / platform engineer** — CI/CD quality, reproducibility, env
  consistency, observability, build performance, caching opportunities.
- **Security engineer** — trust boundaries, input validation, API safety,
  auth flows, dependency risks, supply-chain concerns, frontend attack
  surface, secret exposure.
- **AI-assisted-development expert** — naming quality, discoverability,
  predictability, architectural clarity, type quality, code locality,
  documentation quality, self-descriptiveness. Can a future AI agent safely
  modify features, infer architecture correctly, extend modules predictably,
  understand business intent?

## 3. The method

### For deep audits

**Dispatch parallel review agents.** Use the Agent tool with multiple
invocations in a single message — five lenses is the typical split:

1. Architecture + duplication
2. Code quality (clever-but-fragile, leaky abstractions, parameter sprawl)
3. Test quality (tautological assertions, brittle matches, missing
   behavioural coverage)
4. UX consistency (loading patterns, empty states, error display, keyboard,
   a11y, animation tokens, design tokens)
5. AI-readiness (typing, naming, discoverability, code locality)

Each agent gets the diff or the relevant tree path. Aggregate findings
yourself; deduplicate; rank by impact × cost.

### For focused reviews

Inline review is fine. Skip the parallel-agent overhead for diffs under
~300 lines or single-file changes. Still apply the multi-role lens.

### What to compare against

- **`AGENTS.md` §"Essential rules" 1–19** — every violation is a finding.
- **`AGENTS.md` §"Canonical composables and stores"** — a parallel
  implementation of `useMutation` / `useEditBuffer` / `useNotificationsStore`
  / `parseTrpcError` / `useNodeDrag` is a review-blocking issue.
- **`AGENTS.md` §"Bans (anti-patterns)"** — the four explicitly forbidden
  patterns (silent `console.error` on tRPC failures, JSON-stringify dirty
  checks, inline pointer-down/move/up state machines, direct
  `localStorage.setItem`) are auto-fail.

## 4. The scope to audit

Categories — adapt depth to the scope of the change being reviewed.

**Architecture**

- Layering, boundaries, circular deps, god modules, separation of concerns,
  inconsistent patterns, weak domain encapsulation.

**Frontend (Vue 3, TSX, SCSS modules, tRPC client)**

- TSX quality, component composition, reactive architecture, state
  management, re-render risks, prop/event consistency, async/error
  handling, form architecture, data fetching, caching, optimistic updates.
- SCSS module isolation, CSS leakage, design-token usage, theming
  (light + dark must both be first-class), responsiveness, density
  consistency.

**TypeScript**

- `any` usage (banned outside the sanctioned `env.d.ts` Vue vnode hook
  shim — AGENTS.md §2). Discriminated unions, branded types, precise
  literal unions. Runtime/type divergence (Zod schema vs TS type drift).

**tRPC**

- Router organisation, input validation, error modelling, shared schema
  strategy (schemas live in `@xomda/core` per AGENTS.md §11), type
  propagation, API boundary quality.

**Java / Kotlin (`integrations/jvm/`)**

- Boundary quality, DTO/serialisation consistency, error propagation,
  config consistency, runtime-compatibility risks, ecosystem duplication.
- Eclipse formatter + Checkstyle rules in `eclipse-formatter.xml` +
  `checkstyle.xml`. Single-import only (AGENTS.md §"Java / Kotlin code
  style").

**SCSS / design system**

- Token architecture, naming consistency, reusability, specificity
  problems, layout consistency, dark-mode parity, scalability of the
  styling architecture, magic numbers (durations, easings, radii, colours).

**Testing**

- Test pyramid balance, redundant tests, brittle tests, low-value snapshot
  tests, missing integration / contract / E2E coverage, flaky-test risk,
  testability of the architecture itself.
- **Bug fixes follow strict red→green TDD** — see §7 below.

**Performance**

- Bundle size, lazy-loading opportunities, rendering inefficiencies,
  memory leaks, hydration issues, network inefficiencies, expensive
  reactivity, abstraction overhead.

**Security**

- Trust boundaries, input validation, API safety, auth flows,
  authorisation, dependency risks, frontend attack surface, secret
  exposure, supply-chain concerns.

**Code quality**

- Duplication, dead code, hidden complexity, overly-clever code,
  under-engineered code, naming, file organisation, cognitive load.

**Repository structure**

- Workspace structure, package boundaries, ownership clarity, generated
  code placement, build orchestration, dependency-graph sanity.

**Documentation**

- Architecture docs, onboarding docs, operational docs, ADRs, coding
  standards, dependency rationale, JSDoc on exported symbols (AGENTS.md §19).

## 5. The output format

For deep audits, produce a structured report with these 18 sections.
**Cap word counts to keep findings dense and scannable.** If a section
has no findings, say so in one line and move on — don't pad.

1. **Executive summary** — brutally honest overview, 4–6 sentences.
2. **Architectural assessment** — deep dive.
3. **Critical issues** — highest-priority, ordered by severity.
4. **High-leverage improvements** — best long-term ROI, ordered.
5. **Duplication & reusability audit** — patterns to consolidate.
6. **AI-readiness assessment** — discoverability, predictability,
   self-descriptiveness.
7. **Frontend audit** — Vue / TSX / SCSS / tRPC.
8. **Backend & integration audit** — Java/Kotlin/TS.
9. **Testing & reliability audit**.
10. **UX/UI audit**.
11. **Performance audit**.
12. **Security & operational audit**.
13. **Developer experience audit**.
14. **Repository & workspace structure audit**.
15. **Refactoring roadmap** — ordered by impact × (1 / cost) × strategic
    value. Each item: scope, estimated commits, blast radius.
16. **Architectural principles to adopt** — concrete rules to enforce.
17. **Anti-patterns to eliminate** — explicit list with file:line.
18. **Final verdict** — what this codebase could realistically become if
    improved correctly.

For smaller reviews, emit only the sections with findings.

## 6. For every finding

Required fields:

- **Severity** — `critical` / `major` / `minor` / `nit`
- **File:line** — concrete reference, not "somewhere in the views"
- **Why it matters** — concretely, not "best practice". What breaks?
- **Long-term consequence if unfixed** — entropy direction, future migration pain
- **Proposed fix** — 1–2 sentences, name the smallest change
- **Tradeoffs** — what does the fix cost?
- **Maintenance impact** — does this make future changes easier or harder?

Below noise floor: <5 lines + zero regression risk + zero clarity gain →
note as `nit` and move on. Don't accumulate trivia.

## 7. After-review actions

When the user asks to act on findings:

1. **Bug fixes follow strict red→green TDD** (AGENTS.md §12):
   - Write the Vitest test reproducing the bug. **Run it. Confirm it FAILS.**
   - Fix the bug. **Run it. Confirm it PASSES.**
   - Commit as one atomic unit (test + fix together).
2. **One commit per logical unit of work** (AGENTS.md §14). Not one big batch.
3. **Run a `/simplify` pass after a round of fixes** to catch
   reuse/quality/efficiency regressions introduced by the patches.
4. **Run `pnpm typecheck && pnpm lint && pnpm -r test`** before declaring
   done. CI is the gate; pre-empt it.

## 8. Questions to keep asking

Hold these in the back of your mind throughout the review:

- Will this still be understandable in 5 years?
- Can a new developer become productive quickly?
- Can an AI agent safely extend this without regression?
- Is this abstraction actually paying for itself?
- Does this reduce or increase entropy?
- Does this architecture reflect the business domain (MDA two-tier)?
- Would elite engineers respect this design?

## 9. Patterns to be especially critical of

These break AI inference, break onboarding, and accumulate entropy:

- **Magic behaviour** — auto-registered side-effect imports, implicit conventions.
- **Hidden state** — module-scoped mutable refs that leak across tests / users
  (e.g. `let counter = 0` outside `defineStore`).
- **Inconsistent architecture** — three different patterns solving the same
  problem in three views.
- **Over-dynamic code** — string-keyed dispatch tables, runtime `eval`-shaped
  logic that defeats type inference.
- **Weak typing** — `any` (banned), `unknown` without narrowing, stringly-typed
  unions where literal-union types exist.
- **Side-effect-heavy modules** — imports that mutate global state at load time.
- **Massive files / god objects** — `packages/client/src/views/ModelView.tsx`
  at 1788 lines is the current canonical bad example; the file owns 5 CRUD
  lifecycles, 5 side-panel buffers, layout-dirty tracking, deep-route sync,
  and 11 try/catch blocks. Mark anything trending toward that shape as a
  refactor candidate.
- **Unclear ownership** — code that could plausibly live in three packages.
- **Duplicated logic** — the same recursive tree walker in three packages,
  the same dirty-check in five views.
- **Over-eager abstraction** — the opposite failure mode. A composable that
  takes `{ mode, variant, overrides, transformers }` and dispatches to N
  internal strategies, where each call site is a different combination.
  The duplication you "removed" now lives inside the helper as branching;
  the call sites became unreadable; one change ripples to every consumer.
  Flag this even when the diff that introduces it is small. See §1
  "Entropy and abstraction" for the heuristics that should have prevented it.
- **Unpredictable naming** — same concept named differently across the codebase
  (e.g. `execute` vs `run`, recently aligned).

## 10. Excellent examples to align new code with

These are the bar:

- **`@xomda/ui` canonical composables** — `useMutation`, `useEditBuffer`,
  `useNotificationsStore`, `parseTrpcError`, `useAsyncState`. Crisp
  single-responsibility contracts, full JSDoc, concurrency- and
  unmount-safe, tested for both happy path and pathological inputs.
- **`useNodeDrag`** — consolidated a triplicated pointer-drag state machine
  across Package / Entity / Enum into a single composable with explicit
  contract (capture target, screen-space threshold, pointer-cancel handling).
- **`AGENTS.md` §"Bans"** — four anti-patterns named explicitly so reviews
  can cite them by reference instead of re-litigating each time.
- **The TDD discipline applied across `f253900..1d8f164`** — five real bugs,
  each fixed via red→green→commit, with regression tests pinning the
  contract the bug violated.

## 11. When NOT to flag

- A finding requires more context than the diff shows → ask, don't speculate.
- A finding is purely stylistic and ESLint/Stylelint already catches it →
  skip; the lint pipeline is the right enforcement layer.
- A finding is the user's stated preference (see project memory files in
  `~/.claude/projects/-Users-joris-dev-modelman/memory/`) → don't fight it.
- The "fix" would touch >50 files for marginal clarity gain → flag as a
  long-term roadmap item, not an immediate action.

## 12. Tone

- Direct. Specific. No hedging.
- Praise mediocre patterns poorly serves the user. Mediocre patterns are
  the entropy you're trying to detect.
- If something is excellent, explain precisely _why_ — so the bar is
  reproducible.
- If something is poor, be direct about _what_ and _why_, without insult.
- The final report should read like a world-class engineering organisation
  auditing a strategic platform.

---

**Read this file in full before any review task.** When in doubt, the
quality bar is: would an elite engineer respect this design? If not, flag it.
