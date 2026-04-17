import { createHTTPServer } from '@trpc/server/adapters/standalone'
import { appRouter } from '@xomda/model/router'

export function createHttpServer(port?: number) {
  const server = createHTTPServer({
    router: appRouter,
    createContext: () => ({}),
    middleware(req, res, next) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'content-type,trpc-accept,trpc-batch-mode')
      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }
      next()
    },
  })
  if (port !== undefined) server.listen(port)
  return server
}
