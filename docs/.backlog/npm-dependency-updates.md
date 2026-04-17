# npm dependency updates in the node analysis plugin

Detailed plan for adding an "available updates" view and an update action to the
node analysis plugin. Surfaces what every dep could be bumped to, and writes
those bumps back to `package.json` without invoking a package manager.

Owner: TBD. Status: proposed. Created 2026-05-20.

## Goal

In the project view for a Node project, show each declared dependency with:

- the range currently written in `package.json`,
- the **max version that still satisfies that range** ("in-range"),
- the **registry `latest`** ("out-of-range"),
- a deprecation badge when present,

and let the user write new ranges back to `package.json` (per row, or in bulk
for "all in-range", "all latest"). The package manager (`pnpm` / `npm` / `yarn`
/ `bun`) is intentionally **not** assumed — we only edit the manifest. The user
runs install themselves.

Non-goals (for the first iteration):

- Running `pnpm install` / writing lockfiles.
- Showing the *installed* version (would require lockfile parsing).
- Cross-workspace bulk updates from the root view.
- Updating peer / optional dependencies (shown, but not actionable).

## Background

The data path is already 80% in place:

- [`packages/analysis/node/src/npm-fetcher.ts`](../../packages/analysis/node/src/npm-fetcher.ts)
  resolves the npm registry's `/{pkg}/latest` endpoint for every dep, behind a
  concurrency queue (`PER_FETCH_CONCURRENCY = 8`).
- [`packages/analysis/node/src/package-parser.ts`](../../packages/analysis/node/src/package-parser.ts)
  parses `package.json` into a `NodePackageMeta` object.
- [`packages/analysis/node/src/NodePackageInfoView.tsx`](../../packages/analysis/node/src/NodePackageInfoView.tsx)
  renders dep tables, but currently only shows `name` + `range` — `latest` /
  `deprecated` from the fetcher never reach the screen.

The plan reuses this slice and adds: a registry call that returns the full
versions list, semver-aware bump computation, a tRPC mutation that writes the
new ranges, and UI affordances.

## Why this approach

1. **Per-package packument fetch from `registry.npmjs.org`** is the same pattern
   `npm outdated`, `pnpm outdated`, and `npm-check-updates` use. There is no
   bulk endpoint on the npm registry; everyone fans out one request per
   package and relies on parallelism + caching.
2. **No package-manager dependency.** Reading the manifest is universal;
   shelling out to `pnpm`/`npm`/`yarn`/`bun` is not (we don't know which is
   installed, in what version, against what lockfile). Edit `package.json`,
   tell the user to install.
3. **Abbreviated packument + ETag caching** keeps the network cost reasonable:
   `Accept: application/vnd.npm.install-v1+json` is 5–20× smaller than the
   full doc, and the registry returns strong `ETag`s so re-runs are mostly
   `304 Not Modified`.

## Architecture

### Server side (`@xomda/analysis-plugin-node`)

```
package.json ──► package-parser ──► NodePackageMeta
                                        │
                                        ▼
                              npm-fetcher (packument)
                                        │
                                        ▼
                              UpdateCandidate[]
                                        │
                                        ▼
                       view data ─► client (read)
                                        │
                                        ▼
                       tRPC mutation (write) ──► package.json
```

`UpdateCandidate` is the row shape the UI consumes:

```ts
interface UpdateCandidate {
  name: string
  scope: 'dep' | 'devDep' | 'peerDep' | 'optionalDep'
  range: string                // exact text from package.json
  rangePrefix: '^' | '~' | '=' | '' | 'workspace' | 'catalog' | 'url' | 'git'
  inRange?: string             // max version satisfying `range`
  latest?: string              // dist-tag latest
  bump?: 'none' | 'patch' | 'minor' | 'major'  // range → latest
  deprecated?: string
  error?: string
  actionable: boolean          // false for workspace:/catalog:/url/git
}
```

### Client side (`./client.ts` + `NodePackageInfoView.tsx`)

- New columns: `In range`, `Latest`, `Bump`, deprecation badge, per-row action
  button.
- New header actions: "Update all in-range" and "Update all to latest" (with a
  confirm dialog for the latter — major bumps are breaking).
- Reuses the existing view-data plumbing — the data is already streamed from
  server to client through the analysis runner.

### Persistence

A tRPC mutation on the model router writes the new ranges. Manifest writes go
through the existing idempotent file-storage layer so a no-op write does not
dirty `model.json` or `package.json`
(see [feedback_model_save_idempotency](../../.claude/projects/-Users-joris-dev-modelman/memory/feedback_model_save_idempotency.md)
in user memory).

## Implementation steps

Each step is intended to land as its own commit, per the
[commit-regularly](../../.claude/projects/-Users-joris-dev-modelman/memory/feedback_commit_regularly.md)
rule. Tests ship with the step that adds the behaviour
(see [feedback_testing](../../.claude/projects/-Users-joris-dev-modelman/memory/feedback_testing.md)).

### 1. Switch to packument + abbreviated `Accept` header

