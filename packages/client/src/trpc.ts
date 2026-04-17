import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@xomda/model'

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/trpc' })],
})
