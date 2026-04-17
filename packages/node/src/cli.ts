export interface CliArgs {
  port?: number
  open: boolean
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { open: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--open') {
      args.open = true
    } else if (arg === '--port') {
      const next = argv[i + 1]
      const port = Number(next)
      if (!next || !Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(
          `--port requires a valid port number (0–65535), received: ${next ?? '(none)'}`
        )
      }
      args.port = port
      i++
    } else if (arg?.startsWith('--port=')) {
      const value = arg.slice('--port='.length)
      const port = Number(value)
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`--port requires a valid port number (0–65535), received: ${value}`)
      }
      args.port = port
    }
  }

  return args
}
