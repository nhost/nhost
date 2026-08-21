import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
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

const todosQueryKey = ['todos'] as const;

export function Todos() {
  const titleId = useId();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const todos = useQuery({
    queryKey: todosQueryKey,
    queryFn: () => gqlRequest(nhost, GetTodos, {}),
  });

  const createTodo = useMutation({
    mutationFn: (newTitle: string) =>
      gqlRequest(nhost, CreateTodo, { title: newTitle }),
    onSuccess: async () => {
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: todosQueryKey });
    },
  });

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
        <CardTitle>Your todos</CardTitle>
        <CardDescription>
          These rows are protected by per-user GraphQL permissions.
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

        {createTodo.error ? (
          <p className="text-destructive text-sm">
            Could not create the todo: {createTodo.error.message}
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
              <li
                key={String(todo.id)}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span
                  className={todo.completed ? 'line-through opacity-60' : ''}
                >
                  {todo.title}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
