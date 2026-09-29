import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { EmptyList } from '@/components/EmptyList';
import { RowPlaceholder } from '@/components/RowPlaceholder';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  LIST_CAPTION,
  ROW_DIVIDER,
  ROW_GAP,
  ROW_MEDIA,
  ROW_MEDIA_SLOT,
  ROW_PLACEHOLDER,
  ROW_SENTENCE,
  ROW_STAMP,
  Stamp,
  WantSentence,
} from '@/components/WantSentence';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { createAnonymousClient, createNhostClient } from '@/lib/nhost/server';
import { fileURL } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * The same document serves everyone, because the role decides what comes back.
 *
 * Asked as `public` it returns the account only while its owner leaves their
 * page on, and the nested `todos` only holds the rows they shared: neither
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
      createdAt
      todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {
        id
        title
        completed
        location
        preposition
        sort_order
        file_id
        updated_at
      }
    }
  }
`);

type PageProps = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `Sep 2026`, for the line under the name.
 *
 * Fixed to `en-US` for the same reason the row stamps are: this page is
 * server-rendered, and a string that depends on the visitor's locale is a
 * hydration mismatch waiting to happen.
 */
function joinedOn(value: string): string {
  const at = new Date(value);

  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

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

  // A page turned off and no such account are deliberately the same answer, so
  // this page cannot be used to find out whether an account exists.
  if (!user) {
    notFound();
  }

  // Identity only - never the data. The list above is still read through
  // `createAnonymousClient()`, because asking as `user` would have Hasura
  // apply the owner's row filter and hide everybody else's rows; this reads
  // the session purely to answer "is this page mine", which decides whether
  // the empty state offers a way to fill it. A visitor with no session gets
  // `null` here and the page renders exactly as it did before.
  const viewer = (await createNhostClient()).getUserSession()?.user;
  const isOwner = viewer?.id === user.id;

  const client = createAnonymousClient();

  return (
    // Narrower than the page it sits on and centred in it, so the list is a
    // thing on a page rather than the page itself. The `public` role and the
    // anonymous render are explained in the README rather than printed above a
    // stranger's head.
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 pb-32">
      <header className="flex flex-col items-center gap-4 pt-6 text-center">
        {/* Not `user.avatarUrl`: the `public` role cannot read that column,
            because for an account that never uploaded a photo it is a Gravatar
            URL that embeds an md5 of the email (see `auth_users.yaml`). The stored
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

        <div className="flex flex-col items-center gap-1">
          <h1 className="font-medium text-xl tracking-tight">
            {user.displayName}
          </h1>

          {/* Month and year, never the day. It is here to say the account is
              not one made this morning to impersonate somebody, and a month
              answers that; the exact date answers nothing anyone needed and
              pins the account to a point on a timeline.

              `createdAt` has to be on the `public` column list in
              `auth_users.yaml` for this to return anything - `schema.graphql`
              is dumped for the `user` role, so it type-checks either way. */}
          <p className="text-muted-foreground/70 text-sm italic">
            Since {joinedOn(String(user.createdAt))}
          </p>
        </div>
      </header>

      {/* Outside the card, the way a caption sits above the thing it names.
          Inside it, it was one more row in a list of rows. */}
      <section className="flex flex-col gap-3">
        <h2 className={`px-1 ${LIST_CAPTION}`}>Want todo list</h2>

        {/* The same card the owner sees their own list in, so a visitor and the
            person who wrote the list are looking at one thing rather than two
            designs of it. Everything that operates a row - the checkbox, the
            reorder gutter, the edit and share controls - is simply absent here;
            the measurements the rows are built from are shared, so the two
            cannot drift apart again. */}
        <Card>
          <CardContent className="px-8">
            {/* A page that is on but has nothing shared on it yet. Reached
                either by a stranger following a link early or by the owner
                checking what the link shows, so it says only that the list is
                empty - who it is empty for is not this page's business. */}
            {user.todos.length === 0 ? (
              <EmptyList
                action={
                  isOwner ? (
                    /* The arrow leads rather than trails, so the eye meets
                       the direction before the words and the whole thing
                       reads as a way out of an empty page. It is
                       `aria-hidden`; the link already says where it goes.

                       No underline and no full-strength foreground, so it
                       sits quietly on an otherwise empty card rather than
                       being the brightest thing on the page. Between them
                       that is the whole usual signal that this is a link
                       gone, so the hover has to carry it: the words come up
                       to full strength and the arrow inches toward them. At
                       rest the arrow and the italic are what set the line
                       apart from the one above it.

                       A transition rather than a keyframed drift. The motion
                       only has to say "this is a control and you are on it",
                       which a 2px nudge on hover says as well as anything
                       moving on its own - and it costs no `@keyframes`, no
                       reduced-motion opt-out, and nothing running when the
                       page is just sitting there. */
                    <Link
                      href="/protected"
                      className="group inline-flex items-center gap-1.5 text-muted-foreground text-sm italic transition-colors hover:text-foreground"
                    >
                      <ArrowRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                      Add something
                    </Link>
                  ) : undefined
                }
              />
            ) : null}

            <ul className="flex flex-col">
              {user.todos.map((todo, index) => (
                <li
                  key={String(todo.id)}
                  className={`flex items-center py-3 ${ROW_GAP} ${ROW_DIVIDER}`}
                >
                  {/* Reserved whether or not there is a photo, exactly as in
                      the owner's list: it is what gives every sentence one
                      left edge. An empty one draws the same motif, chosen by
                      position so a list cycles rather than repeats. */}
                  <div className={ROW_MEDIA_SLOT}>
                    {todo.file_id ? (
                      <Avatar className={ROW_MEDIA}>
                        <AvatarImage
                          src={fileURL(client, String(todo.file_id), {
                            w: 192,
                            q: 80,
                            f: 'auto',
                          })}
                          alt=""
                          className="object-cover"
                        />
                        <AvatarFallback className="rounded-[inherit]" />
                      </Avatar>
                    ) : (
                      <div className={`${ROW_MEDIA} overflow-hidden`}>
                        <RowPlaceholder
                          index={index}
                          className={ROW_PLACEHOLDER}
                        />
                      </div>
                    )}
                  </div>

                  <WantSentence
                    title={todo.title}
                    preposition={todo.preposition}
                    location={todo.location ?? null}
                    completed={todo.completed}
                    className={`flex-1 text-pretty ${ROW_SENTENCE}`}
                  />

                  <Stamp
                    value={todo.updated_at ? String(todo.updated_at) : null}
                    className={ROW_STAMP}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
