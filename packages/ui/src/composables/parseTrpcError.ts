/**
 * Structured shape of a tRPC failure as the UI cares about it.
 *
 * A tRPC procedure can fail in three meaningful ways:
 * - **transport** — the server is unreachable. `transport === true`, no fields.
 * - **validation** — Zod input parsing rejected the request. `fields[]` is
 *   non-empty with one entry per offending field.
 * - **server** — the procedure threw a known `TRPCError`. `code` is set,
 *   `message` is the procedure's message.
 *
 * Consumers should branch on the presence of `fields[]` first (to render
 * per-field errors next to inputs), then `transport` (to render a single
 * "server unreachable" banner), then `message` as the generic fallback.
 *
 * **Note on the summary `message`.** When `fields[]` is non-empty, `message`
 * mirrors `fields[0].message` so callers that don't render per-field still
 * have something to show. For forms with cross-field errors, prefer rendering
 * each `fields[i].message` next to its input — picking only the first hides
 * the rest.
 */
export interface ParsedTrpcError {
  /** Human-readable summary. Always present. */
  message: string
  /** TRPC error code if the server set one (BAD_REQUEST, NOT_FOUND, …). */
  code?: string
  /** Per-field Zod issues. Empty array if the failure was not a validation error. */
  fields: { message: string; path: (string | number)[] }[]
  /** True when the request never reached the server (network / fetch failure). */
  transport: boolean
}

/**
 * Override the default transport-failure message. Apps that don't run a
 * separate `@xomda/node` server (e.g. embedded in vscode) should set this
 * once at startup so the user-facing text matches the deployment shape.
 *
 * **Lifecycle:** Module-scoped — call once during app bootstrap (before
 * any tRPC request), do not re-bind from inside components. Tests can
 * reset by calling with the original message:
 *
 * ```ts
 * import { setTransportFallbackMessage } from '@xomda/ui'
 * setTransportFallbackMessage('Could not connect to the xomda server. Is @xomda/node running?')
 * ```
 */
let transportFallback = 'Could not connect to the xomda server. Is @xomda/node running?'

export function setTransportFallbackMessage(message: string): void {
  transportFallback = message
}

/**
 * Normalises a tRPC client error into {@link ParsedTrpcError}.
 *
 * Handles four shapes the tRPC client emits:
 * 1. A `TRPCClientError` whose `data` carries `{ code, zodError? }`.
 * 2. A regular `Error` whose `message` is a JSON-encoded Zod issue array
 *    (legacy shape used by tRPC `errorFormatter` overrides).
 * 3. A network failure — `TypeError` whose message identifies it as a
 *    fetch outage (Node undici: "fetch failed"; Chrome/Firefox/Safari:
 *    various phrases; covered by {@link isFetchFailure}).
 * 4. A primitive throw (`'string'`, `42`, `null`) — preserved verbatim
 *    when possible, falls back to "Unexpected error".
 *
 * `cause` chains are walked to any depth, so a tRPC client error wrapping
 * a wrapper around a `TypeError` still resolves to a transport failure.
 */
export function parseTrpcError(err: unknown): ParsedTrpcError {
  if (isFetchFailure(err)) {
    return { message: transportFallback, fields: [], transport: true }
  }

  if (err instanceof Error || (err && typeof err === 'object')) {
    const e = err as { data?: { code?: string; zodError?: unknown }; message?: string }

    // Tri-state Zod extraction:
    //   - undefined  → not a Zod failure at all
    //   - []         → known Zod failure with no extractable issues
    //   - [...]      → populated per-field issues
    // Both `fieldErrors` (newer tRPC) and `issues[]` (older) are recognised.
    // The legacy JSON-stringified-message format is handled separately
    // because it carries no top-level shape we can distinguish.
    const zodFields = extractZodIssues(e.data?.zodError)
    if (zodFields !== undefined) {
      // Empty bag → friendly summary; the raw "BAD_REQUEST" code wouldn't
      // help the user (or even the developer) understand what went wrong.
      const summary = zodFields[0]?.message ?? 'Validation failed'
      return {
        message: summary,
        code: e.data?.code,
        fields: zodFields,
        transport: false,
      }
    }

    const legacyFields = extractJsonMessage(e.message)
    if (legacyFields && legacyFields.length > 0) {
      return {
        message: legacyFields[0].message,
        code: e.data?.code,
        fields: legacyFields,
        transport: false,
      }
    }

    const message = e.message?.trim() || 'Unexpected error'
    return { message, code: e.data?.code, fields: [], transport: false }
  }

  return { message: String(err ?? 'Unexpected error'), fields: [], transport: false }
}

