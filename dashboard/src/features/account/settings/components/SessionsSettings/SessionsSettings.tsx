import { formatDistanceToNow } from 'date-fns';
import { Monitor } from 'lucide-react';
import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import {
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Badge } from '@/components/ui/v3/badge';
import { Spinner } from '@/components/ui/v3/spinner';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { useGetUserSessionsQuery } from '@/generated/graphql';
import { useAuth } from '@/providers/Auth';

const SESSIONS_PER_PAGE = 20;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface RelativeTimeProps {
  label: string;
  value: string;
}

// "Signed in 13 hours ago", with the exact date and time on hover.
function RelativeTime({ label, value }: RelativeTimeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          {label} {formatDistanceToNow(new Date(value), { addSuffix: true })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{formatDateTime(value)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Every place the user is signed in. Each sign in creates a session (a
 * regular refresh token, the same table as personal access tokens), so the
 * list shows when each one started and when it ends. The session of this
 * browser is matched by its refresh token id and tagged.
 */
export default function SessionsSettings() {
  const { session } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error } = useGetUserSessionsQuery({
    fetchPolicy: 'cache-and-network',
  });

  if (error) {
    throw error;
  }

  const currentSessionId = session?.refreshTokenId;
  const now = new Date();
  // This browser first, then the most recent sign in.
  const sessions = [...(data?.sessions ?? [])]
    .filter(({ expiresAt }) => new Date(expiresAt) > now)
    .sort((a, b) => {
      if (a.id === currentSessionId) {
        return -1;
      }
      if (b.id === currentSessionId) {
        return 1;
      }
      return 0;
    });

  const totalPages = Math.max(
    1,
    Math.ceil(sessions.length / SESSIONS_PER_PAGE),
  );
  // A session that ends can empty the last page, so stay within range.
  const currentPage = Math.min(page, totalPages);
  const pageSessions = sessions.slice(
    (currentPage - 1) * SESSIONS_PER_PAGE,
    currentPage * SESSIONS_PER_PAGE,
  );

  return (
    <AccountSettingsCard>
      <SettingsCardHeader
        title={null}
        description="Every browser or device where you are signed in to Nhost. A session ends when you sign out there or when it expires."
      />

      {!data && loading ? (
        <SettingsCardContent className="mt-2">
          <Spinner />
        </SettingsCardContent>
      ) : (
        sessions.length > 0 && (
          // Same box as the environment variables and secrets lists.
          <SettingsCardContent className="mt-2">
            <VariableGroup>
              {pageSessions.map(({ id, createdAt, expiresAt }) => {
                const isCurrent = id === currentSessionId;

                return (
                  <TableRow key={id}>
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-3">
                        <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">
                          {isCurrent ? 'This browser' : 'Other session'}
                        </span>
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className="border-success/40 text-success"
                          >
                            Current
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="truncate text-muted-foreground">
                      <RelativeTime label="Signed in" value={createdAt} />
                    </TableCell>
                    {/* On phones only the sign in date fits next to the
                        name. */}
                    <TableCell className="hidden truncate text-muted-foreground sm:table-cell">
                      <RelativeTime label="Expires" value={expiresAt} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </VariableGroup>

            {totalPages > 1 && (
              <Pagination
                className="mt-4"
                totalNrOfPages={totalPages}
                currentPageNumber={currentPage}
                elementsPerPage={SESSIONS_PER_PAGE}
                totalNrOfElements={sessions.length}
                itemsLabel="sessions"
                onPrevPageClick={() => setPage(currentPage - 1)}
                onNextPageClick={() => setPage(currentPage + 1)}
                onPageChange={setPage}
              />
            )}
          </SettingsCardContent>
        )
      )}
    </AccountSettingsCard>
  );
}
