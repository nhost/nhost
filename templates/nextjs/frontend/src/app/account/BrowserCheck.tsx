'use client';

import { useEffect, useState } from 'react';
import { nhost } from '@/lib/nhost/client';

type Result = { email: string } | { error: string };

// The facts above came from the auth service, asked by the server. This asks
// again from the browser, with nothing but the access token the proxy wrote
// into the readable cookie, which is the one thing that cookie is for.
export default function BrowserCheck() {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let current = true;
    nhost.auth.getUser().then(
      ({ body }) => {
        if (current) {
          setResult({ email: body.email ?? '—' });
        }
      },
      (err) => {
        console.error('The browser could not read the session:', err);
        if (current) {
          setResult({ error: 'The browser could not read the session.' });
        }
      },
    );
    return () => {
      current = false;
    };
  }, []);

  if (!result) {
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Checking from the browser…
      </p>
    );
  }

  if ('error' in result) {
    return (
      <p role="alert" className="text-destructive text-sm">
        {result.error}
      </p>
    );
  }

  return (
    <p role="status" className="text-muted-foreground text-sm">
      The browser is signed in as {result.email}.
    </p>
  );
}
