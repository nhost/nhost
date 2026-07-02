import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { useRouter } from 'next/router';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v3/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useAdminApolloClient } from '@/features/orgs/projects/hooks/useAdminApolloClient';
import type { Agent } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/ai/agents';
import { useGetAgentSessionsQuery } from '@/utils/__generated__/graphite.graphql';

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function relativeTime(value: string) {
  try {
    return `${formatDistanceToNow(new Date(value))} ago`;
  } catch {
    return value;
  }
}

export default function AgentSessions({ agent }: { agent: Agent }) {
  const router = useRouter();
  const { adminClient } = useAdminApolloClient();

  const { data, loading, error } = useGetAgentSessionsQuery({
    client: adminClient,
    variables: { agentID: agent.id },
    fetchPolicy: 'cache-and-network',
  });

  const openSession = (sessionId: string) => {
    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: 'chat', sessionID: sessionId },
      },
      undefined,
      { shallow: true },
    );
  };

  if (loading && !data) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <ActivityIndicator
          label="Loading sessions..."
          className="justify-center"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-40 w-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load sessions.</p>
      </div>
    );
  }

  const sessions = data?.graphiteAgentSessions ?? [];

  if (sessions.length === 0) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          No sessions yet. Start a chat to create one.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Session</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Messages</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.map((session) => (
            <TableRow
              key={session.id}
              className="cursor-pointer"
              onClick={() => openSession(session.id)}
            >
              <TableCell className="font-mono text-xs">
                {shortId(session.id)}
              </TableCell>
              <TableCell className="text-sm">
                {relativeTime(session.createdAt)}
              </TableCell>
              <TableCell className="text-sm">
                {relativeTime(session.updatedAt)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {session.agentMessages_aggregate.aggregate?.count ?? 0}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {session.userID ? shortId(session.userID) : '—'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSession(session.id);
                  }}
                >
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
