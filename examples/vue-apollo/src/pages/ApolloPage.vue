<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400" tile>
      <v-card-text> Apollo </v-card-text>
      <v-list density="compact" v-if="result">
        <v-list-subheader>Books</v-list-subheader>
        <v-list-item v-for="(item, i) in result.books" :key="i" :value="item.id">
          <v-list-item-title v-text="item.title"></v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'

import { gql } from '@apollo/client/core/index.js'
import { useAuthenticated } from '@nhost/vue'
import { useQuery } from '@vue/apollo-composable'

const GET_BOOKS = gql`
  query BooksQuery {
    books {
      id
      title
    }
  }
`

export default defineComponent({
  setup() {
    const isAuthenticated = useAuthenticated()
    // TODO check if the query always runs with the headers
    const { result } = useQuery(
      GET_BOOKS,
      null,
      computed(() => ({
        pollInterval: 5000,
        fetchPolicy: 'cache-and-network',
        enabled: isAuthenticated.value
      }))
    )
    return { result }
  }
})
</script>
