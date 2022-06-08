import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    chromeWebSecurity: false,
    // * for some reason, the mailhog API is not systematically available
    // * when using `localhost` instead of `127.0.0.1`
    mailHogUrl: 'http://127.0.0.1:8025'
  }
} as Cypress.ConfigOptions)
