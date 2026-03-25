import { createClient, withAdminSession } from '@nhost/nhost-js';
import cors from 'cors';
import type { Request, Response } from 'express';

const corsMiddleware = cors();

export default async (req: Request, res: Response) => {
  corsMiddleware(req, res, async () => {
    const webhookSecret = req.headers['nhost-webhook-secret'];
    if (webhookSecret !== process.env.NHOST_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const nhost = createClient({
      region: process.env.NHOST_REGION,
      subdomain: process.env.NHOST_SUBDOMAIN,
      configure: [
        withAdminSession({
          adminSecret: process.env.NHOST_ADMIN_SECRET,
        }),
      ],
    });

    // Find incomplete, non-stale todos not updated in 7+ days
    const { body } = await nhost.graphql.request<{
      todos: Array<{ id: string; title: string; user_id: string }>;
    }>({
      query: `
        query GetStaleTodos($cutoff: timestamptz!) {
          todos(where: {
            completed: { _eq: false },
            stale: { _eq: false },
            updated_at: { _lt: $cutoff }
          }) {
            id
            title
            user_id
          }
        }
      `,
      variables: {
        cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    if (body.errors) {
      return res.status(500).json({ errors: body.errors });
    }

    const staleTodos = body.data?.todos || [];

    if (staleTodos.length === 0) {
      return res.status(200).json({ message: 'No stale todos found' });
    }

    // Mark todos as stale
    const staleIds = staleTodos.map((t) => t.id);

    const markResult = await nhost.graphql.request<{
      update_todos: { affected_rows: number } | null;
    }>({
      query: `
        mutation MarkTodosStale($ids: [uuid!]!) {
          update_todos(where: { id: { _in: $ids } }, _set: { stale: true }) {
            affected_rows
          }
        }
      `,
      variables: { ids: staleIds },
    });

    if (markResult.body.errors) {
      return res.status(500).json({ errors: markResult.body.errors });
    }

    // Group by user and create notifications
    const byUser = new Map<string, { titles: string[]; count: number }>();
    for (const todo of staleTodos) {
      const entry = byUser.get(todo.user_id) || {
        titles: [],
        count: 0,
      };
      entry.titles.push(todo.title);
      entry.count += 1;
      byUser.set(todo.user_id, entry);
    }

    const notifications = Array.from(byUser.entries()).map(
      ([userId, { titles, count }]) => ({
        user_id: userId,
        title: `You have ${count} stale todo${count > 1 ? 's' : ''}`,
        message:
          titles.length <= 3
            ? titles.join(', ')
            : `${titles.slice(0, 3).join(', ')} and ${titles.length - 3} more`,
        type: 'stale_todos',
      }),
    );

    const insertResult = await nhost.graphql.request<{
      insert_notifications: { affected_rows: number } | null;
    }>({
      query: `
        mutation InsertNotifications($objects: [notifications_insert_input!]!) {
          insert_notifications(objects: $objects) {
            affected_rows
          }
        }
      `,
      variables: { objects: notifications },
    });

    if (insertResult.body.errors) {
      return res.status(500).json({ errors: insertResult.body.errors });
    }

    res.status(200).json({
      message: `Marked ${staleTodos.length} todo(s) stale, notified ${byUser.size} user(s)`,
    });
  });
};
