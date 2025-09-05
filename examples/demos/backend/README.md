# backend

This is a very simple Nhost backend that we will use to demonstrate how to use the various SDKs we are experimenting with. The backend will consist of the following:

## Database schema

- A `tasks` table with the following columns:

  - `id` (UUID)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
  - `user_id` (foreigh key to `auth.users.id`)
  - `title` (Text)
  - `description` (Text)
  - `completed` (Boolean)

- An `attachments` table with the following columns:
  - `task_id` (foreign key to `tasks.id`)
  - `file_id` (foreign key to `storage.files.id`)

Permissions:

- `tasks`: the `user` role can insert/select/update tasks that they own. Ownership is tracked by the `user_id` column which is set automatically on insert from the session.
- `attachments`: the `user` role can insert/select/delete attachments for tasks and files that they own
- `storage.files`: the `user` role can insert/select/delete files that they own

## Functions

- A `simple` function called `echo` that will just return back some request information
