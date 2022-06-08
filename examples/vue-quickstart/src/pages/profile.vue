<script setup lang="ts">
import { gql } from '@apollo/client/core'
import { useNhostClient, useUserId } from '@nhost/vue'
import { useMutation, useSubscription } from '@vue/apollo-composable'
import { computed, ref } from 'vue'

const { nhost } = useNhostClient()
const GET_USER_SUBSCRIPTION = gql`
  subscription GetUser($id: uuid!) {
    user(id: $id) {
      id
      email
      displayName
      metadata
      avatarUrl
    }
  }
`
const id = useUserId()

const { result } = useSubscription(
  GET_USER_SUBSCRIPTION,
  computed(() => ({ id: id.value }))
)
const user = computed(() => result.value?.user)

const UPDATE_USER_MUTATION = gql`
  mutation ($id: uuid!, $displayName: String!, $metadata: jsonb) {
    updateUser(pk_columns: { id: $id }, _set: { displayName: $displayName, metadata: $metadata }) {
      id
      displayName
      metadata
    }
  }
`
const firstName = ref('')
const lastName = ref('')
const { mutate, loading, error } = useMutation(UPDATE_USER_MUTATION)

const updateUserProfile = async (event: Event) => {
  event.preventDefault()
  if (user.value) {
    await mutate({
      id: user.value.id,
      displayName: `${firstName.value} ${lastName.value}`.trim(),
      metadata: {
        firstName: firstName.value,
        lastName: lastName.value
      }
    })
    await nhost.auth.refreshSession()
  }
}
</script>

<template>
  <div>
    <div i-carbon-home text-4xl inline-block />
    <p>Profile page</p>
    <p>
      <em text-sm op75>Quickstart</em>
    </p>
    <div v-if="user" py-4>
      <p>Hello, {{ user.displayName }}. Your email is {{ user.email }}.</p>
      <form @submit="updateUserProfile">
        <input v-model="firstName" placeholder="First name" class="input" /><br />
        <input v-model="lastName" placeholder="Last name" class="input" /><br />
        <button class="btn-submit" :disabled="loading">Save</button>
        <div v-if="error">
          {{ error.message }}
        </div>
      </form>
    </div>
  </div>
</template>
