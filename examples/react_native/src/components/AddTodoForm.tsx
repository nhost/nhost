import {gql, useMutation} from '@apollo/client';
import {useForm} from 'react-hook-form';
import {StyleSheet, View} from 'react-native';
import Button from '@components/Button';
import ControlledInput from '@components/ControlledInput';
import {TODO_LIST} from '@screens/Todos';

interface AddTodoFormValues {
  contents: string;
}

export default function AddTodoForm() {
  const {control, handleSubmit, reset} = useForm<AddTodoFormValues>();

  const [addTodo, {loading}] = useMutation(
    gql`
      mutation AddItem($contents: String!) {
        insertTodo(object: {contents: $contents}) {
          id
          contents
        }
      }
    `,
    {
      refetchQueries: [{query: TODO_LIST}],
    },
  );

  const onSubmit = async (values: AddTodoFormValues) => {
    const {contents} = values;
    await addTodo({variables: {contents}});
    reset();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputWrapper}>
        <ControlledInput
          control={control}
          name="contents"
          placeholder="New To-Do"
          autoCapitalize="none"
          rules={{
            required: true,
          }}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <Button
          label="Add"
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
          loading={loading}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
    padding: 12,
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  inputWrapper: {
    flex: 3,
  },
  buttonWrapper: {
    flex: 1,
  },
});
