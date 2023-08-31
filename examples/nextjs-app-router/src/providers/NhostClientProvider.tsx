'use client'

import { ReactNode } from 'react'

import { NhostClient, NhostProvider } from '@nhost/nextjs'
import { NhostApolloProvider } from '@nhost/react-apollo'

const nhost = new NhostClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN,
  region: process.env.NEXT_PUBLIC_NHOST_REGION
})

export default function NhostClientProvider({ children }: { children: ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>{children}</NhostApolloProvider>
    </NhostProvider>
  )
}
