import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/nhost/AuthProvider';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface GetNotifications {
  notifications: Notification[];
}

interface UpdateNotification {
  update_notifications_by_pk: Notification | null;
}

interface UpdateManyNotifications {
  update_notifications: {
    affected_rows: number;
  } | null;
}

export default function Notifications(): JSX.Element {
  const { nhost, session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await nhost.graphql.request<GetNotifications>({
        query: `
          query GetNotifications {
            notifications(order_by: { created_at: desc }) {
              id
              title
              message
              type
              read
              created_at
              updated_at
              user_id
            }
          }
        `,
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to fetch notifications',
        );
      }

      setNotifications(response.body?.data?.notifications || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch notifications',
      );
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const markAsRead = async (id: string) => {
    try {
      const response = await nhost.graphql.request<UpdateNotification>({
        query: `
          mutation MarkNotificationRead($id: uuid!) {
            update_notifications_by_pk(
              pk_columns: { id: $id }
              _set: { read: true }
            ) {
              id
              title
              message
              type
              read
              created_at
              updated_at
              user_id
            }
          }
        `,
        variables: { id },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to mark as read',
        );
      }

      const updated = response.body?.data?.update_notifications_by_pk;
      if (updated) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? updated : n)),
        );
        window.dispatchEvent(new Event('notifications-updated'));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await nhost.graphql.request<UpdateManyNotifications>({
        query: `
            mutation MarkAllNotificationsRead {
              update_notifications(
                where: { read: { _eq: false } }
                _set: { read: true }
              ) {
                affected_rows
              }
            }
          `,
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || 'Failed to mark all as read',
        );
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      window.dispatchEvent(new Event('notifications-updated'));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to mark all as read',
      );
    }
  };

  useEffect(() => {
    if (session) {
      fetchNotifications();
    }
  }, [session, fetchNotifications]);

  if (!session) {
    return (
      <div className="text-center">
        <p>Please sign in to view your notifications.</p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const typeLabel = (type: string): string => {
    switch (type) {
      case 'community_update':
        return 'Community';
      case 'stale_todos':
        return 'Todos';
      case 'announcement':
        return 'Announcement';
      default:
        return type;
    }
  };

  const typeClass = (type: string): string => {
    switch (type) {
      case 'community_update':
        return 'notification-type-community';
      case 'stale_todos':
        return 'notification-type-todos';
      case 'announcement':
        return 'notification-type-announcement';
      default:
        return 'notification-type-default';
    }
  };

  const timeAgo = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold gradient-text">Notifications</h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="btn btn-secondary"
          >
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-secondary">Loading notifications...</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                />
              </svg>
              <h3 className="text-lg font-medium mb-2">No notifications yet</h3>
              <p className="text-muted">
                You will see notifications here when events occur.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`glass-card notification-item ${
                  !notification.read ? 'notification-unread' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div
                      className="flex items-center"
                      style={{ gap: '0.5rem' }}
                    >
                      {!notification.read && (
                        <span className="notification-dot" />
                      )}
                      <h3
                        className={`text-lg font-medium ${
                          notification.read ? 'text-muted' : 'text-primary'
                        }`}
                      >
                        {notification.title}
                      </h3>
                      <span
                        className={`notification-type-badge ${typeClass(notification.type)}`}
                      >
                        {typeLabel(notification.type)}
                      </span>
                    </div>
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="action-icon action-icon-view"
                        title="Mark as read"
                      >
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p
                    className={`text-secondary leading-relaxed mb-2 ${
                      notification.read ? 'opacity-75' : ''
                    }`}
                  >
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted">
                    {timeAgo(notification.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