File: [`packages/analysis/node/src/npm-fetcher.ts`](../../packages/analysis/node/src/npm-fetcher.ts).

- Replace `GET /{pkg}/latest` with `GET /{pkg}` and
  `Accept: application/vnd.npm.install-v1+json`.
- Parse `dist-tags.latest`, `versions` (object keys), `time` (optional, for
  "published N days ago"), `versions[latest].deprecated`.
- Keep the 404-as-null path; surface 5xx as `error` on the row.
- Add ETag persistence:
  - In-memory `Map<name, { etag, body }>` keyed by package name, cleared per
    analysis run. Send `If-None-Match` on subsequent fetches in the same run.
  - Persistent cache: out of scope for this iteration; punt to a follow-up
    (see "Future work").
- Add `npm-registry-fetch`-style auth read from `.npmrc` (`//registry.npmjs.org/:_authToken=…`)
  so private/scoped packages work. Token forwarded as `Authorization: Bearer …`.
  Scope: only the default registry — multi-registry support is follow-up.

Tests (`__tests__/npm-fetcher.spec.ts`):

- Mocked `fetch` returns a packument; assert versions + latest + deprecation
  flow through.
- 404 → row with no version, no error.
- 5xx → row with `error`.
- Second call with stored ETag sends `If-None-Match` and treats `304` as a
  cache hit.

### 2. Compute `UpdateCandidate` rows

New file: `packages/analysis/node/src/update-candidates.ts`.

- Add `semver` as a dep of `@xomda/analysis-plugin-node` (small, no native).
- For each parsed dep:
  - Classify `rangePrefix` from the raw string (`^`, `~`, exact, `workspace:`,
    `catalog:`, `npm:`, `file:`, `git+…`, URL). Anything not a plain semver
    range → `actionable: false`.
  - `inRange = semver.maxSatisfying(versions, range, { includePrerelease: false })`.
  - `latest = packument['dist-tags'].latest`.
  - `bump = semver.diff(currentMinVersion, latest)` (`null` → `'none'`,
    otherwise `'patch' | 'minor' | 'major' | 'premajor' | …` collapsed to
    the four we care about).
- Return `UpdateCandidate[]` ordered by scope, then bump severity desc
  (`major` first), then name asc.

Tests (`__tests__/update-candidates.spec.ts`):

- `^1.2.0` with versions `[1.2.0, 1.2.5, 1.3.0, 2.0.0]` → `inRange = 1.3.0`,
  `latest = 2.0.0`, `bump = 'major'`.
- `~1.2.0` → `inRange = 1.2.5`, `bump = 'major'`.
- Exact `1.2.0` → `inRange = 1.2.0`, actionable yes.
- `workspace:*` → `actionable: false`, no `inRange`/`latest` computed.
- Deprecated `latest` flows through.

### 3. Surface `UpdateCandidate[]` in the view payload

Files: `loadViewData` in the node plugin's view (and types in `client.ts`).

- Extend the existing payload from `NodePackageMeta` to
  `{ meta: NodePackageMeta; updates: UpdateCandidate[] }`.
- No fetcher change — the fetch already happens during analysis. This step
  just plumbs the data into the view payload.

### 4. Render new columns + badges (read-only)

File: [`packages/analysis/node/src/NodePackageInfoView.tsx`](../../packages/analysis/node/src/NodePackageInfoView.tsx).

- Replace `DEP_TABLE` with a richer table component:
  - Columns: Name · Range · In-range · Latest · Bump · (action).
  - Bump badge colours: patch (success), minor (info), major (warning),
    deprecated (error).
  - Tooltip on bump badge: "1.3.0 → 2.0.0 (major)".
  - Hide `In-range`/`Latest` for non-actionable rows; show a muted label
    (`workspace:` / `git:` / …).
- A storybook story per state: loading, fresh, mixed bumps, all deprecated,
  errored, workspace-only.

Stop here for a meaningful first PR. The view is now informational but
read-only — no write path yet.

### 5. Manifest writer

New file: `packages/analysis/node/src/manifest-writer.ts`.

- `applyUpdates(raw: string, updates: Array<{ name: string; scope: …; newRange: string }>): string`.
- Preserve indentation (detect from existing manifest) and trailing newline.
- Preserve key order within each dependency object (don't reserialize via
  `JSON.parse` + `JSON.stringify` blindly — instead, locate the key and
  rewrite only the value substring; or use a JSON-AST library if formatting
  fidelity is critical). Pick approach during implementation; prefer the
  simpler substring rewrite if package.json round-trips cleanly through
  `JSON.parse` + `JSON.stringify(_, null, indent) + '\n'` for the codebase's
  typical manifests.
- Idempotent: if the new range equals the existing one, return the original
  string unchanged (object identity check at the caller will then skip the
  write).

Tests (`__tests__/manifest-writer.spec.ts`):

- Single update preserves indentation (2-space + tab variants).
- Multiple updates across `dependencies` and `devDependencies` in one call.
- No-op update returns the exact same string.
- Range with `^` prefix bumped: `^1.2.0` → `^1.3.0`. Pinned stays pinned:
  `1.2.0` → `1.3.0`.
