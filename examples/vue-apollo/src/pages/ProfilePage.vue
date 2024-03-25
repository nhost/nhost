<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400" class="mb-2">
      <v-card-title>Profile page</v-card-title>
      <v-card-text> {{ userEmail }} </v-card-text>
    </v-card>

    <v-card width="400">
      <v-card-text>
        <v-btn
          class="my-1"
          block
          variant="text"
          prepend-icon="mdi-github"
          color="white"
          style="background-color: #333"
          :href="github"
          v-if="!isGithubConnected"
        >
          Connect with GitHub
        </v-btn>

        <span v-if="isGithubConnected">
          <v-icon>mdi-github</v-icon>
          Github connected {{ isGithubConnected }}
        </span>
      </v-card-text>
    </v-card>

    <v-card width="400" class="mt-2 pa-4">
      <v-card-title>Add Security Key</v-card-title>

      <form @submit="handleAddSecurityKey">
        <v-text-field v-model="nickname" label="NickName" />
        <v-btn
          block
          color="primary"
          class="my-1"
          type="submit"
          :disabled="isChangeEmailLoading"
          :loading="isChangeEmailLoading"
        >
          Add
        </v-btn>
      </form>

      <v-list density="compact">
        <v-list-subheader>Security Keys</v-list-subheader>
        <v-list-item v-for="(key, i) in securityKeysList" :key="i" :value="key.id">
          <div className="d-flex align-center justify-space-between">
            <v-list-item-title>{{ key.id }}</v-list-item-title>
            <v-btn
              variant="flat"
              prepend-icon="mdi-delete"
              @click="handleRemoveSecurityKey(key.id)"
            />
          </div>
        </v-list-item>
      </v-list>
    </v-card>

    <v-card width="400" class="mt-2 pa-4">
      <v-card-title>Change Email</v-card-title>

      <form @submit="handleChangeEmail">
        <v-text-field v-model="email" label="Email" />
        <v-btn
          block
          color="primary"
          class="my-1"
          type="submit"
          :disabled="isChangeEmailLoading"
          :loading="isChangeEmailLoading"
        >
          Change email
        </v-btn>
      </form>
    </v-card>

    <v-card width="400" class="mt-2 pa-4">
      <v-card-title>Change Password</v-card-title>

      <form @submit="handleChangePassword">
        <v-text-field v-model="password" label="Password" type="password" />
        <v-btn
          block
          color="primary"
          class="my-1"
          type="submit"
          :disabled="isChangePasswordLoading"
          :loading="isChangePasswordLoading"
        >
          Change password
        </v-btn>
      </form>
    </v-card>
  </div>

  <error-snack-bar :error="elevateError" />
  <error-snack-bar :error="changeEmailError" />
  <v-snackbar :modelValue="successSnackBar">OK</v-snackbar>

  <error-snack-bar v-model="showElevatePermissionError"
    >Could not elevate permission</error-snack-bar
  >

  <error-snack-bar v-model="showRemoveKeyError"></error-snack-bar>

  <error-snack-bar v-model="showConnectProviderError" title="Bad request"
    ><span class="text-white"></span
  ></error-snack-bar>

  <v-snackbar v-model="showConnectProviderError" vertical>
    <div class="pb-2 text-subtitle-1">Bad request</div>

    <p>Social user already exists</p>
  </v-snackbar>

  <v-snackbar v-model="showRemoveKeyError">
    Could not remove key
    <template #actions>
      <v-btn color="blue" variant="text" @click="showRemoveKeyError = false"> Close </v-btn>
    </template>
  </v-snackbar>

  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />
</template>

<script lang="ts" setup>
import { gql } from '@apollo/client/core'

import {
  useChangeEmail,
  useChangePassword,
  useElevateSecurityKeyEmail,
  useAddSecurityKey,
  useUserEmail,
  useUserId,
  useProviderLink
} from '@nhost/vue'

import { useMutation, useQuery } from '@vue/apollo-composable'
import { ref, unref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const nickname = ref('')
const successSnackBar = ref(false)
const showConnectProviderError = ref(false)

const router = useRouter()
const route = useRoute()

onMounted(() => {
  const errorDescription = route.query.errorDescription

  if (errorDescription === 'social user already exists') {
    showConnectProviderError.value = true
    router.replace({ query: undefined })
  }
})

const userId = useUserId()
const userEmail = useUserEmail()
const emailVerificationDialog = ref(false)
const showElevatePermissionError = ref(false)
const showRemoveKeyError = ref(false)
const addSecurityKeyError = ref(false)
const elevateError = ref(null)
const changeEmailError = ref(null)
const { changeEmail, isLoading: isChangeEmailLoading } = useChangeEmail()
const { changePassword, isLoading: isChangePasswordLoading } = useChangePassword()
const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()
const { add } = useAddSecurityKey()
const { github } = useProviderLink({
  connect: true,
  redirectTo: `${window.location.origin}/profile`
})

const AUTH_USER_PROVIDERS = gql`
  query getAuthUserProviders {
    authUserProviders {
      id
      providerId
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

const REMOVE_SECURITY_KEY = gql`
  mutation removeSecurityKey($id: uuid!) {
    deleteAuthUserSecurityKey(id: $id) {
      id
    }
  }
`

const { result: authUserProvidersQueryResult } = useQuery(AUTH_USER_PROVIDERS)

const isGithubConnected = computed(() =>
  authUserProvidersQueryResult.value?.authUserProviders.some(
    (item: any) => item.providerId === 'github'
  )
)

const { result: securityKeys, refetch } = useQuery(SECURITY_KEYS_LIST, { userId }, {})
const { mutate: removeKey } = useMutation(REMOVE_SECURITY_KEY)

const securityKeysList = computed(() => securityKeys.value?.authUserSecurityKeys || [])

const checkElevatedPermission = async () => {
  let elevatedValue = unref(elevated)

  if (!elevatedValue && securityKeys.value.authUserSecurityKeys.length > 0) {
    const { elevated } = await elevateEmailSecurityKey(userEmail.value as string)

    if (!elevated) {
      throw new Error('Permissions were not elevated')
    }
  }
}

const handleChangeEmail = async (e: Event) => {
  e.preventDefault()

  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  const { needsEmailVerification } = await changeEmail(email)

  if (needsEmailVerification) {
    emailVerificationDialog.value = true
  } else {
    successSnackBar.value = true
  }
}

const handleChangePassword = async (e: Event) => {
  e.preventDefault()

  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  const { error: changePasswordError } = await changePassword(password)

  if (!changePasswordError) {
    successSnackBar.value = true
  }
}

const handleAddSecurityKey = async (e: Event) => {
  e.preventDefault()

  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  const { isError } = await add(nickname.value)

  if (isError) {
    addSecurityKeyError.value = true
  } else {
    nickname.value = ''
    refetch()
  }
}

const handleRemoveSecurityKey = async (id: string) => {
  try {
    await checkElevatedPermission()
  } catch (error) {
    showElevatePermissionError.value = true
  }

  try {
    await removeKey({ id })
    await refetch()
  } catch (error) {
    showRemoveKeyError.value = true
  }
}
</script>
