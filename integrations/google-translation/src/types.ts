import type { CORSOptions, YogaInitialContext } from '@graphql-yoga/node'

export type Logger = (...args: any[]) => void

export type GoogleTranslationGraphQLContext = {
  /**
   * User language code provided by the getUserLanguage function
   */
  userLanguage: string | null
}

export type Context = YogaInitialContext & GoogleTranslationGraphQLContext

/**
 * A function that returns a boolean indicating if the user is allowed to translate
 * @param context The GraphQL Yoga context
 */
export type GetUserLanguage = (
  context: YogaInitialContext,
  logger?: Logger
) => string | null | Promise<string | null>

/**
 * @param context The GraphQL context
 */
export type CanTranslate = (context: Context, logger?: Logger) => boolean | Promise<boolean>

export type CreateServerProps = {
  /**
   * The Google Cloud Platform project ID
   */
  projectId?: string
  /**
   * The Google Cloud Platform API key
   */
  apiKey?: string
  /**
   * GraphQL Yoga CORS configuration
   * @see {@link https://www.the-guild.dev/graphql/yoga-server/docs/features/cors}
   */
  cors?: CORSOptions
  /**
   * Whether to enable the GraphiQL interface
   */
  graphiql?: boolean
  /**
   * Default language to use for translations
   */
  defaultLanguage?: string
  /**
   * Function to get the user language
   */
  getUserLanguage?: GetUserLanguage
  /**
   * Function to check if the user is allowed to translate
   */
  canTranslate?: CanTranslate
  /**
   * Logger function
   */
  logger?: Logger
  /**
   * Whether to enable GraphQL Yoga error masking
   * @see {@link https://the-guild.dev/graphql/yoga-server/docs/features/error-masking#disabling-error-masking}
   * @default true
   */
  maskedErrors?: boolean
}
