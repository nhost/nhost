<template>
  <div className="d-flex align-center flex-column">
    <v-card width="400">
      <v-card-title>Profile page</v-card-title>
      <v-card-text> {{ userEmail }} </v-card-text>
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
  <verification-email-dialog v-model="emailVerificationDialog" :email="email" />
</template>

<script lang="ts" setup>
import { gql } from '@apollo/client/core'
import {
  useChangeEmail,
  useChangePassword,
  useElevateSecurityKeyEmail,
  useUserEmail,
  useUserId
} from '@nhost/vue'
import { useQuery } from '@vue/apollo-composable'
import { ref, unref } from 'vue'

const email = ref('')
const password = ref('')

const successSnackBar = ref(false)

const userId = useUserId()
const userEmail = useUserEmail()
const emailVerificationDialog = ref(false)
const showElevatePermissionError = ref(false)
const elevateError = ref(null)
const changeEmailError = ref(null)
const { changeEmail, isLoading: isChangeEmailLoading } = useChangeEmail()
const { changePassword, isLoading: isChangePasswordLoading } = useChangePassword()

const { elevated, elevateEmailSecurityKey } = useElevateSecurityKeyEmail()

const SECURITY_KEYS_LIST = gql`
  query securityKeys($userId: uuid!) {
    authUserSecurityKeys(where: { userId: { _eq: $userId } }) {
      id
      nickname
    }
  }
`

const { result: securityKeys } = useQuery(SECURITY_KEYS_LIST, { userId })

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

  const { error: changeEmailError, needsEmailVerification } = await changeEmail(email)

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
</script>
