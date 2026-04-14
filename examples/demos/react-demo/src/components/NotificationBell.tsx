import { type JSX, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/nhost/AuthProvider';

interface UnreadCountResponse {
  notifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
}

export default function NotificationBell(): JSX.Element {
  const { nhost, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!session) return;
    try {
      const response = await nhost.graphql.request<UnreadCountResponse>({
        query: `
          query GetUnreadNotificationCount {
            notifications_aggregate(where: { read: { _eq: false } }) {
              aggregate {
                count
              }
            }
          }
        `,
      });
      if (response.body.errors) return;
      setUnreadCount(
        response.body?.data?.notifications_aggregate?.aggregate?.count ?? 0,
      );
    } catch {
      // Silently ignore polling errors
    }
  }, [nhost.graphql, session]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleFocus = () => fetchUnreadCount();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('notifications-updated', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('notifications-updated', handleFocus);
    };
  }, [fetchUnreadCount]);

  const isActive = location.pathname === '/notifications';

  return (
    <button
      type="button"
      onClick={() => navigate('/notifications')}
      className="icon-button notification-bell"
      title="Notifications"
      style={{ position: 'relative' }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        role="img"
        aria-label="Notifications"
        style={isActive ? { color: 'var(--primary)' } : undefined}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
