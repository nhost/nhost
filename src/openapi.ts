import expressJSDocSwagger from 'express-jsdoc-swagger';
import j2s, { SwaggerSchema } from 'joi-to-swagger';
import * as requests from './validation/requests';
import * as responses from './validation/openapi-responses';
import { Application } from 'express';

const schema: Record<string, unknown> & { components: SwaggerSchema } = {
  tags: [],
  components: { schemas: {} },
};
Object.values({ ...requests, ...responses }).forEach((validator) => {
  const { components } = j2s(validator, {});
  schema.components.schemas = {
    ...schema.components.schemas,
    ...components?.schemas,
  };
});

export const addOpenApiRoute = (app: Application) =>
  expressJSDocSwagger(app)(
    {
      info: {
        version: process.env.npm_package_version || 'unknown',
        title: 'Hasura auth',
        license: {
          name: 'MIT',
        },
        description: 'Authentication for Hasura',
      },
      security: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
      baseDir: __dirname,
      filesPattern: './routes/**/*.{js,ts}',
      swaggerUIPath: '/api-docs',
      exposeSwaggerUI: true,
      exposeApiDocs: true,
      apiDocsPath: '/openapi.json',
      notRequiredAsNullable: false,
      swaggerUiOptions: {
        swaggerOptions: {
          // This one removes the modals spec
          // You can checkout more config info here: https://github.com/swagger-api/swagger-ui/blob/master/docs/usage/configuration.md
          defaultModelsExpandDepth: -1,
        },
      },
    },
    schema
  );
