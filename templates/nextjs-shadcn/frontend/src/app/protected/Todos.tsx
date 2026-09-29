'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, TableProperties } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import { setProfilePublished } from '@/app/profile/actions';
import {
  type Todo,
  type TodoChanges,
  TodoItem,
} from '@/app/protected/TodoItem';
import { StatusDot } from '@/components/StatusTile';
import { SyncIndicator } from '@/components/SyncIndicator';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type WantDraft, WantFields } from '@/components/WantFields';
import {
  LIST_CAPTION,
  ROW_ACTIONS_WIDTH,
  ROW_LEADING_OFFSET,
  ROW_TRAILING,
} from '@/components/WantSentence';
import { graphql } from '@/gql';
import type { Todos_Updates } from '@/gql/graphql';
import { gqlRequest } from '@/lib/graphql';
import { nhost } from '@/lib/nhost/client';
import { localTableURL } from '@/lib/nhost/env';
import { asPreposition, DEFAULT_PREPOSITION } from '@/lib/want';

// `sort_order` first, `created_at` second: a list nobody has reordered still
// reads newest first, and rows sharing a rank can never swap places between
// one request and the next.
const GetTodos = graphql(`
  query GetTodos {
    todos(order_by: [{ sort_order: asc }, { created_at: desc }]) {
      id
      title
      completed
      location
      preposition
      is_public
      sort_order
      file_id
      updated_at
    }
  }
`);

const CreateTodo = graphql(`
  mutation CreateTodo(
    $title: String!
    $location: String
    $preposition: String!
    $sortOrder: Int!
    $isPublic: Boolean!
  ) {
    insert_todos_one(
      object: {
        title: $title
        location: $location
        preposition: $preposition
        sort_order: $sortOrder
        is_public: $isPublic
      }
    ) {
      id
      title
      completed
      location
      preposition
      is_public
      file_id
      updated_at
    }
  }
`);

// One mutation for the whole edit surface rather than one per field: every
// column the `user` role may set on its own row goes through here, so adding a
// column to that permission does not mean adding a document.
const UpdateTodo = graphql(`
  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {
    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {
      id
      title
      completed
      location
      preposition
      is_public
      file_id
      updated_at
    }
  }
`);

// One request, one transaction, however many rows moved. Reordering by
// swapping a pair would stall on a list whose rows all still hold the default
// rank, so a move rewrites every row whose place actually changed.
const ReorderTodos = graphql(`
  mutation ReorderTodos($updates: [todos_updates!]!) {
    update_todos_many(updates: $updates) {
      affected_rows
    }
  }
`);

const DeleteTodo = graphql(`
  mutation DeleteTodo($id: uuid!) {
    delete_todos_by_pk(id: $id) {
      id
    }
  }
`);

const todosQueryKey = ['todos'] as const;

const todosTable = localTableURL('todos');

const emptyDraft: WantDraft = {
  title: '',
  preposition: DEFAULT_PREPOSITION,
  location: null,
};

