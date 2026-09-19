'use client';

import { useState } from 'react';
import { type ConnectionResult, testConnection } from '@/app/actions';
import { useConnectionState } from '@/components/connection-state';
import { StatusTile } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';

export function ConnectionTile({ initial }: { initial: ConnectionResult }) {
  // The page measures the round trip on every render, so showing that number
  // at rest would make the tile read differently on each view for no reason.
  // A timing is only worth printing when someone asked for one, and once they
  // have, it stays put while they move between views.
  const { measured, setMeasured } = useConnectionState();
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const result = measured ?? initial;

  const handleTest = async (): Promise<void> => {
    setError(undefined);
    setIsTesting(true);
    try {
      setMeasured(await testConnection());
    } catch (err) {
      console.error('testConnection failed:', err);
      setError('The request did not reach the server. Try again.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <StatusTile
      state={result.ok ? 'ok' : 'error'}
      title={result.ok ? 'Backend connected' : 'Backend unreachable'}
      action={
        <div className="flex flex-col items-start gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleTest()}
            disabled={isTesting}
          >
            {isTesting ? 'Testing…' : 'Test connection'}
          </Button>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>
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
