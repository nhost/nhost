import React from 'react';
import {useMutation} from '@apollo/client';
import {DELETE_TODO, GET_TODOS} from '@graphql/todos';
import {StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Button from './Button';

export interface TodoItem {
  id: string;
  contents: string;
}

export default function Todo({todo: {id, contents}}: {todo: TodoItem}) {
  const [deleteTodo] = useMutation(DELETE_TODO, {
    variables: {id},
    refetchQueries: [{query: GET_TODOS}],
  });

  const handleDeleteTodo = async () => {
    await deleteTodo();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.todoContentWrapper}>
        <Icon name="check" size={25} />
        <Text style={styles.todoContent}>{contents}</Text>
      </View>
      <View style={styles.buttonWrapper}>
        <Button
          label={<Icon name="trash-can-outline" size={20} />}
          color="#f1f1f1"
          onPress={handleDeleteTodo}
        />
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
  todoContentWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  todoContent: {flex: 1},
  buttonWrapper: {
    width: 50,
  },
});
