import { APPLICATION } from '@config/index'
import axios from 'axios'
import logger from './logger'

/**
 * https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/relationship.html
 * Here we are using the schema-metadata-api to track the relationships between auth tables
 **/

interface Table {
  name: string
  schema: string
  foreignKey?: string
  custom_name?: string
  custom_root_fields?: {
    select?: string
    select_by_pk?: string
    select_aggregate?: string
    insert?: string
    insert_one?: string
    update?: string
    update_by_pk?: string
    delete?: string
    delete_by_pk?: string
  }
  custom_column_names?: {
    [key: string]: string
  }
}

interface Relationship {
  name: string
  source: Table
  destination?: Table
  isArray?: boolean
}

async function trackTable(table: Table) {
  logger.info(`Tracking table ${table.name}`)
  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'track_table',
        version: 2,
        args: {
          table: {
            name: table.name,
            schema: table.schema
          }
        }
      },
      {
        headers: {
          'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        }
      }
    )
  } catch (error) {
    if (error.response.data.code !== 'already-tracked') {
      logger.error(error)
      throw new Error('Error tracking table')
    }
  }
}

async function setTableCustomization(table: Table) {
  logger.info(`Set table customization for ${table.name}`)

  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'set_table_customization',
        args: {
          table: {
            name: table.name,
            schema: table.schema
          },
          configuration: {
            custom_name: table.custom_name,
            custom_root_fields: table.custom_root_fields,
            custom_column_names: table.custom_column_names
          }
        }
      },
      {
        headers: {
          'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        }
      }
    )
  } catch (error) {
    logger.error(error)
    throw new Error('error setting customization for table')
  }
}

function trackRelationship(relationship: Relationship) {
  const sourceTable = relationship.source
  const destinationTable = relationship.destination

  const rules = destinationTable
    ? relationship.isArray
      ? {
          foreign_key_constraint_on: {
            table: { name: destinationTable.name, schema: destinationTable.schema },
            column: destinationTable.foreignKey
          }
        }
      : {
          manual_configuration: {
            column_mapping: { id: destinationTable.foreignKey },
            remote_table: {
              name: destinationTable.name,
              schema: destinationTable.schema
            }
          }
        }
    : { foreign_key_constraint_on: sourceTable.foreignKey }

  return axios.post(
    APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
    {
      type: relationship.isArray ? 'create_array_relationship' : 'create_object_relationship',
      args: {
        table: {
          name: sourceTable.name,
          schema: sourceTable.schema
        },
        name: relationship.name,
        using: rules
      }
    },
    {
      headers: {
        'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
      }
    }
  )
}

