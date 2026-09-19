import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LocationTag } from '@/components/WantFields';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createAnonymousClient } from '@/lib/nhost/server';
import { fileURL } from '@/lib/storage';
import { asPreposition } from '@/lib/want';

export const dynamic = 'force-dynamic';

/**
 * The same document serves everyone, because the role decides what comes back.
 *
 * Asked as `public` it returns the account only when its owner published the
 * profile, and the nested `todos` only holds the rows they shared: neither
 * filter is written here, both live in the permissions. Nothing on this page
 * had to remember to exclude a private row, which is the point of putting the
 * rule in the backend rather than in a `where` clause a page could forget.
 *
 * `schema.graphql` is dumped for the `user` role, not `public`, so adding a
 * field here (`avatarUrl`, `email`, `todos.user_id`, ...) can pass
 * `pnpm codegen:types` while still being unreadable by the role this page
 * actually runs as. Check the `public` column allowlist in
 * `backend/nhost/metadata/` before adding one (see the refresh-context skill
 * in `SKILLS.md`).
 */
const GetSharedList = graphql(`
  query GetSharedList($id: uuid!) {
    user(id: $id) {
      id
      displayName
      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {
        id
        title
        completed
        location
        preposition
        sort_order
        file_id
      }
    }
  }
`);

type PageProps = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Memoized per request: `generateMetadata` and `SharedList` both call this
// for the same `id` on every render, and without `cache` that is two
// identical `GetSharedList` round trips instead of one.
const sharedList = cache(async (id: string) => {
  // Checked here rather than in a catch below, so a shape the `uuid` scalar
  // would reject reads as "no such page" without also swallowing a backend
  // that is merely down, which must not look like a missing page.
  if (!UUID.test(id)) {
    return null;
  }

  const { user } = await gqlRequest(createAnonymousClient(), GetSharedList, {
    id,
  });

  return user;
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const user = await sharedList(id);

  if (!user) {
    return { title: 'Not found' };
  }

  return {
    title: user.displayName,
    description: `What ${user.displayName} wants to do.`,
  };
}

export default async function SharedList({ params }: PageProps) {
  const { id } = await params;
  const user = await sharedList(id);

  // An unpublished profile and no such account are deliberately the same
  // answer, so this page cannot be used to find out whether an account exists.
  if (!user) {
    notFound();
  }

  const done = user.todos.filter((todo) => todo.completed).length;
  const client = createAnonymousClient();

  return (
    // No card around any of this. A card frames a control panel; this is
    // somebody's list of things they want to do, so it gets the page itself.
    // The `public` role and the anonymous render are explained in the README
    // rather than printed above a stranger's head.
    <div className="flex flex-col gap-14 pb-32">
      <header className="flex flex-col items-center gap-4 pt-6 text-center">
        {/* Not `user.avatarUrl`: the `public` role cannot read that column,
            because for an unpublished-avatar account it is a Gravatar URL that
            embeds an md5 of the email (see `auth_users.yaml`). The stored
            avatar, if any, is served straight from `storage.files` at this
            convention path; an account that never uploaded one 404s here and
            falls back to the initial, which is the intended look anyway. */}
        <Avatar className="size-24 ring-2 ring-border ring-offset-4 ring-offset-background">
          {/* Asked for at three times the size it is drawn at, the way
              `FileThumbnail` does, so this loads sharp for anyone on this
              public page instead of pulling the full 512px upload down to
              paint a 96 CSS px circle. */}
          <AvatarImage
            src={fileURL(client, user.id, { w: 288, q: 80, f: 'auto' })}
            alt=""
          />
          <AvatarFallback className="text-2xl">
            {user.displayName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <h1 className="font-bold text-4xl tracking-tight">
            {user.displayName}
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-[0.2em]">
            {user.todos.length === 1
              ? '1 want todo'
              : `${user.todos.length} want todos`}
            {done ? ` \u00b7 ${done} done` : null}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
          Want to do list
        </h2>

        {/* Read-only, so no boxes. The rows in the signed-in list are bordered
            because each one is a set of controls; here they are sentences, and
            sentences want to be read rather than operated. */}
        <ul className="flex flex-col divide-y divide-border/60">
          {user.todos.map((todo, index) => (
            <li key={String(todo.id)} className="flex items-center gap-5 py-6">
              {/* Counts the list rather than the rows, so the left edge of
                  every sentence lines up whether or not there is a photo. */}
              <span className="w-6 shrink-0 self-start pt-3 text-right font-mono text-muted-foreground/40 text-sm tabular-nums">
                {index + 1}
              </span>

              {/* Asked for at twice the size it is drawn at, so it holds up on
                  a dense screen, and re-encoded on the way out rather than
                  sending the original. */}
              {todo.file_id ? (
                <Avatar className="size-40 shrink-0 self-start rounded-xl border">
                  <AvatarImage
                    src={fileURL(client, String(todo.file_id), {
                      w: 320,
                      q: 80,
                      f: 'auto',
                    })}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-xl" />
                </Avatar>
              ) : null}

              <p
                className={`flex-1 text-pretty text-3xl leading-snug sm:text-4xl ${
                  todo.completed ? 'text-muted-foreground line-through' : ''
                }`}
              >
                <span className="text-muted-foreground">I want to </span>
                {todo.title}
                {todo.location ? (
                  <>
                    <span className="text-muted-foreground">
                      {' '}
                      {asPreposition(todo.preposition)}{' '}
                    </span>
                    <LocationTag>{todo.location}</LocationTag>
                  </>
                ) : null}
              </p>

              {todo.completed ? (
                <span className="shrink-0 self-start rounded-full border px-2.5 py-0.5 text-muted-foreground text-xs uppercase tracking-wider">
                  Done
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
