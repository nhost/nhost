<script lang="ts">
import type { ResultOf } from '@graphql-typed-document-node/core';
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { graphql } from '$gql';
import { gqlRequest } from '$lib/graphql';
import { nhost, session } from '$lib/nhost/auth';

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

type TodoList = ResultOf<typeof GetTodos>['todos'];

let todos = $state<TodoList>([]);
let title = $state('');
let loading = $state(true);
let submitting = $state(false);
let error = $state<string | null>(null);

async function load(): Promise<void> {
  loading = true;
  try {
    const data = await gqlRequest(nhost, GetTodos, {});
    todos = data.todos;
    error = null;
  } catch {
    error = 'Could not load todos.';
  } finally {
    loading = false;
  }
}

async function add(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }
  submitting = true;
  try {
    await gqlRequest(nhost, CreateTodo, { title: trimmed });
    title = '';
    await load();
  } catch {
    error = 'Could not create the todo.';
  } finally {
    submitting = false;
  }
}

async function signOut(): Promise<void> {
  const current = get(session);
  if (current) {
    await nhost.auth.signOut({ refreshToken: current.refreshToken });
  }
  goto('/');
}

onMount(() => {
  if (!get(session)) {
    goto('/signin');
    return;
  }
  void load();
});
</script>

<div class="stack">
  <div class="row between">
    <h1>Your todos</h1>
    <button class="button ghost" type="button" onclick={signOut}>Sign out</button>
  </div>
  <p class="muted">These rows are protected by per-user GraphQL permissions.</p>

  <form class="row" onsubmit={add}>
    <label class="field grow">
      <span class="visually-hidden">New todo</span>
      <input
        bind:value={title}
        placeholder="Ship something useful"
        disabled={submitting}
      />
    </label>
    <button class="button" type="submit" disabled={submitting || !title.trim()}>
      {submitting ? 'Adding…' : 'Add todo'}
    </button>
  </form>

  {#if error}<p class="error">{error}</p>{/if}
  {#if loading}
    <p class="muted">Loading todos…</p>
  {:else if todos.length === 0}
    <p class="muted">No todos yet. Add your first one above.</p>
  {/if}

  <ul class="list">
    {#each todos as todo (String(todo.id))}
      <li class:done={todo.completed}>{todo.title}</li>
    {/each}
  </ul>
</div>
