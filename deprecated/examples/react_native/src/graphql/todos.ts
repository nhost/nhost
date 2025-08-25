import {gql} from '@apollo/client';

export const GET_TODOS = gql`
  query TodoList {
    todos(order_by: {createdAt: desc}) {
      id
      contents
    }
  }
`;

export const ADD_TODO = gql`
  mutation AddItem($contents: String!) {
    insertTodo(object: {contents: $contents}) {
      id
      contents
    }
  }
`;

export const DELETE_TODO = gql`
  mutation deleteTodo($id: uuid!) {
    deleteTodo(id: $id) {
      __typename
    }
  }
`;
