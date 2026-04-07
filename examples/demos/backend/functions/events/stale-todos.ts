import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient, withAdminSession } from '@nhost/nhost-js';
import type { Request, Response } from 'express';

const hash = (value: string) => createHash('sha256').update(value).digest();

export default async (req: Request, res: Response) => {
  const webhookSecret = req.headers['nhost-webhook-secret'] as
    | string
    | undefined;
  const expected = process.env.NHOST_WEBHOOK_SECRET;
  if (
    !webhookSecret ||
    !expected ||
    !timingSafeEqual(hash(webhookSecret), hash(expected))
  ) {
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

  // Group by user and build notifications
  const staleIds = staleTodos.map((t) => t.id);
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

  // Mark todos as stale and insert notifications in a single request.
  // Hasura runs multiple root-level mutations in one transaction,
  // so if either fails the whole operation is rolled back.
  const result = await nhost.graphql.request<{
    update_todos: { affected_rows: number } | null;
    insert_notifications: { affected_rows: number } | null;
  }>({
    query: `
      mutation MarkStaleAndNotify($ids: [uuid!]!, $notifications: [notifications_insert_input!]!) {
        update_todos(where: { id: { _in: $ids } }, _set: { stale: true }) {
          affected_rows
        }
        insert_notifications(objects: $notifications) {
          affected_rows
        }
      }
    `,
    variables: { ids: staleIds, notifications },
  });

  if (result.body.errors) {
    return res.status(500).json({ errors: result.body.errors });
  }

  res.status(200).json({
    message: `Marked ${staleTodos.length} todo(s) stale, notified ${byUser.size} user(s)`,
  });
};
