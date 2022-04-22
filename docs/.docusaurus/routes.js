
import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug','0d9'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config','ea1'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content','078'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData','ec8'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata','baa'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry','f79'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes','ed8'),
    exact: true
  },
  {
    path: '/',
    component: ComponentCreator('/','9c6'),
    routes: [
      {
        path: '/',
        component: ComponentCreator('/','134'),
        exact: true
      },
      {
        path: '/get-started',
        component: ComponentCreator('/get-started','ad2'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/authentication',
        component: ComponentCreator('/get-started/authentication','87c'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/cli-workflow',
        component: ComponentCreator('/get-started/cli-workflow','d12'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/cli-workflow/install-cli',
        component: ComponentCreator('/get-started/cli-workflow/install-cli','9d2'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/cli-workflow/local-changes',
        component: ComponentCreator('/get-started/cli-workflow/local-changes','177'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/cli-workflow/metadata-and-serverless-functions',
        component: ComponentCreator('/get-started/cli-workflow/metadata-and-serverless-functions','93b'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/cli-workflow/workflow-setup',
        component: ComponentCreator('/get-started/cli-workflow/workflow-setup','017'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/quick-start',
        component: ComponentCreator('/get-started/quick-start','846'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/quick-start/javascript-client',
        component: ComponentCreator('/get-started/quick-start/javascript-client','d6c'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/quick-start/permissions',
        component: ComponentCreator('/get-started/quick-start/permissions','326'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/quick-start/schema',
        component: ComponentCreator('/get-started/quick-start/schema','8f4'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/get-started/upgrade',
        component: ComponentCreator('/get-started/upgrade','6d7'),
        exact: true,
        sidebar: "defaultSidebar"
      },
      {
        path: '/platform',
        component: ComponentCreator('/platform','0ac'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication',
        component: ComponentCreator('/platform/authentication','0b7'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/email-templates',
        component: ComponentCreator('/platform/authentication/email-templates','ad3'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-methods',
        component: ComponentCreator('/platform/authentication/sign-in-methods','6af'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-with-facebook',
        component: ComponentCreator('/platform/authentication/sign-in-with-facebook','a73'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-with-github',
        component: ComponentCreator('/platform/authentication/sign-in-with-github','f37'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-with-google',
        component: ComponentCreator('/platform/authentication/sign-in-with-google','771'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-with-linkedin',
        component: ComponentCreator('/platform/authentication/sign-in-with-linkedin','095'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/sign-in-with-spotify',
        component: ComponentCreator('/platform/authentication/sign-in-with-spotify','de5'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/social-sign-in',
        component: ComponentCreator('/platform/authentication/social-sign-in','fb3'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/authentication/user-management',
        component: ComponentCreator('/platform/authentication/user-management','0fc'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/database',
        component: ComponentCreator('/platform/database','c1d'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/graphql',
        component: ComponentCreator('/platform/graphql','3c5'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/graphql/permissions',
        component: ComponentCreator('/platform/graphql/permissions','176'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/nhost',
        component: ComponentCreator('/platform/nhost','6fc'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/nhost/environment-variables',
        component: ComponentCreator('/platform/nhost/environment-variables','64d'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/nhost/github-integration',
        component: ComponentCreator('/platform/nhost/github-integration','c09'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/nhost/local-development',
        component: ComponentCreator('/platform/nhost/local-development','8e9'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/serverless-functions',
        component: ComponentCreator('/platform/serverless-functions','70d'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/serverless-functions/event-triggers',
        component: ComponentCreator('/platform/serverless-functions/event-triggers','11c'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/platform/storage',
        component: ComponentCreator('/platform/storage','9c4'),
        exact: true,
        sidebar: "platformSidebar"
      },
      {
        path: '/reference',
        component: ComponentCreator('/reference','4a8'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/cli',
        component: ComponentCreator('/reference/cli','a42'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/cli/nhost-cli',
        component: ComponentCreator('/reference/cli/nhost-cli','0ee'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth',
        component: ComponentCreator('/reference/hasura-auth','0d1'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth/api-reference',
        component: ComponentCreator('/reference/hasura-auth/api-reference','f9c'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth/configuration',
        component: ComponentCreator('/reference/hasura-auth/configuration','c74'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth/environment-variables',
        component: ComponentCreator('/reference/hasura-auth/environment-variables','c05'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth/installation',
        component: ComponentCreator('/reference/hasura-auth/installation','b8c'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/hasura-auth/schema',
        component: ComponentCreator('/reference/hasura-auth/schema','573'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/nextjs',
        component: ComponentCreator('/reference/nextjs','f05'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/nextjs/configuration',
        component: ComponentCreator('/reference/nextjs/configuration','528'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/nextjs/introduction',
        component: ComponentCreator('/reference/nextjs/introduction','65f'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/nextjs/protecting-routes',
        component: ComponentCreator('/reference/nextjs/protecting-routes','bb6'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/react',
        component: ComponentCreator('/reference/react','cf3'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/react/apollo',
        component: ComponentCreator('/reference/react/apollo','ea7'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/react/getting-started',
        component: ComponentCreator('/reference/react/getting-started','886'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/react/hooks',
        component: ComponentCreator('/reference/react/hooks','6b1'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/react/protecting-routes',
        component: ComponentCreator('/reference/react/protecting-routes','544'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/sdk',
        component: ComponentCreator('/reference/sdk','231'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/sdk/authentication',
        component: ComponentCreator('/reference/sdk/authentication','db5'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/sdk/functions',
        component: ComponentCreator('/reference/sdk/functions','8ec'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/sdk/graphql',
        component: ComponentCreator('/reference/sdk/graphql','077'),
        exact: true,
        sidebar: "referenceSidebar"
      },
      {
        path: '/reference/sdk/storage',
        component: ComponentCreator('/reference/sdk/storage','7a2'),
        exact: true,
        sidebar: "referenceSidebar"
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*')
  }
];
