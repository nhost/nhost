<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400" tile>
      <v-card-title>Secret Notes</v-card-title>
      <v-col>
        <v-row class="px-4 mb-2 align-center">
          <v-text-field v-model="content" label="Note" class="mt-4 mr-2" />
          <v-btn size="large" @click="addNote">Add</v-btn>
        </v-row>
        <v-list density="compact" v-if="result">
          <v-list-subheader>Notes</v-list-subheader>
          <v-list-item v-for="(note, i) in result.notes" :key="i" :value="note.id">
            <div className="d-flex align-center justify-space-between">
              <v-list-item-title v-text="note.content"></v-list-item-title>
              <v-btn variant="flat" prepend-icon="mdi-delete" @click="deleteNote(note.id)" />
            </div>
          </v-list-item>
        </v-list>
      </v-col>
    </v-card>
  </div>
  <error-snack-bar :error="insertNoteError" />
  <error-snack-bar :error="deleteNoteError" />
  <error-snack-bar v-model="showElevatePermissionError"
    >Could not elevate permission</error-snack-bar
  >
</template>

<script lang="ts" setup>
import { computed, ref, unref } from 'vue'

import { gql } from '@apollo/client/core'
import { useAuthenticated, useElevateSecurityKeyEmail, useUserEmail, useUserId } from '@nhost/vue'
import { useQuery, useMutation } from '@vue/apollo-composable'

const content = ref('')
const userId = useUserId()
const userEmail = useUserEmail()
const isAuthenticated = useAuthenticated()
const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
const showElevatePermissionError = ref(false)

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

const SECURITY_KEYS_LIST = gql`
  query securityKeys($userId: uuid!) {
    authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
      id
      nickname
    }
  }
`

const { result } = useQuery(
  GET_NOTES,
  null,
  computed(() => ({
    enabled: isAuthenticated.value
  }))
)

const { result: securityKeys } = useQuery(SECURITY_KEYS_LIST, { userId })

const { mutate: insertNoteMutation, error: insertNoteError } = useMutation(INSERT_NOTE)
const { mutate: deleteNoteMutation, error: deleteNoteError } = useMutation(DELETE_NOTE)

const checkElevatedPermission = async () => {
  let elevatedValue = unref(elevated)

  if (!elevatedValue && securityKeys.value.authUserSecurityKeys.length > 0) {
    const { elevated } = await elevateEmailSecurityKey(userEmail.value as string)

    if (!elevated) {
      throw new Error('Permissions were not elevated')
    }
  }
}

const addNote = async () => {
  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  await insertNoteMutation({ content: content.value }, { refetchQueries: ['notesList'] })

  content.value = ''
}

const deleteNote = async (noteId: string) => {
  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  await deleteNoteMutation({ noteId: noteId }, { refetchQueries: ['notesList'] })

  content.value = ''
}
</script>
