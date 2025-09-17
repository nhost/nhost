import { Stack, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ProtectedScreen from "./components/ProtectedScreen";
import { useAuth } from "./lib/nhost/AuthProvider";
import { commonStyles } from "./styles/commonStyles";

// The interfaces below define the structure of our data
// They are not strictly necessary but help with type safety

// Represents a single todo item
interface Todo {
  id: string;
  title: string;
  details: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// This matches the GraphQL response structure for fetching todos
// Can be used as a generic type on the request method
interface GetTodos {
  todos: Todo[];
}

// This matches the GraphQL response structure for inserting a todo
// Can be used as a generic type on the request method
interface InsertTodo {
  insert_todos_one: Todo | null;
}

// This matches the GraphQL response structure for updating a todo
// Can be used as a generic type on the request method
interface UpdateTodo {
  update_todos_by_pk: Todo | null;
}

export default function Todos() {
  const { nhost, session } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoDetails, setNewTodoDetails] = useState("");
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [addingTodo, setAddingTodo] = useState(false);
  const [updatingTodos, setUpdatingTodos] = useState<Set<string>>(new Set());


  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!session) {
      router.replace("/signin");
    }
  }, [session]);

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      // Make GraphQL request to fetch todos using Nhost client
      // The query automatically filters by user_id due to Hasura permissions
      const response = await nhost.graphql.request<GetTodos>({
        query: `
          query GetTodos {
            todos(order_by: { created_at: desc }) {
              id
              title
              details
              completed
              created_at
              updated_at
              user_id
            }
          }
        `,
      });

      // Check for GraphQL errors in the response body
      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || "Failed to fetch todos",
        );
      }

      // Extract todos from the GraphQL response data
      setTodos(response.body?.data?.todos || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  }, [nhost.graphql]);

  const addTodo = async () => {
    if (!newTodoTitle.trim()) return;

    try {
      setAddingTodo(true);
      // Execute GraphQL mutation to insert a new todo
      // user_id is automatically set by Hasura based on JWT token
      const response = await nhost.graphql.request<InsertTodo>({
        query: `
          mutation InsertTodo($title: String!, $details: String) {
            insert_todos_one(object: { title: $title, details: $details }) {
              id
              title
              details
              completed
              created_at
              updated_at
              user_id
            }
          }
        `,
        variables: {
          title: newTodoTitle.trim(),
          details: newTodoDetails.trim() || null,
        },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || "Failed to add todo",
        );
      }

      if (!response.body?.data?.insert_todos_one) {
        throw new Error("Failed to add todo");
      }
      setTodos([response.body?.data?.insert_todos_one, ...todos]);
      setNewTodoTitle("");
      setNewTodoDetails("");
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo");
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to add todo");
    } finally {
      setAddingTodo(false);
    }
  };

  const updateTodo = async (
    id: string,
    updates: Partial<Pick<Todo, "title" | "details" | "completed">>,
  ) => {
    try {
      setUpdatingTodos(prev => new Set([...prev, id]));
      // Execute GraphQL mutation to update an existing todo by primary key
      // Hasura permissions ensure users can only update their own todos
      const response = await nhost.graphql.request<UpdateTodo>({
        query: `
          mutation UpdateTodo($id: uuid!, $updates: todos_set_input!) {
            update_todos_by_pk(pk_columns: { id: $id }, _set: $updates) {
              id
              title
              details
              completed
              created_at
              updated_at
              user_id
            }
          }
        `,
        variables: {
          id,
          updates,
        },
      });

      if (response.body.errors) {
        throw new Error(
          response.body.errors[0]?.message || "Failed to update todo",
        );
      }

      if (!response.body?.data?.update_todos_by_pk) {
        throw new Error("Failed to update todo");
      }

      const updatedTodo = response.body?.data?.update_todos_by_pk;
      if (updatedTodo) {
        setTodos(todos.map((todo) => (todo.id === id ? updatedTodo : todo)));
      }
      setEditingTodo(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update todo");
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update todo");
    } finally {
      setUpdatingTodos(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const deleteTodo = async (id: string) => {
    Alert.alert(
      "Delete Todo",
      "Are you sure you want to delete this todo?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setUpdatingTodos(prev => new Set([...prev, id]));
              // Execute GraphQL mutation to delete a todo by primary key
              // Hasura permissions ensure users can only delete their own todos
              const response = await nhost.graphql.request({
                query: `
                  mutation DeleteTodo($id: uuid!) {
                    delete_todos_by_pk(id: $id) {
                      id
                    }
                  }
                `,
                variables: {
                  id,
                },
              });

              if (response.body.errors) {
                throw new Error(
                  response.body.errors[0]?.message || "Failed to delete todo",
                );
              }

              setTodos(todos.filter((todo) => todo.id !== id));
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to delete todo");
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete todo");
            } finally {
              setUpdatingTodos(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
              });
            }
          },
        },
      ]
    );
  };

  const toggleComplete = async (todo: Todo) => {
    await updateTodo(todo.id, { completed: !todo.completed });
  };

  const saveEdit = async () => {
    if (!editingTodo) return;
    await updateTodo(editingTodo.id, {
      title: editingTodo.title,
      details: editingTodo.details,
    });
  };

  const toggleTodoExpansion = (todoId: string) => {
    const newExpanded = new Set(expandedTodos);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
    } else {
      newExpanded.add(todoId);
    }
    setExpandedTodos(newExpanded);
  };

  // Fetch todos when user session is available
  // The session contains the JWT token needed for GraphQL authentication
  useEffect(() => {
    if (session) {
      fetchTodos();
    }
  }, [session, fetchTodos]);

  if (!session) {
    return null; // Will redirect to sign in
  }

  const renderTodoItem = ({ item: todo }: { item: Todo }) => {
    const isUpdating = updatingTodos.has(todo.id);
    const isExpanded = expandedTodos.has(todo.id);

    return (
      <View style={[commonStyles.todoCard, todo.completed && commonStyles.todoCompleted]}>
        {editingTodo?.id === todo.id ? (
          <View style={commonStyles.todoEditForm}>
            <Text style={commonStyles.inputLabel}>Title</Text>
            <TextInput
              style={commonStyles.input}
              value={editingTodo.title}
              onChangeText={(text) =>
                setEditingTodo({
                  ...editingTodo,
                  title: text,
                })
              }
              placeholder="Enter todo title"
            />
            <Text style={commonStyles.inputLabel}>Details</Text>
            <TextInput
              style={[commonStyles.input, commonStyles.textArea]}
              value={editingTodo.details || ""}
              onChangeText={(text) =>
                setEditingTodo({
                  ...editingTodo,
                  details: text,
                })
              }
              placeholder="Enter details (optional)"
              multiline
              numberOfLines={3}
            />
            <View style={commonStyles.buttonGroup}>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.primaryButton]}
                onPress={saveEdit}
                disabled={isUpdating}
              >
                <Text style={commonStyles.buttonText}>
                  {isUpdating ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.secondaryButton]}
                onPress={() => setEditingTodo(null)}
              >
                <Text style={[commonStyles.buttonText, commonStyles.secondaryButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View>
            <View style={commonStyles.todoHeader}>
              <TouchableOpacity
                style={commonStyles.todoTitleContainer}
                onPress={() => toggleTodoExpansion(todo.id)}
              >
                <Text
                  style={[
                    commonStyles.todoTitle,
                    todo.completed && commonStyles.todoTitleCompleted,
                  ]}
                >
                  {todo.title}
                </Text>
              </TouchableOpacity>
              <View style={commonStyles.todoActions}>
                <TouchableOpacity
                  style={[commonStyles.actionButton, commonStyles.completeButton]}
                  onPress={() => toggleComplete(todo)}
                  disabled={isUpdating}
                >
                  <Text style={commonStyles.actionButtonText}>
                    {isUpdating ? "⌛" : todo.completed ? "↶" : "✓"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[commonStyles.actionButton, commonStyles.editButton]}
                  onPress={() => setEditingTodo(todo)}
                >
                  <Text style={commonStyles.actionButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[commonStyles.actionButton, commonStyles.deleteButton]}
                  onPress={() => deleteTodo(todo.id)}
                  disabled={isUpdating}
                >
                  <Text style={commonStyles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
            {isExpanded && (
              <View style={commonStyles.todoDetails}>
                {todo.details && (
                  <Text
                    style={[
                      commonStyles.todoDescription,
                      todo.completed && commonStyles.todoDescriptionCompleted,
                    ]}
                  >
                    {todo.details}
                  </Text>
                )}
                <View style={commonStyles.todoMeta}>
                  <Text style={commonStyles.metaText}>
                    Created: {new Date(todo.created_at).toLocaleString()}
                  </Text>
                  <Text style={commonStyles.metaText}>
                    Updated: {new Date(todo.updated_at).toLocaleString()}
                  </Text>
                  {todo.completed && (
                    <View style={commonStyles.completionBadge}>
                      <Text style={commonStyles.completionText}>✅ Completed</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHeader = () => (
    <>
      <View style={commonStyles.pageHeader}>
        <Text style={commonStyles.pageTitle}>My Todos</Text>
        {!showAddForm && (
          <TouchableOpacity
            style={commonStyles.addButton}
            onPress={() => setShowAddForm(true)}
          >
            <Text style={commonStyles.addButtonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={[commonStyles.errorContainer, { marginHorizontal: 16 }]}>
          <Text style={commonStyles.errorText}>Error: {error}</Text>
        </View>
      )}

      {showAddForm && (
        <View style={[commonStyles.card, { marginHorizontal: 16 }]}>
          <Text style={commonStyles.cardTitle}>Add New Todo</Text>
          <View style={commonStyles.formFields}>
            <View style={commonStyles.fieldGroup}>
              <Text style={commonStyles.inputLabel}>Title *</Text>
              <TextInput
                style={commonStyles.input}
                value={newTodoTitle}
                onChangeText={setNewTodoTitle}
                placeholder="What needs to be done?"
              />
            </View>
            <View style={commonStyles.fieldGroup}>
              <Text style={commonStyles.inputLabel}>Details</Text>
              <TextInput
                style={[commonStyles.input, commonStyles.textArea]}
                value={newTodoDetails}
                onChangeText={setNewTodoDetails}
                placeholder="Add some details (optional)..."
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={commonStyles.buttonGroup}>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.primaryButton]}
                onPress={addTodo}
                disabled={addingTodo || !newTodoTitle.trim()}
              >
                <Text style={commonStyles.buttonText}>
                  {addingTodo ? "Adding..." : "Add Todo"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[commonStyles.button, commonStyles.secondaryButton]}
                onPress={() => {
                  setShowAddForm(false);
                  setNewTodoTitle("");
                  setNewTodoDetails("");
                }}
              >
                <Text style={[commonStyles.buttonText, commonStyles.secondaryButtonText]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );

  const renderEmptyState = () => (
    <View style={commonStyles.emptyState}>
      <Text style={commonStyles.emptyStateTitle}>No todos yet</Text>
      <Text style={commonStyles.emptyStateText}>
        Create your first todo to get started!
      </Text>
    </View>
  );

  if (loading) {
    return (
      <ProtectedScreen>
        <Stack.Screen options={{ title: "My Todos" }} />
        <View style={commonStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={commonStyles.loadingText}>Loading todos...</Text>
        </View>
      </ProtectedScreen>
    );
  }

  return (
    <ProtectedScreen>
      <Stack.Screen options={{ title: "My Todos" }} />
      <View style={commonStyles.container}>
        <FlatList
          data={showAddForm ? [] : todos}
          renderItem={renderTodoItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={!showAddForm ? renderEmptyState : null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={commonStyles.listContainer}
        />
      </View>
    </ProtectedScreen>
  );
}