- Non-actionable rows rejected by precondition (throws — caller must filter).

### 6. tRPC mutation

In the model router (the right home is the node plugin's own router contribution
if that pattern exists; otherwise extend `@xomda/model`).

```ts
node.applyDependencyUpdates({
  projectPath: string,
  updates: Array<{ name: string; scope: 'dep' | 'devDep'; newRange: string }>,
}) → { applied: number; skipped: number; manifestPath: string }
```

- Reads the manifest, runs `applyUpdates`, writes via the file-storage layer
  (idempotent — no-op writes don't touch disk).
- After the write, invalidates the analysis cache for that project so the
  next view load reflects the new ranges.

Tests:

- Router test with a tmp project: writes new ranges, file content matches.
- No-op call returns `applied: 0` and does not touch the file (mtime
  unchanged).

### 7. Wire up "Update" actions in the UI

File: `NodePackageInfoView.tsx`.

- Per-row button (chip): "Update to in-range" when `bump in {patch, minor}`,
  "Update to latest" when major.
- Header buttons:
  - "Update all in-range" — applies `inRange` to every actionable row where
    `inRange !== currentRange`. No confirm.
  - "Update all to latest" — applies `latest`. Confirm dialog summarises how
    many majors are included.
- After the mutation succeeds, refresh view data (the analysis runner re-emits;
  if not, an explicit refetch). Toast: "Updated N dependencies in
  `package.json`. Run your package manager to install."

Tests:

- Component test (vitest + happy-dom or storybook play): clicking the row
  button calls the mutation with the right payload; bulk button confirms before
  firing.

### 8. Cypress smoke test

Add an end-to-end flow in `@xomda/e2e-tests`:

- Open a project that has an outdated dep (use a fixture with a pinned old
  version of a stable package, mocked at the network layer).
- Assert the bump badge renders.
- Click "Update to latest".
- Assert `package.json` on disk now has the new range.

## Risks and decisions to make during implementation

- **Manifest formatting fidelity.** Decide between substring-rewrite (preserves
  comments-via-property-order trivia perfectly but is fiddly) vs. JSON
  round-trip (simpler, but reorders keys if the manifest had unusual ordering
  and strips any trailing-comma quirks). Recommendation: round-trip with
  `detect-indent`; document the constraint in the writer's header comment.
- **Prereleases.** `semver.maxSatisfying` excludes prereleases by default; that
  matches `npm outdated`. Keep it that way. No UI option in v1.
- **Private registries.** `.npmrc` parsing in v1 only handles the default
  registry. Scoped registries (`@acme:registry=…`) are common enough to be a
  fast-follow.
- **Lockfile drift.** Editing `package.json` without touching the lockfile
  leaves the project in a "needs install" state. The toast must say so;
  consider a future enhancement that detects the lockfile and surfaces a hint
  (still without running install).
- **Workspace catalogs (pnpm).** `catalog:` ranges resolve via
  `pnpm-workspace.yaml`. Treat as non-actionable in v1.
- **Rate limits.** The public registry is generous but not infinite. The
  existing concurrency cap (8) is the right ceiling. ETag-based 304s keep the
  payload cost negligible across repeated analysis runs.

## Out of scope / future work

- **Persistent ETag cache** across analysis runs (sqlite or a JSON file under
  `.xomda/cache/npm-registry/`). Big quality-of-life win for large workspaces.
- **Running the install** (a separate "Apply with pnpm/npm/…" action that
  detects the package manager from the lockfile and streams output). Worth its
  own design pass.
- **Cross-workspace bulk updates** from the root project view.
- **Update preview / changelog link** — link out to the npm page or to the
  release-notes URL from the packument's `repository`.
- **Security advisories** via the npm `/-/npm/v1/security/audits/quick`
  endpoint, or GitHub's GraphQL `securityVulnerabilities`. Separate feature
  but the row shape can accommodate it later.

## File map

New:

- `packages/analysis/node/src/update-candidates.ts`
- `packages/analysis/node/src/manifest-writer.ts`
- `packages/analysis/node/src/__tests__/update-candidates.spec.ts`
- `packages/analysis/node/src/__tests__/manifest-writer.spec.ts`

Modified:

- `packages/analysis/node/src/npm-fetcher.ts` (packument + ETag + auth)
- `packages/analysis/node/src/NodePackageInfoView.tsx` (columns, badges, actions)
- `packages/analysis/node/src/client.ts` / `index.ts` (types, view payload)
- `packages/analysis/node/package.json` (add `semver`)
- Wherever the node plugin contributes tRPC procedures (new mutation)
- `packages/e2e-tests/...` (one new smoke spec)

## Effort estimate

- Steps 1–4 (read-only with updates surfaced): **~1 day** including tests.
- Steps 5–7 (write path + UI): **~1–2 days** including tests.
- Step 8 (Cypress) + polish: **~½ day**.

**Total: ~3 days of focused work** for an MVP that's safe to ship.
