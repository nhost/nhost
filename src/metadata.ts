import { APPLICATION } from '@config/index'
import axios from 'axios'
import logger from './logger'

/**
 * https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/relationship.html
 * Here we are using the schema-metadata-api to track the relationships between auth tables
 **/

interface TableName {
  name: string
  schema: string
}

interface TableArgs {
  table: TableName
  configuration?: {
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
}

interface RelationshipArgs {
  table: TableName
  name: string
  using: {
    foreign_key_constraint_on:
      | {
          table: TableName
          column: string
        }
      | string
  }
}

// https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/table-view.html#track-table-v2
async function trackTable(args: TableArgs) {
  logger.info(`Tracking table ${args.table.name}`)
  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'track_table',
        version: 2,
        args: args
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
      throw new Error(`Error tracking table ${args.table.name}`)
    } else {
      logger.debug(`Table ${args.table.name} already tracked`)
    }
  }
}

async function setTableCustomization(args: TableArgs) {
  logger.info(`Set table customization for ${args.table.name}`)

  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'set_table_customization',
        args: args
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

async function createObjectRelationship(args: RelationshipArgs) {
  logger.info(`create object relationship ${args.name} for ${args.table.name}`)
  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'create_object_relationship',
        args
      },
      {
        headers: {
          'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        }
      }
    )
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      logger.error(error)
      throw new Error(`Error creating object relationship for table ${args.table.name}`)
    } else {
      logger.debug(`Object relationship ${args.name} on table ${args.table.name} is already created`)
    }
  }
}

async function createArrayRelationship(args: RelationshipArgs) {
  logger.info(`create array relationship ${args.name} for ${args.table.name}`)
  try {
    await axios.post(
      APPLICATION.HASURA_ENDPOINT.replace('/v1/graphql', '/v1/query'),
      {
        type: 'create_array_relationship',
        args
      },
      {
        headers: {
          'x-hasura-admin-secret': APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET
        }
      }
    )
  } catch (error) {
    if (error.response.data.code !== 'already-exists') {
      logger.error(error)
      throw new Error(`Error creating array relationship for table ${args.table.name}`)
    } else {
      logger.debug(`Array relationship ${args.name} on table ${args.table.name} is already created`)
    }
  }
}

export async function applyMetadata(): Promise<void> {
  logger.info('Applying metadata')

  // track tables
  await trackTable({ table: { schema: 'auth', name: 'users' } })
  await trackTable({ table: { schema: 'auth', name: 'user_roles' } })
  await trackTable({ table: { schema: 'auth', name: 'user_providers' } })
  await trackTable({ table: { schema: 'auth', name: 'providers' } })
  await trackTable({ table: { schema: 'auth', name: 'refresh_tokens' } })
  await trackTable({ table: { schema: 'auth', name: 'roles' } })
  await trackTable({ table: { schema: 'auth', name: 'email_templates' } })
  await trackTable({ table: { schema: 'auth', name: 'provider_requests' } })
  await trackTable({ table: { schema: 'auth', name: 'migrations' } })
  await trackTable({ table: { schema: 'auth', name: 'whitelist' } })

  // set custom root fields + custom column names
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'users'
    },
    configuration: {
      custom_name: 'users',
      custom_root_fields: {
        select: 'users',
        select_by_pk: 'user',
        select_aggregate: 'UserAggregate',
        insert: 'insertUsers',
        insert_one: 'insertUser',
        update: 'updateUsers',
        update_by_pk: 'updateUser',
        delete: 'deleteUsers',
        delete_by_pk: 'deleteUser'
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'user_roles'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'user_providers'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'providers'
    },
    configuration: {
      custom_name: 'authProviders',
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'refresh_tokens'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'roles'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'email_templates'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'provider_requests'
    },
    configuration: {
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
    }
  })
  await setTableCustomization({
    table: {
      schema: 'auth',
      name: 'whitelist'
    },
    configuration: {
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
    }
  })

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_providers'
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id'
    }
  })
  await createArrayRelationship({
    table: {
      schema: 'auth',
      name: 'users'
    },
    name: 'userProviders',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_providers'
        },
        column: 'user_id'
      }
    }
  })

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_providers'
    },
    name: 'provider',
    using: {
      foreign_key_constraint_on: 'user_provider_code'
    }
  })
  await createArrayRelationship({
    table: {
      schema: 'auth',
      name: 'providers'
    },
    name: 'userProviders',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_providers'
        },
        column: 'user_provider_code'
      }
    }
  })

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_roles'
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id'
    }
  })
  await createArrayRelationship({
    table: {
      schema: 'auth',
      name: 'users'
    },
    name: 'roles',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'user_roles'
        },
        column: 'user_id'
      }
    }
  })

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'user_roles'
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id'
    }
  })

  await createObjectRelationship({
    table: {
      schema: 'auth',
      name: 'refresh_tokens'
    },
    name: 'user',
    using: {
      foreign_key_constraint_on: 'user_id'
    }
  })
  await createArrayRelationship({
    table: {
      schema: 'auth',
      name: 'users'
    },
    name: 'refreshTokens',
    using: {
      foreign_key_constraint_on: {
        table: {
          schema: 'auth',
          name: 'refresh_tokens'
        },
        column: 'user_id'
      }
    }
  })

  // try to add relation from `public.profiles` to `auth.users`
  // the `public.profile` table is optional.
  // Which is why we allow this to fail silently.
  try {
    await createObjectRelationship({
      table: {
        schema: 'public',
        name: 'profiles'
      },
      name: 'user',
      using: {
        foreign_key_constraint_on: 'user_id'
      }
    })

    await createObjectRelationship({
      table: {
        schema: 'auth',
        name: 'users'
      },
      name: 'profile',
      using: {
        foreign_key_constraint_on: {
          table: {
            schema: 'public',
            name: 'profiles'
          },
          column: 'user_id'
        }
      }
    })
  } catch (error) {
    logger.debug('Unable to add relationship between public.profiles and auth.users')
  }

  logger.info('Finished applying metadata')
}
