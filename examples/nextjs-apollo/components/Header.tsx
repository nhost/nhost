import Link from 'next/link'

export default function Header() {
  return (
    <header className="App-header">
      <h1>Server-Side Rendering with Apollo GraphQL</h1>
      <nav>
        <Link href="/">Index</Link> <br />
        <Link href="/refetch">Refetch</Link> <br />
      </nav>
    </header>
  )
}
