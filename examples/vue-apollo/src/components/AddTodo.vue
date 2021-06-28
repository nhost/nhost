<template>
  <form @submit="addTodo">
    <label for="name"></label>
    <input type="text" name="name" v-model="name" placeholder="Add Todo" />
    <button type="submit">
      <span class="mdi mdi-plus"></span>
    </button>
  </form>
</template>

<script>
import { useMutation } from "@vue/apollo-composable";
import { gql } from "graphql-tag";
import { ref } from "vue-demi";

export default {
  setup() {
    const name = ref("");

    const INSERT_TODO = gql`
      mutation ($todo: todos_insert_input!) {
        insert_todos(objects: [$todo]) {
          affected_rows
        }
      }
    `;

    // In the vue-apollo composition api, the useMutation, useQuery, and
    // other hooks are only accessible in setup()
    const { mutate } = useMutation(INSERT_TODO);

    const addTodo = function (event) {
      event.preventDefault();
      mutate({
        todo: {
          name: name.value,
        },
      });
      name.value = "";
    };

    return { name, addTodo };
  },

  methods: {
    preventDefault(event) {
      event.preventDefault();
    },
  },
};
</script>
