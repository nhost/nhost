'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, TableProperties } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
  type Todo,
  type TodoChanges,
  TodoItem,
} from '@/app/protected/TodoItem';
import { StatusDot } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type WantDraft, WantFields } from '@/components/WantFields';
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
  const [draft, setDraft] = useState(emptyDraft);
  // Private unless you say otherwise, and it resets with the rest of the form
  // so sharing one item never quietly becomes the default for the next.
  const [shareNew, setShareNew] = useState(false);

  const todos = useQuery({
    queryKey: todosQueryKey,
    queryFn: () => gqlRequest(nhost, GetTodos, {}),
  });

  // Every mutation ends the same way: refetch the list, and re-render the
  // server components so the status tiles above match what is on screen.
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
      setShareNew(false);
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
    onSuccess: settle,
  });

  const reorderTodos = useMutation({
    mutationFn: (updates: Todos_Updates[]) =>
      gqlRequest(nhost, ReorderTodos, { updates }),
    onSuccess: settle,
  });

  const writeError =
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
  const sharedCount = items.filter((todo) => todo.is_public).length;

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
    <>
      <Card>
        <CardHeader>
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
          {/* The sentence is the form. */}
          <form className="flex items-stretch gap-2" onSubmit={handleSubmit}>
            <WantFields
              want={draft}
              onChange={setDraft}
              visibility={{
                isPublic: shareNew,
                onToggle: () => setShareNew((shared) => !shared),
              }}
              disabled={createTodo.isPending}
            />
            <Button
              type="submit"
              disabled={createTodo.isPending || !draft.title.trim()}
              className="h-auto shrink-0"
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
            <p className="text-muted-foreground text-sm">
              Nothing here yet. What do you want to do?
            </p>
          ) : null}

          {items.length ? (
            <ul className="flex flex-col">
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
                    } satisfies Todo
                  }
                  isBusy={
                    reorderTodos.isPending ||
                    (updateTodo.isPending &&
                      updateTodo.variables?.id === String(todo.id)) ||
                    (deleteTodo.isPending &&
                      deleteTodo.variables?.id === String(todo.id))
                  }
                  canMoveUp={index > 0}
                  canMoveDown={index < items.length - 1}
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

          {/* A statement and a button rather than a sentence with a link in it.
            Two underlined links stacked here read as one paragraph and get
            skipped, so the thing worth doing is the only thing shaped like a
            control. */}
          {sharedCount ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-muted-foreground text-sm">
                {sharedCount === 1 ? '1 item is' : `${sharedCount} items are`}{' '}
                shared
                {profilePublished
                  ? ', and anyone with the link can see them.'
                  : ', but nobody can see them yet.'}
              </p>

              <Button
                asChild
                size="sm"
                variant={profilePublished ? 'outline' : 'default'}
              >
                <Link href={profilePublished ? `/u/${userId}` : '/profile'}>
                  {profilePublished ? (
                    <>
                      <Globe aria-hidden />
                      View public profile
                    </>
                  ) : (
                    'Publish your profile'
                  )}
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Outside the card on purpose. It is a local tool, not part of the
        feature, and stacking it under the sharing line as a second underlined
        sentence made both look like the same thing and got both ignored. */}
      {todosTable ? (
        <a
          href={todosTable}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 self-start px-1 text-muted-foreground/60 text-xs transition-colors hover:text-foreground"
        >
          <TableProperties className="size-3.5" aria-hidden />
          See these rows unfiltered in the dashboard
        </a>
      ) : null}
    </>
  );
}
