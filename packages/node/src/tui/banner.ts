import { colors } from './colors'
import type { ServerUrls } from './network'

export interface BannerOptions {
  name?: string
  tagline?: string
  version?: string
  startupMs?: number
  urls: ServerUrls
  staticDir?: string
  cwd?: string
}

const pad = (label: string, width: number) => label + ' '.repeat(Math.max(0, width - label.length))

export function renderBanner(opts: BannerOptions): string {
  const name = [opts.name ?? 'xomda', opts.tagline ? colors.dim(opts.tagline) : undefined]
    .filter(Boolean)
    .join(' — ')
  const version = opts.version ? ` v${opts.version}` : ''
  const ready =
    opts.startupMs !== undefined ? `  ${colors.dim(`ready in ${opts.startupMs} ms`)}` : ''

  const lines: string[] = []
  lines.push('')
  lines.push(
    `  ${colors.blueBright(colors.bold(`${name} `))} ${colors.blueBright(colors.bold(version.trim()))}${ready}`
  )
  lines.push('')

  const labelWidth = 10
  const localLabel = `${colors.green(colors.bold('  ➜'))}  ${pad(colors.bold('Local: '), labelWidth)}`
  for (const url of opts.urls.local) {
    lines.push(`${localLabel}${colors.cyan(url)}`)
  }

  if (opts.urls.network.length === 0) {
    lines.push(
      `${colors.green(colors.bold('  ➜'))}  ${pad(colors.bold('Network: '), labelWidth)}${colors.dim('use --host to expose')}`
    )
  } else {
    for (const url of opts.urls.network) {
      lines.push(
        `${colors.green(colors.bold('  ➜'))}  ${pad(colors.bold('Network: '), labelWidth)}${colors.cyan(url)}`
      )
    }
  }

  if (opts.staticDir) {
    lines.push(
      `${colors.green(colors.bold('  ➜'))}  ${pad(colors.bold('Static: '), labelWidth)}${colors.dim(opts.staticDir)}`
    )
  }
  if (opts.cwd) {
    lines.push(
      `${colors.green(colors.bold('  ➜'))}  ${pad(colors.bold('Cwd: '), labelWidth)}${colors.dim(opts.cwd)}`
    )
  }

  lines.push('')
  lines.push(`  ${colors.dim('press')} ${colors.bold('h')} ${colors.dim('+ enter to show help')}`)
  lines.push('')

  return lines.join('\n')
}

export function printBanner(opts: BannerOptions): void {
  process.stdout.write(`${renderBanner(opts)}\n`)
}
