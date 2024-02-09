import { v2 } from '@google-cloud/translate'
import { createServer, YogaInitialContext } from '@graphql-yoga/node'
import SchemaBuilder from '@pothos/core'

import { defaultCanTranslate, defaultGetUserLanguage } from './defaults'
import { Context, CreateServerProps } from './types'

/**
 * Create a GraphQL Yoga server with the Google Translation API
 * @returns GraphQL Yoga http server
 */
export const createGoogleTranslationGraphQLServer = ({
  projectId = process.env.GOOGLE_TRANSLATION_PROJECT_ID,
  apiKey = process.env.GOOGLE_TRANSLATION_API_KEY,
  graphiql = true,
  cors,
  defaultLanguage = 'en',
  getUserLanguage = defaultGetUserLanguage,
  canTranslate = defaultCanTranslate,
  logger = console.log,
  maskedErrors = true,
}: CreateServerProps = {}) => {
  const translator = new v2.Translate({ projectId, key: apiKey })

  const builder = new SchemaBuilder<{ Context: Context }>({})

  builder.queryType({
    fields: (t) => ({
      googleTranslation: t.string({
        nullable: true,
        args: {
          text: t.arg.string({ required: true }),
          from: t.arg.string(),
          to: t.arg.string()
        },
        resolve: async (_, args, context) => {
          // * Return null if the user is not allowed to translate
          if (!canTranslate(context)) {
            logger('Not allowed')
            return null
          }
          const text = args.text
          const from = args.from || undefined
          const to = args.to || context.userLanguage || defaultLanguage
          try {
            const [translation] = await translator.translate(text, { from, to })
            return translation
          } catch (e) {
            // * Return null and log the error if the translation fails
            const { message } = e as Error
            logger(`Impossible to translate "${text}" from ${from} to ${to}: ${message}`)
            return null
          }
        }
      })
    })
  })

  return createServer({
    cors,
    graphiql,
    context: async (context: YogaInitialContext): Promise<Context> => ({
      ...context,
      userLanguage: await getUserLanguage(context)
    }),
    schema: builder.toSchema(),
    maskedErrors,
  })
}