/**
 * True when the error or any link in its `cause` chain looks like a
 * network outage. Recurses to handle tRPC v11's pattern of wrapping a
 * `TRPCClientError → cause: TRPCClientError → cause: TypeError`.
 *
 * Browser-specific message strings:
 * - Node undici: `fetch failed`
 * - Chrome: `Failed to fetch`
 * - Firefox: `NetworkError when attempting to fetch resource.`
 * - Safari: `Load failed`
 */
function isFetchFailure(err: unknown, seen = new WeakSet<object>()): boolean {
  if (!err || typeof err !== 'object') return false
  if (seen.has(err)) return false
  seen.add(err)
  const e = err as { cause?: unknown; name?: string; message?: string }
  if (looksLikeFetchTypeError(e)) return true
  return isFetchFailure(e.cause, seen)
}

function looksLikeFetchTypeError(e: { name?: string; message?: string }): boolean {
  if (e.name !== 'TypeError') return false
  const msg = e.message ?? ''
  return (
    /fetch failed/i.test(msg) ||
    /failed to fetch/i.test(msg) ||
    /networkerror/i.test(msg) ||
    /load failed/i.test(msg)
  )
}

/**
 * Tri-state extractor for tRPC's `data.zodError` payload.
 *
 * - `undefined` — the value isn't a Zod-error shape at all (no
 *   `fieldErrors` object, no `issues` array). Caller falls back to the
 *   legacy JSON-message path or the plain `message`.
 * - `[]` — recognised as a Zod failure but Zod handed us an empty bag.
 *   Caller uses a friendly "Validation failed" summary instead of the
 *   raw `BAD_REQUEST` code.
 * - `[…]` — populated per-field issues, ready to render next to inputs.
 *
 * Both shapes are checked because newer tRPC versions emit `fieldErrors`
 * for object-shaped inputs and older ones emit `issues[]`.
 */
function extractZodIssues(zodError: unknown): ParsedTrpcError['fields'] | undefined {
  if (!zodError || typeof zodError !== 'object') return undefined
  const z = zodError as {
    fieldErrors?: Record<string, string[]>
    issues?: { message: string; path: (string | number)[] }[]
  }

  const hasFieldErrors = typeof z.fieldErrors === 'object' && z.fieldErrors !== null
  const hasIssues = Array.isArray(z.issues)
  if (!hasFieldErrors && !hasIssues) return undefined

  const out: ParsedTrpcError['fields'] = []
  if (hasFieldErrors && z.fieldErrors) {
    for (const [path, messages] of Object.entries(z.fieldErrors)) {
      for (const message of messages ?? []) out.push({ message, path: [path] })
    }
  }
  if (out.length === 0 && hasIssues && z.issues) {
    for (const i of z.issues) out.push({ message: i.message, path: i.path ?? [] })
  }
  return out
}

function extractJsonMessage(message: string | undefined): ParsedTrpcError['fields'] | undefined {
  if (!message) return undefined
  try {
    const parsed = JSON.parse(message)
    if (Array.isArray(parsed)) {
      return parsed.map((p: { message?: string; path?: (string | number)[] }) => ({
        message: p.message ?? 'Unknown error',
        path: p.path ?? [],
      }))
    }
  } catch {
    // Not JSON — caller falls back to message string.
  }
  return undefined
}
