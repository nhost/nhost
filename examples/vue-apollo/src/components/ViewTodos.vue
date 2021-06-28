/* eslint-disable vue/require-v-for-key */
<template>
  <ul>
    <li v-for="(todo, index) in todos.data.todos" :key="index">
      {{ todo.name }}
    </li>
  </ul>
</template>

<script>
import { useSubscription } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { reactive } from "vue-demi";

export default {
  setup() {
    const todos = reactive({
      data: [],
    });

    const GET_TODOS = gql`
      subscription {
        todos {
          id
          created_at
          name
          is_completed
        }
      }
    `;

    // In the vue-apollo composition api, the useSubscription, useQuery, and
    // some other hooks are only accessible in setup()
    let { onResult } = useSubscription(GET_TODOS);

    onResult((result) => {
      todos.data = result.data;
    });

    return {
      todos,
    };
  },
};
</script>
