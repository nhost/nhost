'use client';

import { useState } from 'react';
import { type ConnectionResult, testConnection } from '@/app/actions';
import { StatusTile } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';

export function ConnectionTile({ initial }: { initial: ConnectionResult }) {
  const [result, setResult] = useState(initial);
  // The page measures the round trip on every render, so showing that number
  // at rest would make the tile read differently on each view for no reason.
  // A timing is only worth printing when someone asked for one.
  const [measured, setMeasured] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setResult(await testConnection());
    setMeasured(true);
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
        measured ? (
          <>
            Answered a GraphQL query in{' '}
            <span className="font-medium text-foreground tabular-nums">
              {result.latencyMs} ms
            </span>
            .
          </>
        ) : (
          <>The frontend reached your GraphQL API.</>
        )
      ) : (
        <>
          Start it with <code>cd backend &amp;&amp; nhost up</code>, then test
          again.
        </>
      )}
    </StatusTile>
  );
}
