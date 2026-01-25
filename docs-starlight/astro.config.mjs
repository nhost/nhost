// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightOpenAPI, { createOpenAPISidebarGroup } from 'starlight-openapi';
import starlightSidebarTopics from 'starlight-sidebar-topics';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create sidebar groups for OpenAPI schemas
const authAPISidebarGroup = createOpenAPISidebarGroup();
const storageAPISidebarGroup = createOpenAPISidebarGroup();

// https://astro.build/config
export default defineConfig({
    vite: {
        resolve: {
            alias: {
                '@components': path.resolve(__dirname, './src/components'),
            },
        },
    },
    integrations: [
        starlight({
            title: 'Nhost Documentation',
            logo: {
                light: './src/assets/logo/light.svg',
                dark: './src/assets/logo/dark.svg',
                replacesTitle: true,
            },
            customCss: ['./src/styles/custom.css'],
            social: [
                { icon: 'x.com', label: 'Twitter', href: 'https://twitter.com/nhost' },
                { icon: 'github', label: 'GitHub', href: 'https://github.com/nhost' },
                { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/nhost' },
            ],
            components: {
                Header: './src/components/Header.astro',
                Head: './src/components/Head.astro',
            },
            plugins: [
                // OpenAPI must come first to process sidebar placeholders
                starlightOpenAPI([
                    {
                        base: 'reference/auth',
                        schema: './src/schemas/auth.yaml',
                        sidebar: {
                            label: 'Auth API',
                            collapsed: true,
                            group: authAPISidebarGroup,
                        },
                    },
                    {
                        base: 'reference/storage',
                        schema: './src/schemas/storage.yaml',
                        sidebar: {
                            label: 'Storage API',
                            collapsed: true,
                            group: storageAPISidebarGroup,
                        },
                    },
                ]),
                starlightSidebarTopics(
                    [
                        // Getting Started
                        {
                            id: 'getting-started',
                            label: 'Getting Started',
                            link: '/getting-started/overview/',
                            icon: 'rocket',
                            items: [
                                { label: 'Welcome', slug: 'welcome' },
                                { label: 'Overview', slug: 'getting-started/overview' },
                                {
                                    label: 'Quickstart',
                                    items: [
                                        { slug: 'getting-started/quickstart/react' },
                                        { slug: 'getting-started/quickstart/nextjs' },
                                        { slug: 'getting-started/quickstart/vue' },
                                        { slug: 'getting-started/quickstart/sveltekit' },
                                        { slug: 'getting-started/quickstart/reactnative' },
                                    ],
                                },
                                {
                                    label: 'Tutorial: ToDo App (React)',
                                    collapsed: true,
                                    items: [
                                        { slug: 'getting-started/tutorials/react/1-introduction' },
                                        { slug: 'getting-started/tutorials/react/2-protected-routes' },
                                        { slug: 'getting-started/tutorials/react/3-user-authentication' },
                                        { slug: 'getting-started/tutorials/react/4-graphql-operations' },
                                        { slug: 'getting-started/tutorials/react/5-file-uploads' },
                                    ],
                                },
                                {
                                    label: 'Tutorial: ToDo App (Next.js)',
                                    collapsed: true,
                                    items: [
                                        { slug: 'getting-started/tutorials/nextjs/1-introduction' },
                                        { slug: 'getting-started/tutorials/nextjs/2-protected-routes' },
                                        { slug: 'getting-started/tutorials/nextjs/3-user-authentication' },
                                        { slug: 'getting-started/tutorials/nextjs/4-graphql-operations' },
                                        { slug: 'getting-started/tutorials/nextjs/5-file-uploads' },
                                    ],
                                },
                                {
                                    label: 'Tutorial: ToDo App (Vue)',
                                    collapsed: true,
                                    items: [
                                        { slug: 'getting-started/tutorials/vue/1-introduction' },
                                        { slug: 'getting-started/tutorials/vue/2-protected-routes' },
                                        { slug: 'getting-started/tutorials/vue/3-user-authentication' },
                                        { slug: 'getting-started/tutorials/vue/4-graphql-operations' },
                                        { slug: 'getting-started/tutorials/vue/5-file-uploads' },
                                    ],
                                },
                                {
                                    label: 'Tutorial: ToDo App (Svelte)',
                                    collapsed: true,
                                    items: [
                                        { slug: 'getting-started/tutorials/svelte/1-introduction' },
                                        { slug: 'getting-started/tutorials/svelte/2-protected-routes' },
                                        { slug: 'getting-started/tutorials/svelte/3-user-authentication' },
                                        { slug: 'getting-started/tutorials/svelte/4-graphql-operations' },
                                        { slug: 'getting-started/tutorials/svelte/5-file-uploads' },
                                    ],
                                },
                                {
                                    label: 'Tutorial: ToDo App (React Native)',
                                    collapsed: true,
                                    items: [
                                        { slug: 'getting-started/tutorials/reactnative/1-introduction' },
                                        { slug: 'getting-started/tutorials/reactnative/2-protected-routes' },
                                        { slug: 'getting-started/tutorials/reactnative/3-user-authentication' },
                                        { slug: 'getting-started/tutorials/reactnative/4-graphql-operations' },
                                        { slug: 'getting-started/tutorials/reactnative/5-file-uploads' },
                                        { slug: 'getting-started/tutorials/reactnative/6-sign-in-with-apple' },
                                    ],
                                },
                            ],
                        },
                        // Products
                        {
                            id: 'products',
                            label: 'Products',
                            link: '/products/overview/',
                            icon: 'puzzle',
                            items: [
                                { label: 'Overview', slug: 'products/overview' },
                                {
                                    label: 'Auth',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/auth/overview' },
                                        { slug: 'products/auth/users' },
                                        { slug: 'products/auth/client_and_redirect_urls' },
                                        { slug: 'products/auth/jwt' },
                                        { slug: 'products/auth/email-templates' },
                                        { slug: 'products/auth/gravatar' },
                                        {
                                            label: 'Sign In Methods',
                                            collapsed: true,
                                            items: [
                                                {
                                                    label: 'Providers',
                                                    collapsed: true,
                                                    items: [
                                                        { slug: 'products/auth/providers/overview' },
                                                        { slug: 'products/auth/providers/sign-in-provider' },
                                                        { slug: 'products/auth/providers/tokens' },
                                                        { slug: 'products/auth/providers/connect' },
                                                        { slug: 'products/auth/providers/idtokens' },
                                                        {
                                                            label: 'Configuration',
                                                            collapsed: true,
                                                            items: [
                                                                { slug: 'products/auth/providers/sign-in-apple' },
                                                                { slug: 'products/auth/providers/sign-in-azuread' },
                                                                { slug: 'products/auth/providers/sign-in-bitbucket' },
                                                                { slug: 'products/auth/providers/sign-in-discord' },
                                                                { slug: 'products/auth/providers/sign-in-entraid' },
                                                                { slug: 'products/auth/providers/sign-in-facebook' },
                                                                { slug: 'products/auth/providers/sign-in-github' },
                                                                { slug: 'products/auth/providers/sign-in-gitlab' },
                                                                { slug: 'products/auth/providers/sign-in-google' },
                                                                { slug: 'products/auth/providers/sign-in-linkedin' },
                                                                { slug: 'products/auth/providers/sign-in-spotify' },
                                                                { slug: 'products/auth/providers/sign-in-strava' },
                                                                { slug: 'products/auth/providers/sign-in-twitch' },
                                                                { slug: 'products/auth/providers/sign-in-windowslive' },
                                                                { slug: 'products/auth/providers/sign-in-workos' },
                                                            ],
                                                        },
                                                    ],
                                                },
                                                { slug: 'products/auth/sign-in-email-password' },
                                                { slug: 'products/auth/sign-in-otp' },
                                                { slug: 'products/auth/sign-in-magic-link' },
                                                { slug: 'products/auth/sign-in-sms-otp' },
                                                { slug: 'products/auth/webauthn' },
                                            ],
                                        },
                                        {
                                            label: 'Workflows',
                                            collapsed: true,
                                            items: [
                                                { slug: 'products/auth/workflows/email-password' },
                                                { slug: 'products/auth/workflows/passwordless-email' },
                                                { slug: 'products/auth/workflows/passwordless-sms' },
                                                { slug: 'products/auth/workflows/webauthn' },
                                                { slug: 'products/auth/workflows/anonymous-users' },
                                                { slug: 'products/auth/workflows/change-email' },
                                                { slug: 'products/auth/workflows/change-password' },
                                                { slug: 'products/auth/workflows/reset-password' },
                                                { slug: 'products/auth/workflows/refresh-token' },
                                            ],
                                        },
                                        {
                                            label: 'Security',
                                            collapsed: true,
                                            items: [
                                                { slug: 'products/auth/elevated-permissions' },
                                                { slug: 'products/auth/bot-protection' },
                                                { slug: 'products/auth/custom-jwts' },
                                                { slug: 'products/auth/restricting_emails_and_domains' },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    label: 'Database',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/database/overview' },
                                        { slug: 'products/database/configuring-postgres' },
                                        { slug: 'products/database/backups' },
                                        { slug: 'products/database/access' },
                                        { slug: 'products/database/extensions' },
                                        { slug: 'products/database/performance' },
                                        { slug: 'products/database/upgrade-major' },
                                    ],
                                },
                                {
                                    label: 'Functions',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/functions/overview' },
                                        { slug: 'products/functions/getting-started' },
                                        { slug: 'products/functions/runtimes' },
                                        { slug: 'products/functions/logging' },
                                    ],
                                },
                                {
                                    label: 'GraphQL',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/graphql/overview' },
                                        { slug: 'products/graphql/configuring-hasura' },
                                        { slug: 'products/graphql/permissions' },
                                        { slug: 'products/graphql/advanced-features' },
                                        {
                                            label: 'Guides',
                                            collapsed: true,
                                            items: [
                                                { slug: 'products/graphql/guides/react-apollo' },
                                                { slug: 'products/graphql/guides/react-query' },
                                                { slug: 'products/graphql/guides/react-urql' },
                                                { slug: 'products/graphql/guides/codegen-nhost' },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    label: 'Storage',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/storage/overview' },
                                        { slug: 'products/storage/cdn' },
                                        { slug: 'products/storage/antivirus' },
                                    ],
                                },
                                {
                                    label: 'AI',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/ai/overview' },
                                        { slug: 'products/ai/enabling-service' },
                                        { slug: 'products/ai/local-development' },
                                        { slug: 'products/ai/auto-embeddings' },
                                        { slug: 'products/ai/assistants' },
                                        { slug: 'products/ai/dev-assistant' },
                                    ],
                                },
                                {
                                    label: 'Run',
                                    collapsed: true,
                                    items: [
                                        { slug: 'products/run/overview' },
                                        { slug: 'products/run/getting-started' },
                                        { slug: 'products/run/configuration' },
                                        { slug: 'products/run/networking' },
                                        { slug: 'products/run/health-checks' },
                                        { slug: 'products/run/resources' },
                                        { slug: 'products/run/registry' },
                                        { slug: 'products/run/local-development' },
                                        { slug: 'products/run/configuration-overlays' },
                                        { slug: 'products/run/cli-deployments' },
                                    ],
                                },
                            ],
                        },
                        // Platform
                        {
                            id: 'platform',
                            label: 'Platform',
                            link: '/platform/overview/',
                            icon: 'laptop',
                            items: [
                                { label: 'Overview', slug: 'platform/overview' },
                                {
                                    label: 'Cloud',
                                    collapsed: false,
                                    items: [
                                        { slug: 'platform/cloud/overview' },
                                        { slug: 'platform/cloud/subdomain' },
                                        { slug: 'platform/cloud/compute-resources' },
                                        { slug: 'platform/cloud/service-replicas' },
                                        { slug: 'platform/cloud/metrics' },
                                        { slug: 'platform/cloud/logs' },
                                        { slug: 'platform/cloud/environment-variables' },
                                        { slug: 'platform/cloud/secrets' },
                                        { slug: 'platform/cloud/git' },
                                        { slug: 'platform/cloud/custom-domains' },
                                        { slug: 'platform/cloud/rate-limits' },
                                        { slug: 'platform/cloud/tls' },
                                        { slug: 'platform/cloud/billing' },
                                    ],
                                },
                                {
                                    label: 'Development',
                                    collapsed: true,
                                    items: [
                                        { slug: 'platform/cli/overview' },
                                        { slug: 'platform/cli/local-development' },
                                        { slug: 'platform/cli/cloud-development' },
                                        { slug: 'platform/cli/subdomain' },
                                        { slug: 'platform/cli/migrate-config' },
                                        { slug: 'platform/cli/multiple-projects' },
                                        { slug: 'platform/cli/configuration-overlays' },
                                        { slug: 'platform/cli/seeds' },
                                        {
                                            label: 'MCP Server',
                                            collapsed: true,
                                            items: [
                                                { slug: 'platform/cli/mcp/overview' },
                                                { slug: 'platform/cli/mcp/configuration' },
                                                { slug: 'platform/cli/mcp/clients' },
                                                { slug: 'platform/cli/mcp/troubleshooting' },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    label: 'Self-Hosting',
                                    collapsed: true,
                                    items: [
                                        { slug: 'platform/self-hosting/overview' },
                                        { slug: 'platform/self-hosting/community' },
                                        { slug: 'platform/self-hosting/support' },
                                        { slug: 'platform/self-hosting/dedicated' },
                                    ],
                                },
                            ],
                        },
                        // Reference
                        {
                            id: 'reference',
                            label: 'Reference',
                            link: '/reference/overview/',
                            icon: 'open-book',
                            items: [
                                { label: 'Overview', slug: 'reference/overview' },
                                authAPISidebarGroup,
                                storageAPISidebarGroup,
                                {
                                    label: 'AI GraphQL',
                                    collapsed: true,
                                    items: [
                                        { slug: 'reference/graphql/ai/overview' },
                                        {
                                            label: 'Query',
                                            collapsed: true,
                                            items: [
                                                { slug: 'reference/graphql/ai/query/assistant' },
                                                { slug: 'reference/graphql/ai/query/assistants' },
                                                { slug: 'reference/graphql/ai/query/session' },
                                                { slug: 'reference/graphql/ai/query/session-messages' },
                                                { slug: 'reference/graphql/ai/query/sessions' },
                                            ],
                                        },
                                        {
                                            label: 'Mutation',
                                            collapsed: true,
                                            items: [
                                                { slug: 'reference/graphql/ai/mutation/insert-assistant' },
                                                { slug: 'reference/graphql/ai/mutation/update-assistant' },
                                                { slug: 'reference/graphql/ai/mutation/delete-assistant' },
                                                { slug: 'reference/graphql/ai/mutation/start-session' },
                                                { slug: 'reference/graphql/ai/mutation/delete-session' },
                                                { slug: 'reference/graphql/ai/mutation/send-message' },
                                                { slug: 'reference/graphql/ai/mutation/start-dev-session' },
                                                { slug: 'reference/graphql/ai/mutation/send-dev-message' },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    label: 'Client Libraries',
                                    collapsed: true,
                                    items: [
                                        {
                                            label: 'JavaScript',
                                            collapsed: true,
                                            items: [
                                                {
                                                    label: 'nhost-js',
                                                    collapsed: true,
                                                    items: [
                                                        { slug: 'reference/javascript/nhost-js/main' },
                                                        { slug: 'reference/javascript/nhost-js/auth' },
                                                        { slug: 'reference/javascript/nhost-js/functions' },
                                                        { slug: 'reference/javascript/nhost-js/graphql' },
                                                        { slug: 'reference/javascript/nhost-js/storage' },
                                                        { slug: 'reference/javascript/nhost-js/session' },
                                                        { slug: 'reference/javascript/nhost-js/fetch' },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    label: 'CLI',
                                    items: [{ label: 'Commands', slug: 'reference/cli/commands' }],
                                },
                                {
                                    label: 'Deprecated Libraries',
                                    collapsed: true,
                                    autogenerate: { directory: 'reference/deprecated' },
                                },
                            ],
                        },
                    ],
                    {
                        // Associate pages with topics
                        topics: {
                            reference: [
                                '/reference/auth',
                                '/reference/auth/**/*',
                                '/reference/storage',
                                '/reference/storage/**/*',
                            ],
                        },
                    },
                ),
            ],
        }),
    ],
});
