import expressJSDocSwagger from 'express-jsdoc-swagger';
import pkg from '../package.json';
import j2s, { SwaggerSchema } from 'joi-to-swagger';
import * as validators from './validation';
import { Application } from 'express';

const schema: Record<string, any> & { components: SwaggerSchema } = {
  tags: [],
  components: { schemas: {} },
};
Object.values(validators).forEach((validator) => {
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
        version: pkg.version,
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
      filesPattern: './routes/**/*.ts',
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
