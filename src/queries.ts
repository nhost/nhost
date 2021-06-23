import { JWT } from '@config/index'
import gql from 'graphql-tag'

const accountFragment = gql`
  fragment accountFragment on auth_accounts {
    id
    active
    default_role
    account_roles {
      role
    }
    user {
      id
      display_name
      avatar_url
      ${JWT.CUSTOM_FIELDS.join('\n\t\t\t')}
    }
    is_anonymous
    ticket
    email
    new_email
    otp_secret
    mfa_enabled
    password_hash
    last_confirmation_email_sent_at
    locale
  }
`

export const insertAccount = gql`
  mutation($account: auth_accounts_insert_input!) {
    insert_auth_accounts(objects: [$account]) {
      affected_rows
      returning {
        ...accountFragment
      }
    }
  }
  ${accountFragment}
`

export const insertAccountProviderToUser = gql`
  mutation($account_provider: auth_account_providers_insert_input!, $account_id: uuid!) {
    insert_auth_account_providers_one(object: $account_provider) {
      account {
        ...accountFragment
      }
    }
    update_auth_accounts(_set: { active: true }, where: { id: { _eq: $account_id } }) {
      affected_rows
    }
  }
  ${accountFragment}
`

export const setNewTicket = gql`
  mutation($ticket: uuid!, $ticket_expires_at: timestamptz!, $user_id: uuid!) {
    update_auth_accounts(
      _set: { ticket: $ticket, ticket_expires_at: $ticket_expires_at }
      where: { user: { id: { _eq: $user_id } } }
    ) {
      affected_rows
    }
  }
`

export const updatePasswordWithTicket = gql`
  mutation($now: timestamptz!, $ticket: uuid!, $password_hash: String!, $new_ticket: uuid!) {
    update_auth_accounts(
      where: { _and: [{ ticket: { _eq: $ticket } }, { ticket_expires_at: { _gt: $now } }] }
      _set: { password_hash: $password_hash, ticket: $new_ticket, ticket_expires_at: $now }
    ) {
      affected_rows
      returning {
        id,
        user_id
      }
    }
  }
`

export const updatePasswordWithUserId = gql`
  mutation($user_id: uuid!, $password_hash: String!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { password_hash: $password_hash }
    ) {
      affected_rows
    }
  }
`

export const selectAccountByUserId = gql`
  query($user_id: uuid!) {
    auth_accounts(where: { user: { id: { _eq: $user_id } } }) {
      ...accountFragment
    }
  }
  ${accountFragment}
`

export const selectAccountByEmail = gql`
  query($email: citext!) {
    auth_accounts(where: { email: { _eq: $email } }) {
      ...accountFragment
    }
  }
  ${accountFragment}
`

export const selectAccountByTicket = gql`
  query($ticket: uuid!, $now: timestamptz!) {
    auth_accounts(where: { _and: [{ ticket: { _eq: $ticket } }, { ticket_expires_at: { _gt: $now } }] }) {
      ...accountFragment
    }
  }
  ${accountFragment}
`

export const insertRefreshToken = gql`
  mutation($refresh_token_data: auth_refresh_tokens_insert_input!) {
    insert_auth_refresh_tokens_one(object: $refresh_token_data) {
      account {
        ...accountFragment
      }
    }
  }
  ${accountFragment}
`

// WHERE
//   refresh_token = $refresh_token
//   AND (
//     account.active = ture
//     OR (
//       account.active =  false
//       AND account.is_anonymous
//     )
//   )
// The reason is, we don't want users to select a refresh token if their account
// is not active. Except if the user anonymous. Then we can allow it.
// A user can be anonymous but with active = false when the user conver their
// anonymous account to a real account but have not yet activated their account
// aka verified their email.
export const selectRefreshToken = gql`
query ($refresh_token: uuid!, $current_timestamp: timestamptz!) {
  auth_refresh_tokens(
    where: {
      _and: [
        { refresh_token: { _eq: $refresh_token } },
        {
          _or: [
            { account: { active: { _eq: true }}}, {
              _and: [
                { account: { active: { _eq: false }}},
                { account: { is_anonymous: { _eq: true }}}
              ]
            }
          ]
        },
        { expires_at: { _gte: $current_timestamp }}
      ]
    }) {
    account {
        ...accountFragment
    }
  }
}
  ${accountFragment}
`

export const accountOfRefreshToken = gql`
  query($refresh_token: uuid!) {
    auth_refresh_tokens(
      where: {
        _and: [
          { refresh_token: { _eq: $refresh_token } }
        ]
      }
    ) {
      account {
        ...accountFragment
      }
    }
  }
  ${accountFragment}
`

export const updateRefreshToken = gql`
  mutation($old_refresh_token: uuid!, $new_refresh_token_data: auth_refresh_tokens_insert_input!) {
    delete_auth_refresh_tokens(where: { refresh_token: { _eq: $old_refresh_token } }) {
      affected_rows
    }
    insert_auth_refresh_tokens(objects: [$new_refresh_token_data]) {
      affected_rows
    }
  }
`

export const deleteAllAccountRefreshTokens = gql`
  mutation($user_id: uuid!) {
    delete_auth_refresh_tokens(where: { account: { user: { id: { _eq: $user_id } } } }) {
      affected_rows
    }
  }
`

export const deleteRefreshToken = gql`
  mutation($refresh_token: uuid!) {
    delete_auth_refresh_tokens(where: { refresh_token: { _eq: $refresh_token } }) {
      affected_rows
    }
  }
`

export const activateAccount = gql`
  mutation($ticket: uuid!, $new_ticket: uuid!, $now: timestamptz!) {
    update_auth_accounts(
      where: {
        _and: { active: { _eq: false }, ticket: { _eq: $ticket }, ticket_expires_at: { _gt: $now } }
      }
      _set: { active: true, ticket: $new_ticket, ticket_expires_at: $now }
    ) {
      affected_rows
      returning {
        id
        user_id
      }
    }
  }
`

