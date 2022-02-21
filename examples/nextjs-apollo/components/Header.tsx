import Link from 'next/link'

export default function Header() {
  return (
    <header className="App-header">
      <h1>Server-Side Rendering with Apollo GraphQL</h1>
      <nav>
        <Link href="/">Index</Link> <br />
        <Link href="/second">Second</Link> <br />
        <Link href="/third">Third</Link> <br />
      </nav>
    </header>
  )
}
