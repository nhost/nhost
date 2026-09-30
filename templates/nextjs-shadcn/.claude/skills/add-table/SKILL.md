---
name: add-table
description: Add a PostgreSQL table with migrations, GraphQL metadata, row-level permissions, and refreshed frontend types, in either the per-user or the group-membership ownership shape.
---

# Add a table

Use this skill when adding a model or changing the database schema. Run commands from the project root unless a step says otherwise. Read `backend/nhost/migrations/default/1700000000000_init_todos/up.sql` and `backend/nhost/metadata/databases/default/tables/public_todos.yaml` first; they are the working pattern for this template, in the per-user shape described below.

## Choose the ownership shape

Decide who a row belongs to before writing any SQL, because the answer decides the schema and not merely the permission.

**Per-user.** The row belongs to exactly one account, and a `user_id` column on the row is the whole of the ownership rule. Every permission filters `user_id: {_eq: X-Hasura-User-Id}`, and that column is never writable: an insert preset supplies it from the session. This is the shape the shipped `public.todos` table uses, and it is right for anything private to one person, such as a personal list, a draft, or a setting.

**Membership.** The row belongs to a group, and who may touch it is decided by a second table recording who is in that group and in what capacity. Permissions filter *through* that relationship rather than against a column on the row. This is right for anything several people share: a team's documents, a board, a project with collaborators, anything with an invite.

Choosing wrong is expensive to undo, because the correction is a migration and a rewrite of every permission on the table rather than an edit. Ask whether a second person will ever need access to a single row. If the answer is yes, or even "probably, later", use the membership shape from the start: it collapses to the per-user case when a group has one member, whereas a `user_id` column does not expand to two.

Both shapes are written out in full below. Steps 1 and 2 give the per-user version first and then the membership version; steps 3 and 4 are the same either way.

## 1. Create reversible SQL migrations

A new table is a new timestamped migration directory, and so is every change to a project that has already been deployed. Editing a migration in place is only safe while no environment has run it: before your first deploy, adding a column to the starter's own table belongs in that table's existing migration, which is what `AGENTS.md` means by keeping the todos table to one file. After a deploy that reverses, because a migration another environment has already applied cannot be rewritten.

Choose a snake_case table name and create the directory with both migration directions:

```sh
timestamp="$(date +%s)000"
migration="backend/nhost/migrations/default/${timestamp}_create_notes"
mkdir -p "$migration"
```

For a user-owned `public.notes` table, write this to `up.sql`:

```sql
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index on public.notes (user_id);
```

Write the inverse operation to `down.sql`:

```sql
drop table public.notes;
```

Keep the owner column required. Do not give it an `auth.uid()` SQL default; the insert permission preset in the next step supplies the authenticated user ID.

### The membership shape in SQL

Two tables: the thing itself, and the roster. The roster carries the capacity each member holds, so one table answers both "may this person see it" and "may this person change it".

```sql
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (board_id, user_id),
  constraint board_members_role_check check (role in ('owner', 'editor', 'viewer'))
);

create index on public.board_members (user_id);
```

The composite primary key states "one membership per person per board" where it cannot be raced, rather than checking it in application code. The check constraint pins the vocabulary: a role outside that list is a typo that would otherwise grant nothing silently, or be spelled into a permission later and grant everything. `user_id` is indexed because every select filters on it; the primary key already covers `board_id`.

Now the part that is easy to get wrong. The insert permission on `board_members` has to require that the caller already holds `owner` on that board — without it anybody can add themselves to anybody's board, which is the whole access model gone. But at the instant `boards` receives its first row there is no membership yet, so the creator fails that check and is locked out of the board they just made.

The tempting repair is to relax the check to "or the board has no members yet". Do not. That is a hole anyone can walk through by racing a board they did not create, and the race is not exotic: it is one mutation fired at the right moment.

Insert the creator's membership beneath the permission layer instead. Permissions apply to GraphQL requests; a trigger runs inside the transaction that created the row, where there is no caller to check and nothing to race.

```sql
create or replace function public.add_board_creator_as_owner()
returns trigger
language plpgsql
as $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  return new;
end;
$$;

create trigger boards_add_creator_as_owner
  after insert on public.boards
  for each row
  execute function public.add_board_creator_as_owner();
```

`after insert`, not `before`: the foreign key from `board_members.board_id` needs the board row to exist already, and during a `before insert` trigger it does not.

