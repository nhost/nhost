import Link from 'next/link'

export default function Header() {
  return (
    <header className="App-header">
      <h1>Server-Side Rendering with Apollo GraphQL</h1>
      <nav>
        <Link href="/">Index</Link> <br />
        <Link href="/second">Second</Link> <br />
        <Link href="/third">SSR auth-guarded page</Link> <br />
        <Link href="/client-side-auth-guard">CSR auth-guarded page</Link> <br />
      </nav>
    </header>
  )
}
