/**
 * Structured logger. Framework-agnostic; safe to use from any package.
 *
 * Replaces ad-hoc `console.*` calls so every log entry can be:
 *  - timestamped and tagged with a `source` (the calling subsystem),
 *  - routed to a bounded in-memory ring buffer the UI can render,
 *  - optionally promoted to a user-facing notification (set
 *    `attention: true`), via a sink installed by the consumer.
 *
 * The console mirror remains so dev tooling keeps working. Production
 * consumers should treat console output as a fallback, not the source
 * of truth — `getRecentLogs()` is.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  /** Wall-clock ms since epoch. */
  timestamp: number
  level: LogLevel
  /** Calling subsystem (e.g. `'model'`, `'analysis'`, `'template'`). */
  source: string
  message: string
  /** Optional structured payload. Must be JSON-serialisable. */
  data?: unknown
  /**
   * When true, the entry should also surface as a user-facing notification.
   * The default sink ignores this; install a sink (see `setLogSink`) to
   * route it to your notifications store.
   */
  attention?: boolean
}

export interface LogOptions {
  data?: unknown
  attention?: boolean
}

export interface Logger {
  debug(message: string, options?: LogOptions): void
  info(message: string, options?: LogOptions): void
  warn(message: string, options?: LogOptions): void
  error(message: string, options?: LogOptions): void
  /** Spawn a sub-logger with a longer source path (`'parent.child'`). */
  child(suffix: string): Logger
}

const RING_CAPACITY = 1000
const ring: LogEntry[] = []
let nextId = 1
let sink: ((entry: LogEntry) => void) | undefined

/**
 * Install a sink that gets every log entry (typically: forwards
 * `attention` entries to the notifications store). Returns the previous
 * sink so callers can stack/restore in tests.
 */
export function setLogSink(next: ((entry: LogEntry) => void) | undefined): typeof sink {
  const prev = sink
  sink = next
  return prev
}

export function getRecentLogs(): readonly LogEntry[] {
  return ring
}

export function clearLogs(): void {
  ring.length = 0
}

function record(entry: LogEntry) {
  ring.push(entry)
  if (ring.length > RING_CAPACITY) ring.splice(0, ring.length - RING_CAPACITY)
  // Console mirror so dev tooling keeps working. Errors/warns get the
  // matching console method so DevTools highlights them.
  const c =
    entry.level === 'error'
      ? console.error
      : entry.level === 'warn'
        ? console.warn
        : entry.level === 'debug'
          ? console.debug
          : console.info
  if (entry.data !== undefined) c(`[${entry.source}] ${entry.message}`, entry.data)
  else c(`[${entry.source}] ${entry.message}`)
  sink?.(entry)
}

function emit(level: LogLevel, source: string, message: string, options?: LogOptions) {
  record({
    id: nextId++,
    timestamp: Date.now(),
    level,
    source,
    message,
    data: options?.data,
    attention: options?.attention,
  })
}

export function createLogger(source: string): Logger {
  return {
    debug: (m, o) => emit('debug', source, m, o),
    info: (m, o) => emit('info', source, m, o),
    warn: (m, o) => emit('warn', source, m, o),
    error: (m, o) => emit('error', source, m, o),
    child: (suffix) => createLogger(`${source}.${suffix}`),
  }
}

/** Default top-level logger. Prefer `createLogger('your-source')` in package code. */
export const logger = createLogger('app')
