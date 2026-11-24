import { Headset, User } from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useSyncExternalStore } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { useAuth } from '@/providers/Auth';

type SupportView = 'customer' | 'agent';
const changeEvent = 'support-preview-view-change';
const sessionViews = new Map<string, SupportView>();

// Temporary preview state. Remove this file and its Header/useSupportSession
// integrations when the design preview is no longer needed.
export function useSupportView() {
  const { user, session } = useAuth();
  const allowedRoles =
    session?.decodedToken['https://hasura.io/jwt/claims']?.[
      'x-hasura-allowed-roles'
    ];
  const canViewAsAgent =
    !!user && Array.isArray(allowedRoles) && allowedRoles.includes('support');
  const router = useRouter();
  const canPreview =
    !!user &&
    (process.env.NEXT_PUBLIC_ENV === 'dev' ||
      process.env.NEXT_PUBLIC_ENV === 'staging');
  const defaultView: SupportView = canViewAsAgent ? 'agent' : 'customer';
  const key = user ? `support-preview-view:${user.id}` : null;
  const getSnapshot = useCallback((): SupportView => {
    if (!key) {
      return defaultView;
    }
    const current = sessionViews.get(key);
    if (current) {
      return current;
    }
    try {
      const saved = window.localStorage.getItem(key);
      return saved === 'customer' || saved === 'agent' ? saved : defaultView;
    } catch {
      return defaultView;
    }
  }, [key, defaultView]);
  const subscribe = useCallback(
    (onChange: VoidFunction) => {
      function onStorage(event: StorageEvent) {
        if (event.key === key || event.key === null) {
          if (key) {
            sessionViews.delete(key);
          }
          onChange();
        }
      }
      window.addEventListener(changeEvent, onChange);
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(changeEvent, onChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );
  const storedView = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => defaultView,
  );
  const view = canPreview ? storedView : defaultView;
  const isSample = canPreview && !canViewAsAgent && view === 'agent';
  function setView(nextView: string) {
    if (
      !canPreview ||
      !key ||
      (nextView !== 'customer' && nextView !== 'agent')
    ) {
      return;
    }
    try {
      window.localStorage.setItem(key, nextView);
      sessionViews.delete(key);
    } catch {
      // Keep this session's preview usable if browser storage is unavailable.
      sessionViews.set(key, nextView);
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return {
    canViewAsAgent,
    canPreview,
    isAgent: view === 'agent',
    isSample,
    useSampleRequests: isSample && router.pathname !== '/support/ticket',
    view,
    setView,
  };
}

export default function SupportViewSwitch() {
  const router = useRouter();
  const isSupportPage =
    router.pathname === '/support' ||
    router.pathname === '/support/ticket' ||
    router.pathname === '/support/tickets/[ticketId]';
  return isSupportPage ? <PreviewSupportViewSwitch /> : null;
}

function PreviewSupportViewSwitch() {
  const { canPreview, isSample, view, setView } = useSupportView();
  if (!canPreview) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-muted-foreground text-xs md:inline">
        View as
      </span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        onValueChange={setView}
        aria-label="View support as"
      >
        <ToggleGroupItem value="customer" className="gap-2">
          <User aria-hidden="true" className="size-4" />
          Customer
        </ToggleGroupItem>
        <ToggleGroupItem value="agent" className="gap-2">
          <Headset aria-hidden="true" className="size-4" />
          Agent
        </ToggleGroupItem>
      </ToggleGroup>
      {isSample && (
        <Badge variant="outline" className="hidden sm:inline-flex">
          Sample data
        </Badge>
      )}
    </div>
  );
}
