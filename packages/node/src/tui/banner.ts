import { c } from './colors'
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
  const name = [opts.name ?? 'xomda', opts.tagline ? c.dim(opts.tagline) : undefined]
    .filter(Boolean)
    .join(' — ')
  const version = opts.version ? ` v${opts.version}` : ''
  const ready = opts.startupMs !== undefined ? `  ${c.dim(`ready in ${opts.startupMs} ms`)}` : ''

  const lines: string[] = []
  lines.push('')
  lines.push(
    `  ${c.blueBright(c.bold(`${name} `))} ${c.blueBright(c.bold(version.trim()))}${ready}`
  )
  lines.push('')

  const labelWidth = 10
  const localLabel = `${c.green(c.bold('  ➜'))}  ${pad(c.bold('Local: '), labelWidth)}`
  for (const url of opts.urls.local) {
    lines.push(`${localLabel}${c.cyan(url)}`)
  }

  if (opts.urls.network.length === 0) {
    lines.push(
      `${c.green(c.bold('  ➜'))}  ${pad(c.bold('Network: '), labelWidth)}${c.dim('use --host to expose')}`
    )
  } else {
    for (const url of opts.urls.network) {
      lines.push(`${c.green(c.bold('  ➜'))}  ${pad(c.bold('Network: '), labelWidth)}${c.cyan(url)}`)
    }
  }

  if (opts.staticDir) {
    lines.push(
      `${c.green(c.bold('  ➜'))}  ${pad(c.bold('Static: '), labelWidth)}${c.dim(opts.staticDir)}`
    )
  }
  if (opts.cwd) {
    lines.push(`${c.green(c.bold('  ➜'))}  ${pad(c.bold('Cwd: '), labelWidth)}${c.dim(opts.cwd)}`)
  }

  lines.push('')
  lines.push(`  ${c.dim('press')} ${c.bold('h')} ${c.dim('+ enter to show help')}`)
  lines.push('')

  return lines.join('\n')
}

export function printBanner(opts: BannerOptions): void {
  process.stdout.write(`${renderBanner(opts)}\n`)
}
