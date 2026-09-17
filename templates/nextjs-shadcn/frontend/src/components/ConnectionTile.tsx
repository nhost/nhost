'use client';

import { useState } from 'react';
import { type ConnectionResult, testConnection } from '@/app/actions';
import { StatusTile } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';

export function ConnectionTile({ initial }: { initial: ConnectionResult }) {
  const [result, setResult] = useState(initial);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setResult(await testConnection());
    setIsTesting(false);
  };

  return (
    <StatusTile
      state={result.ok ? 'ok' : 'error'}
      title={result.ok ? 'Backend connected' : 'Backend unreachable'}
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={isTesting}
        >
          {isTesting ? 'Testing…' : 'Test connection'}
        </Button>
      }
    >
      {result.ok ? (
        <>
          Answered a GraphQL query in{' '}
          <span className="font-medium text-foreground tabular-nums">
            {result.latencyMs} ms
          </span>
          .
        </>
      ) : (
        <>
          Start it with <code>cd backend &amp;&amp; nhost up</code>, then test
          again.
        </>
      )}
    </StatusTile>
  );
}
