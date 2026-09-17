'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { TodoItem } from '@/app/protected/TodoItem';
import { StatusDot } from '@/components/StatusTile';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { nhost } from '@/lib/nhost/client';
import { localTableURL } from '@/lib/nhost/env';

const GetTodos = graphql(`
  query GetTodos {
    todos {
      id
      title
      completed
      created_at
      user_id
    }
  }
`);

const CreateTodo = graphql(`
  mutation CreateTodo($title: String!) {
    insert_todos_one(object: { title: $title }) {
      id
      title
      completed
      created_at
      user_id
    }
  }
`);

// The `user` role may only set title and completed, so the whole edit surface
// goes through one mutation rather than one per field.
const UpdateTodo = graphql(`
  mutation UpdateTodo($id: uuid!, $changes: todos_set_input!) {
    update_todos_by_pk(pk_columns: { id: $id }, _set: $changes) {
      id
      title
      completed
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

export function Todos() {
  const titleId = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

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
    mutationFn: (newTitle: string) =>
      gqlRequest(nhost, CreateTodo, { title: newTitle }),
    onSuccess: async () => {
      setTitle('');
      await settle();
    },
  });

  const updateTodo = useMutation({
    mutationFn: (variables: {
      id: string;
      changes: { title?: string; completed?: boolean };
    }) => gqlRequest(nhost, UpdateTodo, variables),
    onSuccess: settle,
  });

  const deleteTodo = useMutation({
    mutationFn: (id: string) => gqlRequest(nhost, DeleteTodo, { id }),
    onSuccess: settle,
  });

  const writeError =
    createTodo.error ?? updateTodo.error ?? deleteTodo.error ?? null;

  // Whether the typed round trip has actually carried anything yet. It is a
  // fact about these rows, so it is reported on the card that holds them
  // rather than in a tile above that repeats what is already on screen.
  const hasData = Boolean(todos.data?.todos.length);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const newTitle = title.trim();
    if (!newTitle) {
      return;
    }

    createTodo.mutate(newTitle);
  };

  return (
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
          This view is rendered on the server and redirects to{' '}
          <code>/signin</code> without a session.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex items-end gap-2" onSubmit={handleSubmit}>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={titleId}>New todo</Label>
            <Input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ship something useful"
              disabled={createTodo.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={createTodo.isPending || !title.trim()}
          >
            {createTodo.isPending ? 'Adding…' : 'Add todo'}
          </Button>
        </form>

        {writeError ? (
          <p className="text-destructive text-sm">
            Could not save that change: {writeError.message}
          </p>
        ) : null}

        {todos.isPending ? (
          <p className="text-muted-foreground text-sm">Loading todos…</p>
        ) : null}

        {todos.error ? (
          <p className="text-destructive text-sm">
            Could not load todos: {todos.error.message}
          </p>
        ) : null}

        {todos.data?.todos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No todos yet. Add your first one above.
          </p>
        ) : null}

        {todos.data?.todos.length ? (
          <ul className="flex flex-col gap-2">
            {todos.data.todos.map((todo) => (
              <TodoItem
                key={String(todo.id)}
                todo={{
                  id: String(todo.id),
                  title: todo.title,
                  completed: todo.completed,
                }}
                isBusy={updateTodo.isPending || deleteTodo.isPending}
                onToggle={(completed) =>
                  updateTodo.mutate({
                    id: String(todo.id),
                    changes: { completed },
                  })
                }
                onRename={(newTitle) =>
                  updateTodo.mutate({
                    id: String(todo.id),
                    changes: { title: newTitle },
                  })
                }
                onDelete={() => deleteTodo.mutate(String(todo.id))}
              />
            ))}
          </ul>
        ) : null}

        {todosTable ? (
          <p className="text-muted-foreground text-sm">
            The same rows, unfiltered:{' '}
            <a
              href={todosTable}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              open the todos table in the dashboard
            </a>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
