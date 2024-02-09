<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400" tile>
      <v-card-title>Secret Notes</v-card-title>
      <v-card-text class="d-flex align-center justify-space-between">
        <span>Elevated permissions: {{ elevated }}</span>
        <v-btn variant="text" color="primary" @click="elevatePermission(user?.email)">
          Elevate
        </v-btn>
      </v-card-text>
      <v-col>
        <v-row class="px-4 mb-2 align-center">
          <v-text-field v-model="content" label="Note" class="mt-4 mr-2" />
          <v-btn size="large" @click="insertNote({ content }, { refetchQueries: ['notesList'] })"
            >Add</v-btn
          >
        </v-row>
        <v-list density="compact" v-if="result">
          <v-list-subheader>Notes</v-list-subheader>
          <v-list-item v-for="(note, i) in result.notes" :key="i" :value="note.id">
            <div className="d-flex align-center justify-space-between">
              <v-list-item-title v-text="note.content"></v-list-item-title>
              <v-btn
                variant="flat"
                prepend-icon="mdi-delete"
                @click="deleteNote({ noteId: note.id }, { refetchQueries: ['notesList'] })"
              />
            </div>
          </v-list-item>
        </v-list>
      </v-col>
    </v-card>
  </div>
  <error-snack-bar :error="insertNoteError" />
  <error-snack-bar :error="deleteNoteError" />
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'

import { gql } from '@apollo/client/core'
import { useAuthenticated, useElevateSecurityKeyEmail, useUserData } from '@nhost/vue'
import { useQuery, useMutation } from '@vue/apollo-composable'

const content = ref('')

const user = useUserData()

const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

const elevatePermission = async (email: string | undefined) => {
  if (email) {
    await elevateEmailSecurityKey(email)
  }
}

const GET_NOTES = gql`
  query notesList {
    notes {
      id
      content
    }
  }
`

const INSERT_NOTE = gql`
  mutation insertNote($content: String!) {
    insertNote(object: { content: $content }) {
      id
      content
    }
  }
`

const DELETE_NOTE = gql`
  mutation deleteNote($noteId: uuid!) {
    deleteNote(id: $noteId) {
      id
      content
    }
  }
`

const isAuthenticated = useAuthenticated()
// TODO check if the query always runs with the headers
const { result } = useQuery(
  GET_NOTES,
  null,
  computed(() => ({
    enabled: isAuthenticated.value
  }))
)

const { mutate: insertNote, error: insertNoteError } = useMutation(INSERT_NOTE)
const { mutate: deleteNote, error: deleteNoteError } = useMutation(DELETE_NOTE)
</script>
