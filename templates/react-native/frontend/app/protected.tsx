import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { graphql } from '@/gql';
import { gqlRequest } from './lib/graphql';
import { useAuth } from './lib/nhost/AuthProvider';
import { styles } from './styles';

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
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!session) {
      router.replace('/signin');
    }
  }, [session]);

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
    router.replace('/');
  };

  const submit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      createTodo.mutate(trimmed);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your todos</Text>
        <Text style={styles.muted}>
          These rows are protected by per-user GraphQL permissions.
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ship something useful"
          editable={!createTodo.isPending}
        />
        <TouchableOpacity
          style={styles.button}
          onPress={submit}
          disabled={createTodo.isPending || !title.trim()}
        >
          {createTodo.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Add todo</Text>
          )}
        </TouchableOpacity>
        {createTodo.error ? (
          <Text style={styles.error}>Could not create the todo.</Text>
        ) : null}
      </View>

      {todos.isPending ? <ActivityIndicator color="#0f172a" /> : null}
      {todos.error ? (
        <Text style={styles.error}>Could not load todos.</Text>
      ) : null}

      <FlatList
        data={todos.data?.todos ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.todoRow}>
            <Text style={item.completed ? styles.todoDone : styles.todoText}>
              {item.title}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          todos.isSuccess ? (
            <Text style={styles.muted}>
              No todos yet. Add your first one above.
            </Text>
          ) : null
        }
      />

      <TouchableOpacity onPress={signOut}>
        <Text style={styles.link}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
