import {StyleSheet, Text, View} from 'react-native';
import Button from './Button';
import {gql, useMutation} from '@apollo/client';
import {TODO_LIST} from '../screens/Todos';

export interface ITodo {
  id: string;
  contents: string;
}

export default function Todo({todo: {id, contents}}: {todo: ITodo}) {
  const [deleteTodo] = useMutation(
    gql`
      mutation deleteTodo($id: uuid!) {
        deleteTodo(id: $id) {
          __typename
        }
      }
    `,
    {
      variables: {id},
      refetchQueries: [{query: TODO_LIST}],
    },
  );

  const handleDeleteTodo = async () => {
    await deleteTodo();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={{flex: 1}}>✔️ {contents}</Text>
      <View style={{width: 50}}>
        <Button label="🗑️" color="#f1f1f1" onPress={handleDeleteTodo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
