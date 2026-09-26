import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/nhost/AuthProvider';

export default function Home() {
  const { nhost, isAuthenticated } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    nhost.graphql
      .request({ query: '{ __typename }' })
      .then(() => setConnected(true))
      .catch(() => setConnected(false));
  }, [nhost]);

  return (
    <div className="stack">
      <h1>Nhost + React</h1>
      <p className="muted">
        A full-stack starter. The backend (auth, database and GraphQL API) lives
        in <code>backend/</code>; this app lives in <code>frontend/</code>.
      </p>

      <div className="card">
        <strong>
          {connected === null
            ? 'Checking backend…'
            : connected
              ? 'Connected to Nhost GraphQL'
              : 'Backend not reachable'}
        </strong>
        <p className="muted">
          {connected
            ? 'The app reached your GraphQL API.'
            : 'Start the backend with `cd backend && nhost up`, then reload.'}
        </p>
      </div>

      <div className="row">
        <Link className="button" to="/signin">
          Sign in
        </Link>
        <Link className="button ghost" to="/protected">
          {isAuthenticated ? 'Your todos' : 'Protected page'}
        </Link>
      </div>
    </div>
  );
}
