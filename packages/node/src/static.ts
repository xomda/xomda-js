import { createReadStream, promises as fsp } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

async function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  status = 200
): Promise<void> {
  const stat = await fsp.stat(filePath)
  res.writeHead(status, {
    'Content-Type': getMimeType(filePath),
    'Content-Length': String(stat.size),
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  await new Promise<void>((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath)
    stream.on('end', resolveStream)
    stream.on('error', rejectStream)
    stream.pipe(res)
  })
}

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>

export function createStaticHandler(staticDir: string): StaticHandler {
  const root = resolve(staticDir)
  const indexHtml = resolve(root, 'index.html')

  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false

    const url = req.url ?? '/'
    const pathname = url.split('?')[0] ?? '/'

    let decoded: string
    try {
      decoded = decodeURIComponent(pathname)
    } catch {
      return false
    }

    const target = resolve(root, `.${decoded}`)

    if (target !== root && !target.startsWith(root + sep)) return false

    const ext = extname(target)

    if (!ext) {
      try {
        await sendFile(req, res, indexHtml)
        return true
      } catch {
        return false
      }
    }

    try {
      const stat = await fsp.stat(target)
      if (stat.isFile()) {
        await sendFile(req, res, target)
        return true
      }
    } catch {
      // fall through to 404
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return true
  }
}
