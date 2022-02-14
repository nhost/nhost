import Link from 'next/link'

export default function Header() {
  return (
    <header style={{ background: '#eee', padding: '1em' }}>
      <h1 style={{ margin: '0 0 1rem' }}>Next.js Server-Side Rendering with Apollo GraphQL</h1>
      <nav style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          Examples:
          <Link href="/">Index</Link> <br />
          <Link href="/refetch">Refetch</Link> <br />
          <Link href="/third">Third (index bis)</Link>{' '}
        </span>
      </nav>
      <p>
        <strong>
          A simple approach to server-side rendering in Next.js with Apollo GraphQL, featuring no
          duplicate queries or complicated client/server logic, cache hydration and live queries for
          the client.
        </strong>
      </p>
    </header>
  )
}
