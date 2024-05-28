import React from 'react';
import {useQuery} from '@apollo/client';
import AddTodoForm from '@components/AddTodoForm';
import Todo, {type TodoItem} from '@components/Todo';
import {GET_TODOS} from '@graphql/todos';
import {useEffect} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';

export default function Todos() {
  const {loading, data, client} = useQuery<{todos: TodoItem[]}>(GET_TODOS);

  const todos = data?.todos || [];

  useEffect(() => {
    return () => client.stop();
  }, [client]);

  if (loading) {
    return (
      <View style={styles.loadingViewWrapper}>
        <ActivityIndicator />
      </View>
    );
  }

  const renderTodo = ({item}: {item: TodoItem}) => <Todo todo={item} />;
  const itemSeperator = () => <View style={styles.separator} />;

  return (
    <View style={styles.wrapper}>
      <AddTodoForm />
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={renderTodo}
        ItemSeparatorComponent={itemSeperator}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingViewWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {
    flex: 1,
    backgroundColor: 'white',
  },
  separator: {
    height: 1,
    backgroundColor: '#f1f1f1',
  },
});
