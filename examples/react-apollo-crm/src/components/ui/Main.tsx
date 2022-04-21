import React from 'react'

export function Main({ children }: { children: React.ReactNode }) {
  return <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">{children}</div>
}
