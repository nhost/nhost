# backend

This is a very simple Nhost backend that we will use to demonstrate how to use the various SDKs we are experimenting with. The backend will consist of the following:

## Database schema

- A `todos` table with the following columns:

  - `id` (UUID)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
  - `user_id` (foreign key to `auth.users.id`)
  - `title` (Text)
  - `details` (Text)
  - `completed` (Boolean)
  - `stale` (Boolean, default false) — set to true by the stale-todos cron trigger when a todo hasn't been updated in 7+ days

- A `notifications` table with the following columns:

  - `id` (UUID)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
  - `user_id` (foreign key to `auth.users.id`)
  - `title` (Text)
  - `message` (Text)
  - `type` (Text, default `announcement`) — one of `community_update`, `stale_todos`, `announcement`
  - `read` (Boolean, default false)

- A `communities` table (includes `updated_at` column with auto-update trigger)

- An `attachments` table with the following columns:
  - `task_id` (foreign key to `tasks.id`)
  - `file_id` (foreign key to `storage.files.id`)

### Permissions

- `todos`: the `user` role can insert/select/update/delete todos that they own. Users can update `title`, `details`, `completed`, and `stale`. Ownership is tracked by the `user_id` column which is set automatically on insert from the session.
- `notifications`: the `user` role can select all columns for their own notifications and update the `read` column. Aggregations are allowed (used by the notification bell to count unread).
- `communities`: the `user` role can select all communities and update the `description` column for communities they are a member of.
- `attachments`: the `user` role can insert/select/delete attachments for tasks and files that they own
- `storage.files`: the `user` role can insert/select/delete files that they own

## Functions

- A `simple` function called `echo` that will just return back some request information

### Event functions (`functions/events/`)

These functions are called by Hasura event triggers and are secured with `NHOST_WEBHOOK_SECRET`.

| Function | Trigger Type | Description |
|----------|-------------|-------------|
| `community-updated.ts` | Event trigger (on `communities.description` UPDATE) | Compares old/new description, queries community members, and inserts a notification for each member (excluding the editor) |
| `stale-todos.ts` | Cron trigger (`*/5 * * * *`) | Finds incomplete todos not updated in 7+ days, marks them as `stale`, groups by user, and creates one notification per affected user with a summary |
| `broadcast-notification.ts` | One-off scheduled event | Receives a `{ title, message, type? }` payload, queries all active users, and inserts a notification for each one |

## Hasura event triggers

### Event trigger: `community_description_updated`

- **Table**: `public.communities`
- **Operation**: UPDATE on `description` column
- **Webhook**: `{{NHOST_FUNCTIONS_URL}}/events/community-updated`
- **Retry**: 3 retries, 10s interval, 60s timeout
- **Cleanup**: invocation logs cleared after 168 hours

### Cron trigger: `stale_todos_check`

- **Schedule**: `*/5 * * * *` (every 5 minutes for demo purposes; use `0 * * * *` for hourly in production)
- **Webhook**: `{{NHOST_FUNCTIONS_URL}}/events/stale-todos`
- **Retry**: 3 retries, 10s interval, 60s timeout

### One-off scheduled event: broadcast notification

Created manually from the Hasura console. Point it at `{{NHOST_FUNCTIONS_URL}}/events/broadcast-notification` with a payload:

```json
{
  "title": "Your announcement title",
  "message": "Your announcement message",
  "type": "announcement"
}
```