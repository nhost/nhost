import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    chromeWebSecurity: false,
    mailHogUrl: 'http://localhost:8025'
  }
} as Cypress.ConfigOptions)
