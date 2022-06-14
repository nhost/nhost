import { AddItemMutation, TodoListQuery } from 'src/generated'

import { gql, useMutation } from '@apollo/client'
import { Button, Card, Container, Grid, Loader, TextInput, Title } from '@mantine/core'
import { useInputState } from '@mantine/hooks'
import { useAuthQuery } from '@nhost/react-apollo'

const TODO_LIST = gql`
  query TodoList {
    todos {
      id
      contents
    }
  }
`

const ADD_ITEM = gql`
  mutation AddItem($contents: String!) {
    insertTodo(object: { contents: $contents }) {
      id
      contents
    }
  }
`

export const ApolloPage: React.FC = () => {
  const { loading, data } = useAuthQuery<TodoListQuery>(TODO_LIST, {
    pollInterval: 5000,
    fetchPolicy: 'cache-and-network'
  })
  const [contents, setContents] = useInputState('')

  const [mutate] = useMutation<AddItemMutation>(ADD_ITEM, {
    variables: { contents },
    update: (cache, { data }) => {
      cache.modify({
        fields: {
          todos(existingTodos = []) {
            const newTodoRef = cache.writeFragment({
              data: data?.insertTodo,
              fragment: gql`
                fragment NewTodo on todos {
                  id
                  contents
                }
              `
            })
            return [...existingTodos, newTodoRef]
          }
        }
      })
    }
  })

  const add = async () => {
    if (!contents) {
      return
    }
    await mutate()
    setContents('')
  }
  return (
    <Container>
      {loading && <Loader />}
      <Card shadow="sm" p="lg" m="sm">
        <Title>Todo list</Title>
        <Grid>
          <Grid.Col span={9}>
            <TextInput
              value={contents}
              onChange={setContents}
              autoFocus
              onKeyDown={(e) => e.code === 'Enter' && add()}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <Button
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                add()
              }}
            >
              Add
            </Button>
          </Grid.Col>
        </Grid>
        <ul>
          {data?.todos.map((item) => (
            <li key={item.id}>{item.contents}</li>
          ))}
        </ul>
      </Card>
    </Container>
  )
}
