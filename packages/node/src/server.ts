import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from '@xomda/model/router'

import { createStaticHandler } from './static'

const TRPC_PREFIX_RE = /^\/trpc(\/|\?|$)/

export function createHttpServer(port?: number, staticDir?: string) {
  const staticHandler = staticDir ? createStaticHandler(staticDir) : undefined

  const server = createHTTPServer({
    router: appRouter,
    basePath: '/trpc/',
    createContext: () => ({}),
    async middleware(req, res, next) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type,trpc-accept,trpc-batch-mode')
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      if (req.url && TRPC_PREFIX_RE.test(req.url)) {
        next()
        return
      }

      if (staticHandler) {
        const handled = await staticHandler(req, res)
        if (handled) return
      }

      next()
    },
  })
  if (port !== undefined) server.listen(port)
  return server
}
