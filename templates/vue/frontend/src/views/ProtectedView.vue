<script setup lang="ts">
import type { ResultOf } from '@graphql-typed-document-node/core';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { graphql } from '@/gql';
import { gqlRequest } from '@/lib/graphql';
import { useAuth } from '@/lib/nhost/auth';

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

const { nhost, session } = useAuth();
const router = useRouter();

const todos = ref<TodoList>([]);
const title = ref('');
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await gqlRequest(nhost, GetTodos, {});
    todos.value = data.todos;
    error.value = null;
  } catch {
    error.value = 'Could not load todos.';
  } finally {
    loading.value = false;
  }
}

async function add(): Promise<void> {
  const trimmed = title.value.trim();
  if (!trimmed) {
    return;
  }
  submitting.value = true;
  try {
    await gqlRequest(nhost, CreateTodo, { title: trimmed });
    title.value = '';
    await load();
  } catch {
    error.value = 'Could not create the todo.';
  } finally {
    submitting.value = false;
  }
}

async function signOut(): Promise<void> {
  if (session.value) {
    await nhost.auth.signOut({ refreshToken: session.value.refreshToken });
  }
  router.push('/');
}

onMounted(() => {
  if (!session.value) {
    router.push('/signin');
    return;
  }
  void load();
});
</script>

<template>
  <div class="stack">
    <div class="row between">
      <h1>Your todos</h1>
      <button class="button ghost" type="button" @click="signOut">
        Sign out
      </button>
    </div>
    <p class="muted">
      These rows are protected by per-user GraphQL permissions.
    </p>

    <form class="row" @submit.prevent="add">
      <label class="field grow">
        <span class="visually-hidden">New todo</span>
        <input
          v-model="title"
          placeholder="Ship something useful"
          :disabled="submitting"
        />
      </label>
      <button
        class="button"
        type="submit"
        :disabled="submitting || !title.trim()"
      >
        {{ submitting ? 'Adding…' : 'Add todo' }}
      </button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">Loading todos…</p>
    <p v-else-if="todos.length === 0" class="muted">
      No todos yet. Add your first one above.
    </p>

    <ul class="list">
      <li
        v-for="todo in todos"
        :key="String(todo.id)"
        :class="{ done: todo.completed }"
      >
        {{ todo.title }}
      </li>
    </ul>
  </div>
</template>
