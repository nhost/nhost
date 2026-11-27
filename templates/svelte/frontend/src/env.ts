import { defineEnvVars } from '@sveltejs/kit/env';

// Each may be unset. The defaults live where the values are read:
// src/lib/nhost/env.server.ts and src/routes/auth/oauth/providers.ts.
const optional = (value: string | undefined): string => value ?? '';

export const variables = defineEnvVars({
  NHOST_SUBDOMAIN: {
    schema: optional,
    description: 'The Nhost project subdomain. Unset targets the local stack.',
  },
  NHOST_REGION: {
    schema: optional,
    description: 'The Nhost project region. Unset targets the local stack.',
  },
  APP_ORIGIN: {
    schema: optional,
    description:
      'Where this app is deployed, for links in auth emails and redirects.',
  },
  VERCEL_PROJECT_PRODUCTION_URL: {
    schema: optional,
    description: "Set by Vercel: the project's production domain.",
  },
  NHOST_OAUTH_PROVIDERS: {
    public: true,
    schema: optional,
    description:
      'OAuth providers turned on in nhost/nhost.toml, comma-separated: github, google.',
  },
});
