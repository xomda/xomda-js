import { colors } from './colors'
import { openUrl } from './openUrl'

export interface KeypressCommand {
  key: string
  description: string
  action: () => void | Promise<void>
}

export interface KeypressOptions {
  commands?: KeypressCommand[]
  primaryUrl?: () => string | undefined
}

const CTRL_C = '\x03'
const CTRL_D = '\x04'

export function startKeypressHandler(options: KeypressOptions = {}): () => void {
  const stdin = process.stdin
  if (!stdin.isTTY) {
    return () => {}
  }

  const commands: KeypressCommand[] = [
    {
      key: 'o',
      description: 'open in browser',
      action: () => {
        const url = options.primaryUrl?.()
        if (url) {
          process.stdout.write(colors.dim(`  opening ${url}\n`))
          openUrl(url)
        } else {
          process.stdout.write(colors.yellow('  no URL available\n'))
        }
      },
    },
    {
      key: 'h',
      description: 'show help',
      action: () => printHelp(commands),
    },
    {
      key: 'c',
      description: 'clear screen',
      action: () => process.stdout.write('\x1b[2J\x1b[3J\x1b[H'),
    },
    {
      key: 'q',
      description: 'quit',
      action: () => {
        process.stdout.write(colors.dim('  shutting down...\n'))
        process.exit(0)
      },
    },
    ...(options.commands ?? []),
  ]

  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')

  const onData = (data: string) => {
    if (data === CTRL_C || data === CTRL_D) {
      process.exit(0)
    }
    const cmd = commands.find((c) => c.key === data.toLowerCase())
    if (cmd) {
      void cmd.action()
    }
  }

  stdin.on('data', onData)

  return () => {
    stdin.off('data', onData)
    if (stdin.isTTY) stdin.setRawMode(false)
    stdin.pause()
  }
}

function printHelp(commands: KeypressCommand[]): void {
  const lines: string[] = ['', `  ${colors.bold('Shortcuts')}`]
  const keyWidth = Math.max(...commands.map((c) => c.key.length))
  for (const cmd of commands) {
    lines.push(
      `  ${colors.green(colors.bold(`press ${cmd.key.padEnd(keyWidth)}`))} ${colors.dim('to')} ${cmd.description}`
    )
  }
  lines.push('')
  process.stdout.write(`${lines.join('\n')}\n`)
}
