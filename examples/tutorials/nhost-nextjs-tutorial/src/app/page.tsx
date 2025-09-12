import { createNhostClient } from "../lib/nhost/server";

export default async function Home() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <div className="container">
      <header  className="page-header">
        <h1 className="page-title">Welcome to Nhost Next.js Demo</h1>
      </header>

      {session ? (
        <div>
          <p>Hello, {session.user?.displayName || session.user?.email}!</p>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
        </div>
      )}
    </div>
  );
}
