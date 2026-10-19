'use client';

import { useEffect, useState } from 'react';
import { nhost } from '@/lib/nhost/client';

type Result = { ok: true } | { error: string };

// The facts above came from the auth service, asked by the server. This asks
// again from the browser, with nothing but the access token the proxy wrote
// into the readable cookie, which is the one thing that cookie is for.
//
// It reports that the call worked, not who it returned: the address is on
// the page already, a few lines up, and saying it twice told the visitor
// nothing the second time.
export default function BrowserCheck() {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let current = true;
    nhost.auth.getUser().then(
      () => {
        if (current) {
          setResult({ ok: true });
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
      This browser holds the session too.
    </p>
  );
}
