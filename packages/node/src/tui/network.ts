import { networkInterfaces } from 'node:os'

export interface ServerUrls {
  local: string[]
  network: string[]
}

export function getServerUrls(port: number, host = 'localhost', protocol: 'http' | 'https' = 'http'): ServerUrls {
  const local: string[] = [`${protocol}://${host}:${port}/`]
  const network: string[] = []

  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const detail of ifaces[name] ?? []) {
      if (detail.family !== 'IPv4' || detail.internal) continue
      network.push(`${protocol}://${detail.address}:${port}/`)
    }
  }

  return { local, network }
}