export const updateOtpSecret = gql`
  mutation($user_id: uuid!, $otp_secret: String!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { otp_secret: $otp_secret }
    ) {
      affected_rows
    }
  }
`

export const deleteOtpSecret = gql`
  mutation($user_id: uuid!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { otp_secret: null, mfa_enabled: false }
    ) {
      affected_rows
    }
  }
`

export const updateOtpStatus = gql`
  mutation($user_id: uuid!, $mfa_enabled: Boolean!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { mfa_enabled: $mfa_enabled }
    ) {
      affected_rows
    }
  }
`

export const rotateTicket = gql`
  mutation($ticket: uuid!, $new_ticket: uuid!, $now: timestamptz!) {
    update_auth_accounts(
      where: { _and: { ticket: { _eq: $ticket }, ticket_expires_at: { _gt: $now } } }
      _set: { ticket: $new_ticket, ticket_expires_at: $now }
    ) {
      affected_rows
    }
  }
`

export const deleteAccountByUserId = gql`
  mutation($user_id: uuid) {
    delete_auth_accounts(where: { user: { id: { _eq: $user_id } } }) {
      affected_rows
    }
  }
`

export const changeEmailByTicket = gql`
  mutation($now: timestamptz, $ticket: uuid!, $new_email: citext, $new_ticket: uuid!) {
    update_auth_accounts(
      where: { _and: [{ ticket: { _eq: $ticket } }, { ticket_expires_at: { _gt: $now } }] }
      _set: { email: $new_email, new_email: null, ticket: $new_ticket, ticket_expires_at: $now }
    ) {
      affected_rows
      returning {
        id,
        user_id
      }
    }
  }
`

export const changeEmailByUserId = gql`
  mutation($user_id: uuid!, $new_email: citext) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { email: $new_email, new_email: null }
    ) {
      affected_rows
    }
  }
`

export const changePasswordHashByUserId = gql`
  mutation($user_id: uuid!, $new_password_hash: String!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { password_hash: $new_password_hash }
    ) {
      affected_rows
    }
  }
`

export const deanonymizeAccount = gql`
  mutation($account_id: uuid!, $account: auth_accounts_set_input!, $user_id: uuid!, $user: users_set_input!, $roles: [auth_account_roles_insert_input!]!) {
    update_auth_accounts(
      where: { id: { _eq: $account_id } }
      _set: $account
    ) {
      affected_rows
    }

    update_users(
      where: { id: { _eq: $user_id } }
      _set: $user
    ) {
      affected_rows
    }

    delete_auth_account_roles(where: {account: { id: { _eq: $account_id } } }) {
      returning {
        id
      }
    }

    insert_auth_account_roles(
      objects: $roles
    ) {
      returning {
        id
      }
    }
  }
`

export const setNewEmail = gql`
  mutation($user_id: uuid!, $new_email: citext!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { new_email: $new_email }
    ) {
      returning {
        user {
          display_name
        }
      }
      affected_rows
    }
  }
`

export const selectAccountProvider = gql`
  query($provider: String!, $profile_id: String!) {
    auth_account_providers(
      where: {
        _and: [
          { auth_provider: { _eq: $provider } }
          { auth_provider_unique_id: { _eq: $profile_id } }
        ]
      }
    ) {
      account {
        ...accountFragment
      }
    }
  }
  ${accountFragment}
`

export const isAllowedEmail = gql`
  query($email: String!) {
    auth_whitelist_by_pk(email: $email) {
      email
    }
  }
`

export const updateLastSentConfirmation = gql`
  mutation($user_id: uuid!, $last_confirmation_email_sent_at: timestamptz!) {
    update_auth_accounts(
      where: { user: { id: { _eq: $user_id } } }
      _set: { last_confirmation_email_sent_at: $last_confirmation_email_sent_at }
    ) {
      affected_rows
    }
  }
`

export const insertAllowedEmail = gql`
  mutation($email: String!) {
    insert_auth_whitelist_one(object: { email: $email }) {
      email
    }
  }
`

export const getEmailTemplate = gql`
  query($id: String!, $locale: String!) {
    auth_email_templates_by_pk(id: $id, locale: $locale) {
      title,
      html,
      no_html
    }
  }
`

export const addProviderRequest = gql`
  mutation($state: uuid!, $redirect_url_success: String!, $redirect_url_failure: String!, $jwt_token: String) {
    insert_auth_provider_requests_one(object: { id: $state, redirect_url_success: $redirect_url_success, redirect_url_failure: $redirect_url_failure, jwt_token: $jwt_token } ) {
      id
    }
  }
`

export const getProviderRequest = gql`
  query($state: uuid!) {
    auth_provider_requests_by_pk(id: $state) {
      redirect_url_success,
      redirect_url_failure,
      jwt_token
    }
  }
`

export const deleteProviderRequest = gql`
  mutation($state: uuid!) {
    delete_auth_provider_requests_by_pk(id: $state) {
      id
    }
  }
`

export const deactivateAccount = gql`
  mutation($user_id: uuid!) {
    update_auth_accounts(
      where: {
        _and: { active: { _eq: true }, user: { id: { _eq: $user_id } } }
      }
      _set: { active: false }
    ) {
      affected_rows
      returning {
        id
      }
    }
  }
`

export const changeLocaleByUserId = gql`
  mutation($user_id: uuid!, $locale: String!) {
    update_auth_accounts(_set: { locale: $locale }, where: { user: { id: { _eq: $user_id } } }) {
      affected_rows
    }
  }
`
