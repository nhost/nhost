import {gql, useQuery} from '@apollo/client';
import {ActivityIndicator, FlatList, StyleSheet, View} from 'react-native';
import AddTodoForm from '../components/AddTodoForm';
import Todo, {type ITodo} from '../components/Todo';

export const TODO_LIST = gql`
  query TodoList {
    todos(order_by: {createdAt: desc}) {
      id
      contents
    }
  }
`;

export default function Todos() {
  // TODO handle error
  const {loading, data} = useQuery<{todos: ITodo[]}>(TODO_LIST);

  const todos = data?.todos || [];

  if (loading) {
    return (
      <View style={styles.loadingViewWrapper}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <AddTodoForm />
      <FlatList
        data={todos}
        keyExtractor={item => item.id}
        renderItem={({item}) => <Todo todo={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
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