export async function applyMetadata(): Promise<void> {
  logger.info('Applying metadata')

  // track tables
  try {
    await trackTable({ schema: 'auth', name: 'users' })
    await trackTable({ schema: 'auth', name: 'user_roles' })
    await trackTable({ schema: 'auth', name: 'user_providers' })
    await trackTable({ schema: 'auth', name: 'providers' })
    await trackTable({ schema: 'auth', name: 'refresh_tokens' })
    await trackTable({ schema: 'auth', name: 'roles' })
    await trackTable({ schema: 'auth', name: 'email_templates' })
    await trackTable({ schema: 'auth', name: 'provider_requests' })
    await trackTable({ schema: 'auth', name: 'migrations' })
    await trackTable({ schema: 'auth', name: 'whitelist' })
  } catch (error) {
    console.log({ error })
    console.log(error.response.data)
    throw new Error('Failed tracking tables')
  }

  // set custom root fields + custom column names
  await setTableCustomization({
    schema: 'auth',
    name: 'users',
    custom_name: 'authUser',
    custom_root_fields: {
      select: 'authUsers',
      select_by_pk: 'authUser',
      select_aggregate: 'authUserAggregate',
      insert: 'insertAuthUsers',
      insert_one: 'insertAuthUser',
      update: 'updateAuthUsers',
      update_by_pk: 'updateAuthUser',
      delete: 'deleteAuthUsers',
      delete_by_pk: 'deleteAuthUser'
    },
    custom_column_names: {
      id: 'id',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      display_name: 'displayName',
      avatar_url: 'avatarURL',
      active: 'active',
      email: 'email',
      new_email: 'newEmail',
      password_hash: 'passwordHash',
      default_role: 'defaultRole',
      is_anonymous: 'isAnonymous',
      custom_register_data: 'customRegisterData',
      otp_secret: 'OTPSecret',
      mfa_enabled: 'MFAEnabled',
      ticket: 'ticket',
      ticket_expires_at: 'ticketExpiresAt',
      locale: 'locale'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'user_roles',
    custom_name: 'authUserRoles',
    custom_root_fields: {
      select: 'authUserRoles',
      select_by_pk: 'authUserRole',
      select_aggregate: 'authUserRolesAggregate',
      insert: 'insertAuthUserRoles',
      insert_one: 'insertAuthUserRole',
      update: 'updateAuthUserRoles',
      update_by_pk: 'updateAuthUserRole',
      delete: 'deleteAuthUserRoles',
      delete_by_pk: 'deleteAuthUserRole'
    },
    custom_column_names: {
      id: 'id',
      created_at: 'createdAt',
      user_id: 'userId',
      role: 'role'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'user_providers',
    custom_name: 'authUserProviders',
    custom_root_fields: {
      select: 'authUserProviders',
      select_by_pk: 'authUserProvider',
      select_aggregate: 'authUserProvidersAggregate',
      insert: 'insertAuthUserProviders',
      insert_one: 'insertAuthUserProvider',
      update: 'updateAuthUserProviders',
      update_by_pk: 'updateAuthUserProvider',
      delete: 'deleteAuthUserProviders',
      delete_by_pk: 'deleteAuthUserProvider'
    },
    custom_column_names: {
      id: 'id',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      user_id: 'userId',
      user_provider_code: 'userProviderCode',
      user_provider_unique_id: 'userProviderUniqueId'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'providers',
    custom_name: 'authUroviders',
    custom_root_fields: {
      select: 'authProviders',
      select_by_pk: 'authProvider',
      select_aggregate: 'authProvidersAggregate',
      insert: 'insertAuthProviders',
      insert_one: 'insertAuthProvider',
      update: 'updateAuthProviders',
      update_by_pk: 'updateAuthProvider',
      delete: 'deleteAuthProviders',
      delete_by_pk: 'deleteAuthProvider'
    },
    custom_column_names: {
      code: 'code',
      name: 'name'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'refresh_tokens',
    custom_name: 'authRefreshTokens',
    custom_root_fields: {
      select: 'authRefreshTokens',
      select_by_pk: 'authRefreshToken',
      select_aggregate: 'authRefreshTokensAggregate',
      insert: 'insertAuthRefreshTokens',
      insert_one: 'insertAuthRefreshToken',
      update: 'updateAuthRefreshTokens',
      update_by_pk: 'updateAuthRefreshToken',
      delete: 'deleteAuthRefreshTokens',
      delete_by_pk: 'deleteAuthRefreshToken'
    },
    custom_column_names: {
      refresh_token: 'refreshToken',
      created_at: 'createdAt',
      expires_at: 'expiresAt',
      user_id: 'userId'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'roles',
    custom_name: 'authRoles',
    custom_root_fields: {
      select: 'AuthRoles',
      select_by_pk: 'AuthRole',
      select_aggregate: 'AuthRolesAggregate',
      insert: 'insertAuthRoles',
      insert_one: 'insertAuthRole',
      update: 'updateAuthRoles',
      update_by_pk: 'updateAuthRole',
      delete: 'deleteAuthRoles',
      delete_by_pk: 'deleteAuthRole'
    },
    custom_column_names: {
      role: 'role'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'email_templates',
    custom_name: 'authEmailTemplates',
    custom_root_fields: {
      select: 'AuthEmailTemplates',
      select_by_pk: 'AuthEmailTemplate',
      select_aggregate: 'AuthEmailTemplatesAggregate',
      insert: 'insertAuthEmailTemplates',
      insert_one: 'insertAuthEmailTemplate',
      update: 'updateAuthEmailTemplates',
      update_by_pk: 'updateAuthEmailTemplate',
      delete: 'deleteAuthEmailTemplates',
      delete_by_pk: 'deleteAuthEmailTemplate'
    },
    custom_column_names: {
      id: 'id',
      title: 'title',
      html: 'HTML',
      no_html: 'noHTML',
      locale: 'locale'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'provider_requests',
    custom_name: 'authProviderRequests',
    custom_root_fields: {
      select: 'AuthProviderRequests',
      select_by_pk: 'AuthProviderRequest',
      select_aggregate: 'AuthProviderRequestsAggregate',
      insert: 'insertAuthProviderRequests',
      insert_one: 'insertAuthProviderRequest',
      update: 'updateAuthProviderRequests',
      update_by_pk: 'updateAuthProviderRequest',
      delete: 'deleteAuthProviderRequests',
      delete_by_pk: 'deleteAuthProviderRequest'
    },
    custom_column_names: {
      id: 'id',
      redirect_url_success: 'redirectURLSuccess',
      redirect_url_failure: 'redirectURLFailure',
      jwt_token: 'JWTToken'
    }
  })
  await setTableCustomization({
    schema: 'auth',
    name: 'whitelist',
    custom_name: 'authWhitelist',
    custom_root_fields: {
      select: 'AuthWhitelists',
      select_by_pk: 'AuthWhitelist',
      select_aggregate: 'AuthWhitelistsAggregate',
      insert: 'insertAuthWhitelists',
      insert_one: 'insertAuthWhitelist',
      update: 'updateAuthWhitelists',
      update_by_pk: 'updateAuthWhitelist',
      delete: 'deleteAuthWhitelists',
      delete_by_pk: 'deleteAuthWhitelist'
    },
    custom_column_names: {
      email: 'email'
    }
  })

  await Promise.allSettled([
    trackRelationship({
      source: { name: 'user_providers', schema: 'auth', foreignKey: 'user_id' },
      name: 'user'
    }),
    trackRelationship({
      source: { name: 'user_providers', schema: 'auth', foreignKey: 'auth_provider_code' },
      name: 'provider'
    }),
    trackRelationship({
      source: { name: 'user_roles', schema: 'auth', foreignKey: 'user_id' },
      name: 'user'
    }),
    trackRelationship({
      source: { name: 'user_roles', schema: 'auth', foreignKey: 'role' },
      name: 'roleByRole'
    }),
    trackRelationship({
      source: { name: 'users', schema: 'auth', foreignKey: 'default_role' },
      name: 'defaultRoleByRole'
    }),
    trackRelationship({
      source: { name: 'refresh_tokens', schema: 'auth', foreignKey: 'user_id' },
      name: 'user'
    })
  ])

  // await Promise.allSettled([
  //   trackRelationship({
  //     source: { name: 'accounts', schema: 'auth' },
  //     destination: { name: 'account_providers', schema: 'auth', foreignKey: 'account_id' },
  //     name: 'account_providers',
  //     isArray: true
  //   }),
  //   trackRelationship({
  //     source: { name: 'accounts', schema: 'auth' },
  //     destination: { name: 'account_roles', schema: 'auth', foreignKey: 'account_id' },
  //     name: 'account_roles',
  //     isArray: true
  //   }),
  //   trackRelationship({
  //     source: { name: 'accounts', schema: 'auth' },
  //     destination: { name: 'refresh_tokens', schema: 'auth', foreignKey: 'account_id' },
  //     name: 'refresh_tokens',
  //     isArray: true
  //   }),
  //   trackRelationship({
  //     source: { name: 'providers', schema: 'auth' },
  //     destination: { name: 'account_providers', schema: 'auth', foreignKey: 'auth_provider' },
  //     name: 'account_providers',
  //     isArray: true
  //   }),
  //   trackRelationship({
  //     source: { name: 'roles', schema: 'auth' },
  //     destination: { name: 'account_roles', schema: 'auth', foreignKey: 'role' },
  //     name: 'account_roles',
  //     isArray: true
  //   }),
  //   trackRelationship({
  //     source: { name: 'roles', schema: 'auth' },
  //     destination: { name: 'accounts', schema: 'auth', foreignKey: 'default_role' },
  //     name: 'accounts',
  //     isArray: true
  //   })
  // ])

  // try to add relation from `public.profiles` to `auth.users`
  // the `public.profile` table is optional.
  // Which is why we allow this to fail silently.
  try {
    await Promise.allSettled([
      trackRelationship({
        source: { name: 'users', schema: 'auth' },
        destination: { name: 'profiles', schema: 'profiles', foreignKey: 'user_id' },
        name: 'profile'
      }),
      trackRelationship({
        source: { name: 'profile', schema: 'public', foreignKey: 'user_id' },
        name: 'user'
      })
    ])
  } catch (error) {
    logger.debug('Unable to add relationship between public.profiles and auth.users')
    logger.debug(error)
  }

  logger.info('Finished applying metadata')
}