Write the inverse to `down.sql`, dropping the trigger and function ahead of the tables, and the roster ahead of the table it references:

```sql
drop trigger if exists boards_add_creator_as_owner on public.boards;
drop function if exists public.add_board_creator_as_owner();
drop table if exists public.board_members;
drop table if exists public.boards;
```

## 2. Track the table and grant the `user` role access

Create `backend/nhost/metadata/databases/default/tables/public_notes.yaml`:

```yaml
table:
  name: notes
  schema: public
insert_permissions:
  - role: user
    permission:
      check:
        user_id:
          _eq: X-Hasura-User-Id
      set:
        user_id: X-Hasura-User-Id
      columns:
        - body
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - user_id
        - body
        - created_at
      filter:
        user_id:
          _eq: X-Hasura-User-Id
update_permissions:
  - role: user
    permission:
      columns:
        - body
      filter:
        user_id:
          _eq: X-Hasura-User-Id
      check: null
delete_permissions:
  - role: user
    permission:
      filter:
        user_id:
          _eq: X-Hasura-User-Id
```

Adapt the columns to the requested table. Never put `user_id` in the user-writable insert or update column lists. Keep the insert `set` preset and every owner filter so users can only create, read, update, and delete their own rows.

### Permissions for the membership shape

Create `backend/nhost/metadata/databases/default/tables/public_boards.yaml`. The relationships are what the filters travel along, so declaring them is not optional here:

```yaml
table:
  name: boards
  schema: public
array_relationships:
  - name: members
    using:
      foreign_key_constraint_on:
        column: board_id
        table:
          name: board_members
          schema: public
insert_permissions:
  - role: user
    permission:
      check:
        created_by:
          _eq: X-Hasura-User-Id
      set:
        created_by: X-Hasura-User-Id
      columns:
        - name
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - name
        - created_by
        - created_at
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
update_permissions:
  - role: user
    permission:
      columns:
        - name
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
          role:
            _in:
              - owner
              - editor
      check: null
delete_permissions:
  - role: user
    permission:
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
          role:
            _eq: owner
```

A filter through an array relationship asks whether *any* related row matches, so `members: {user_id: {_eq: X-Hasura-User-Id}}` reads as "the caller is on this board". Sibling keys inside it are combined with AND against the same related row, so the update filter reads "one membership row names the caller **and** carries owner or editor". That single-row requirement is the point: a reading that allowed one member row to satisfy the name and a different one to satisfy the role would let any viewer edit a board that happens to have an editor on it.

Then the roster itself, in `public_board_members.yaml`:

```yaml
table:
  name: board_members
  schema: public
object_relationships:
  - name: board
    using:
      foreign_key_constraint_on: board_id
select_permissions:
  - role: user
    permission:
      columns:
        - board_id
        - user_id
        - role
        - created_at
      filter:
        board:
          members:
            user_id:
              _eq: X-Hasura-User-Id
insert_permissions:
  - role: user
    permission:
      check:
        board:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _eq: owner
      columns:
        - board_id
        - user_id
        - role
delete_permissions:
  - role: user
    permission:
      filter:
        board:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _eq: owner
```

Note what differs from the per-user shape: `user_id` **is** in the insert column list here, and that is deliberate rather than an oversight. In the per-user shape that column is the ownership rule and must never be client-supplied. Here it names the invitee, and naming somebody else is the entire point of an invite. What guards it is the `check`, which admits the insert only when the caller already holds `owner` on that board — and the trigger from step 1 is what makes that check satisfiable for the person who created the board.

## 3. Include the metadata file

Add this entry to `backend/nhost/metadata/databases/default/tables/tables.yaml` without removing existing includes:

```yaml
- "!include public_notes.yaml"
```

The membership shape produces two tracked tables, so it needs both lines. A roster left untracked is not merely invisible: the filters above travel through the `members` relationship, and Hasura cannot build that relationship to a table it does not know about, so every permission on `boards` fails to apply.

```yaml
- "!include public_boards.yaml"
- "!include public_board_members.yaml"
```

## 4. Apply and refresh the typed frontend

Start or re-run the local backend so it applies the migration and metadata:

```sh
(cd backend && nhost up)
```

After the backend is ready, regenerate the committed role-scoped schema and TypeScript documents. This is the required final step:

```sh
(cd frontend && pnpm codegen)
```