export function Todos({
  userId,
  profilePublished,
}: {
  userId: string;
  profilePublished: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState(emptyDraft);
  // Shared unless you say otherwise. A list nobody can see is the less useful
  // half of the feature, and the public page is on by default, so the two
  // defaults now agree: what you write goes on the page unless you say not to.
  // The eye on the compose field is where you say not to, before it is added.
  //
  // Deliberately not reset once an item is added. Whether you are writing a
  // public list or a private one is a fact about the sitting, not about the
  // one row; putting the eye back to its default after every add meant someone
  // adding five private items had to turn it off five times, and the fifth is
  // the one they would forget.
  const [shareNew, setShareNew] = useState(true);
  // At most one row may be asking to be deleted, so the answer lives here
  // rather than in each row: opening the question on a second row, or turning
  // away to edit a third, closes the one already open.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  const todos = useQuery({
    queryKey: todosQueryKey,
    queryFn: () => gqlRequest(nhost, GetTodos, {}),
  });

  // Every mutation ends the same way: refetch the list, and re-render the
  // server component above this one, which is what re-reads whether the public
  // page is on and so whether the rows carry an eye at all.
  const settle = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: todosQueryKey });
    router.refresh();
  };

  const createTodo = useMutation({
    mutationFn: (variables: {
      title: string;
      location: string | null;
      preposition: string;
      sortOrder: number;
      isPublic: boolean;
    }) => gqlRequest(nhost, CreateTodo, variables),
    onSuccess: async () => {
      setDraft(emptyDraft);
      await settle();
    },
  });

  const updateTodo = useMutation({
    mutationFn: (variables: { id: string; changes: TodoChanges }) =>
      gqlRequest(nhost, UpdateTodo, variables),
    onSuccess: settle,
  });

  // Deleting the row does not delete its attachment, so the file half is
  // cleaned up here rather than left to accumulate in the bucket forever. A
  // failure of that second step is ignored: the row is already gone, and the
  // file is then merely orphaned rather than blocking the delete the user
  // asked for.
  const deleteTodo = useMutation({
    mutationFn: async ({
      id,
      fileId,
    }: {
      id: string;
      fileId: string | null;
    }) => {
      const result = await gqlRequest(nhost, DeleteTodo, { id });
      if (fileId) {
        await nhost.storage.deleteFile(fileId).catch(() => {});
      }
      return result;
    },
    onSuccess: async () => {
      setConfirmingDeleteId(null);
      await settle();
    },
  });

  const reorderTodos = useMutation({
    mutationFn: (updates: Todos_Updates[]) =>
      gqlRequest(nhost, ReorderTodos, { updates }),
    onSuccess: settle,
  });

  // Same switch as the profile page's, reachable from here because this is
  // where its being off is felt: with the page off there is no eye on any row.
  const turnPageOn = useMutation({
    mutationFn: async (): Promise<void> => {
      const result = await setProfilePublished(true);
      if (result.error) {
        throw new Error(result.error);
      }
    },
    // `router.refresh()` rather than a query invalidation: the flag is read by
    // the server component above this one, so re-rendering it is what brings
    // the eye back on every row. In a transition so React keeps the list on
    // screen while that happens instead of flashing it through a pending
    // state, which read as the page jumping about.
    onSuccess: () => startTransition(() => router.refresh()),
  });

  // Anything that writes. The attachment's own upload is not here because the
  // row update it triggers is, so the line still spins for the part that
  // reaches the database.
  const isSyncing =
    createTodo.isPending ||
    updateTodo.isPending ||
    deleteTodo.isPending ||
    reorderTodos.isPending ||
    turnPageOn.isPending;

  const writeError =
    turnPageOn.error ??
    createTodo.error ??
    updateTodo.error ??
    deleteTodo.error ??
    reorderTodos.error ??
    null;

  const items = todos.data?.todos ?? [];

  /**
   * Moves one item a place up or down.
   *
   * Writes an explicit rank for every row whose place changed rather than
   * swapping a pair, which is what makes the first move work on a list where
   * every row still holds the default rank of 0.
   */
  const move = (id: string, delta: -1 | 1): void => {
    const reordered = [...items];
    const from = reordered.findIndex((todo) => String(todo.id) === id);
    const to = from + delta;

    if (from < 0 || to < 0 || to >= reordered.length) {
      return;
    }

    const [moved] = reordered.splice(from, 1);
    if (!moved) {
      return;
    }
    reordered.splice(to, 0, moved);

    const updates = reordered.flatMap((todo, index) =>
      todo.sort_order === index
        ? []
        : [{ where: { id: { _eq: todo.id } }, _set: { sort_order: index } }],
    );

    if (updates.length) {
      reorderTodos.mutate(updates);
    }
  };

  // Whether the typed round trip has actually carried anything yet. It is a
  // fact about these rows, so it is reported on the card that holds them
  // rather than in a tile above that repeats what is already on screen.
  const hasData = items.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const title = draft.title.trim();
    if (!title) {
      return;
    }

    // An empty box means no particular place, which the column stores as NULL
    // rather than as an empty string, so there is one way to say it. A new
    // item ranks above everything already there, which is where you look for
    // the thing you just typed.
    createTodo.mutate({
      title,
      location: draft.location?.trim() || null,
      preposition: draft.preposition,
      sortOrder: items.length
        ? Math.min(...items.map((todo) => todo.sort_order)) - 1
        : 0,
      isPublic: shareNew,
    });
  };

  return (
    // The card and the two lines under it are one block. Left as siblings of
    // the page's own column they were spaced like separate sections of the
    // page, which put a gap under the card wide enough to read as the end of
    // it - and the lines below then looked like a footer rather than like a
    // report on the thing directly above them.
    <div className="flex flex-col gap-2">
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <StatusDot state={hasData ? 'ok' : 'pending'} />
            {hasData ? 'Typed data' : 'No data yet'}
          </CardTitle>
          <CardDescription>
            {hasData ? (
              <>
                Reading <code>todos</code> through a generated type and your own
                row-level permissions.
              </>
            ) : (
              <>
                A per-user <code>todos</code> table with a typed query and
                mutation is already wired up. Add one below.
              </>
            )}{' '}
            Anything you want to do, and where, if anywhere in particular.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* The same caption the public page puts above the same list, so the
              two read as one thing seen from two sides - and a heading for the
              field below, which had none.

              It is also where the link to your own page belongs. Reaching it
              is a fact about the account rather than about how many rows are
              shared, and out in the card's header it had nothing to sit
              against and read as floating above the corner of the card. */}
          {/* `items-end`, so the caption and the button rest on one bottom
              edge rather than on a shared centre. The button is twice the
              caption's height, so centred it left more air under the words
              than under the button - and the two gaps below this row, one
              above the field and one above Add, visibly disagreed about how
              far apart the two rows were. */}
          <div
            className={`mb-2 flex items-end justify-between gap-4 ${ROW_LEADING_OFFSET} ${ROW_TRAILING}`}
          >
            {/* Aligning the boxes is not the same as aligning what you see.
                `text-xs` wraps a 12px font in a 16px line box, so 2px of
                half-leading sits under the letters, and the descender space
                below that is room uppercase text never uses. Together they
                left the caption floating about 4px above the button's bottom
                edge, which is exactly how much wider the gap beneath it read.
                `leading-none` takes back the half-leading and the nudge takes
                back the descender - measured rather than guessed, which is why
                it is 2px and not a round number. */}
            <h2 className={`${LIST_CAPTION} translate-y-[2px] leading-none`}>
              Want todo list
            </h2>

            {profilePublished ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/u/${userId}`}>
                  <Globe aria-hidden />
                  View public profile
                </Link>
              </Button>
            ) : (
              /* Turns the page on from here rather than sending you to the
                 profile to find the switch. The eye is missing from every row
                 while the page is off, so this is both the explanation and the
                 fix, in the place where the absence is noticed. */
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => turnPageOn.mutate()}
                disabled={turnPageOn.isPending}
              >
                <Globe aria-hidden />
                {turnPageOn.isPending ? 'Turning on…' : 'Turn on public page'}
              </Button>
            )}
          </div>

          {/* The sentence is the form. Offset by the reorder gutter and its
              gap, which is what puts the field's left edge exactly on the left
              edge of the pictures in the list below it - and padded at the
              other end by exactly what a row is, so the two ends line up as
              well as the one. */}
          <form
            className={`flex items-stretch gap-4 ${ROW_LEADING_OFFSET} ${ROW_TRAILING}`}
            onSubmit={handleSubmit}
          >
            {/* No `visibility` while the public page is off: there is nothing
                for the new item to be shared *to*, so offering the choice at
                the moment of writing would be offering a setting that cannot
                take effect. */}
            <WantFields
              want={draft}
              onChange={setDraft}
              visibility={
                profilePublished
                  ? {
                      isPublic: shareNew,
                      onToggle: () => setShareNew((shared) => !shared),
                    }
                  : undefined
              }
              disabled={createTodo.isPending}
            />
            {/* As wide as a row's own controls, and no wider, which is what
                puts its right edge on theirs and the field's right edge on the
                stamps'. The narrower padding is what lets the longer label fit
                that width, so the button does not resize - and take the field
                with it - for as long as the request is in flight. */}
            <Button
              type="submit"
              disabled={createTodo.isPending || !draft.title.trim()}
              className={`h-auto shrink-0 px-1 ${ROW_ACTIONS_WIDTH}`}
            >
              {createTodo.isPending ? 'Adding…' : 'Add'}
            </Button>
          </form>

          {writeError ? (
            <p className="text-destructive text-sm">
              Could not save that change: {writeError.message}
            </p>
          ) : null}

          {todos.isPending ? (
            <p className="text-muted-foreground text-sm">Loading your list…</p>
          ) : null}

          {todos.error ? (
            <p className="text-destructive text-sm">
              Could not load your list: {todos.error.message}
            </p>
          ) : null}

          {!todos.isPending && items.length === 0 ? (
            <p className="px-6 py-12 text-center text-muted-foreground text-sm">
              Nothing here yet. What do you want to do?
            </p>
          ) : null}

          {/* The gap keeps the pictures from stacking into one continuous
              strip: flush against each other they read as a single column of
              image rather than as one picture per row. */}
          {items.length ? (
            <ul className="flex flex-col gap-1">
              {items.map((todo, index) => (
                <TodoItem
                  key={String(todo.id)}
                  todo={
                    {
                      id: String(todo.id),
                      title: todo.title,
                      completed: todo.completed,
                      preposition: asPreposition(todo.preposition),
                      location: todo.location ?? null,
                      isPublic: todo.is_public,
                      fileId: todo.file_id ? String(todo.file_id) : null,
                      updatedAt: todo.updated_at
                        ? String(todo.updated_at)
                        : null,
                    } satisfies Todo
                  }
                  isBusy={
                    reorderTodos.isPending ||
                    (updateTodo.isPending &&
                      updateTodo.variables?.id === String(todo.id)) ||
                    (deleteTodo.isPending &&
                      deleteTodo.variables?.id === String(todo.id))
                  }
                  index={index}
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
                  canShare={profilePublished}
                  isConfirmingDelete={confirmingDeleteId === String(todo.id)}
                  onConfirmDelete={() => setConfirmingDeleteId(String(todo.id))}
                  onCancelDelete={() => setConfirmingDeleteId(null)}
                  onMove={(delta) => move(String(todo.id), delta)}
                  onUpdate={async (changes) => {
                    await updateTodo.mutateAsync({
                      id: String(todo.id),
                      changes,
                    });
                  }}
                  onDelete={() =>
                    deleteTodo.mutate({
                      id: String(todo.id),
                      fileId: todo.file_id ? String(todo.file_id) : null,
                    })
                  }
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {/* Both outside the card on purpose. Neither is part of the feature: one
          reports on it and the other is a local tool, and stacking either
          inside made it read as another row of the list.

          The dashboard link takes the left because it is a standing offer and
          reads as a sentence; the sync line keeps the right, under the stamps
          it is the newest of - the whole column now says when something was
          written, ending with the one just written. */}
      <div className="flex items-center justify-between gap-4 px-1">
        {todosTable ? (
          <a
            href={todosTable}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground/60 text-xs transition-colors hover:text-foreground"
          >
            <TableProperties className="size-3.5" aria-hidden />
            See these rows unfiltered in the dashboard
          </a>
        ) : null}

        <SyncIndicator isSyncing={isSyncing} className="ml-auto" />
      </div>
    </div>
  );
}
