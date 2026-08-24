import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { graphql } from '@/gql';
import { gqlRequest } from '../lib/graphql';
import { useAuth } from '../lib/nhost/AuthProvider';

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

export default function Protected() {
  const { nhost, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!session) {
      navigate('/signin');
    }
  }, [session, navigate]);

  const todos = useQuery({
    queryKey: todosQueryKey,
    queryFn: () => gqlRequest(nhost, GetTodos, {}),
    enabled: !!session,
  });

  const createTodo = useMutation({
    mutationFn: (newTitle: string) =>
      gqlRequest(nhost, CreateTodo, { title: newTitle }),
    onSuccess: async () => {
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: todosQueryKey });
    },
  });

  const signOut = async () => {
    if (session) {
      await nhost.auth.signOut({ refreshToken: session.refreshToken });
    }
    navigate('/');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed) {
      createTodo.mutate(trimmed);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="stack">
      <div className="row between">
        <h1>Your todos</h1>
        <button className="button ghost" type="button" onClick={signOut}>
          Sign out
        </button>
      </div>
      <p className="muted">
        These rows are protected by per-user GraphQL permissions.
      </p>

      <form className="row" onSubmit={submit}>
        <label className="field grow">
          <span className="visually-hidden">New todo</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ship something useful"
            disabled={createTodo.isPending}
          />
        </label>
        <button
          className="button"
          type="submit"
          disabled={createTodo.isPending || !title.trim()}
        >
          {createTodo.isPending ? 'Adding…' : 'Add todo'}
        </button>
      </form>

      {createTodo.error && <p className="error">Could not create the todo.</p>}
      {todos.isPending && <p className="muted">Loading todos…</p>}
      {todos.error && <p className="error">Could not load todos.</p>}
      {todos.data?.todos.length === 0 && (
        <p className="muted">No todos yet. Add your first one above.</p>
      )}

      <ul className="list">
        {todos.data?.todos.map((todo) => (
          <li key={String(todo.id)} className={todo.completed ? 'done' : ''}>
            {todo.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
