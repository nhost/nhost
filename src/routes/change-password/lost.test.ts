import 'jest-extended'

import { request } from 'test/server'
import {
  mailHogSearch,
  deleteMailHogEmail,
  withEnv,
  registerAccount,
  generateRandomString
} from 'test/utils'
import { end, statusCode } from 'test/supertest-shared-utils'

describe('Reset lost password', () => {
  let ticket: string

  it('should request a reset ticket to be sent by email', (done) => {
    withEnv(
      {
        AUTO_ACTIVATE_NEW_USERS: 'false',
        LOST_PASSWORD_ENABLED: 'true'
      },
      request,
      (done) => {
        registerAccount(request).then(({ email }) => {
          request
            .post('/change-password/request')
            .send({ email: email })
            .expect(statusCode(204))
            .end(end(done))
        })
      },
      done
    )
  })

  it('should receive a ticket by email', (done) => {
    withEnv(
      {
        LOST_PASSWORD_ENABLED: 'true'
      },
      request,
      (done) => {
        registerAccount(request).then(({ email }) => {
          request
            .post('/change-password/request')
            .send({ email: email })
            .expect(statusCode(204))
            .end(async (err) => {
              if (err) return done(err)

              const [message] = await mailHogSearch(email)
              expect(message).toBeTruthy()
              expect(message.Content.Headers.Subject).toInclude('Reset your password')
              ticket = message.Content.Headers['X-Ticket'][0]
              expect(ticket).toBeString()
              await deleteMailHogEmail(message)

              done()
            })
        })
      },
      done
    )
  })

  it('should change the password from a ticket', (done) => {
    withEnv(
      {
        LOST_PASSWORD_ENABLED: 'true'
      },
      request,
      (done) => {
        registerAccount(request).then(({ email }) => {
          request
            .post('/change-password/request')
            .send({ email: email })
            .expect(statusCode(204))
            .end(async (err) => {
              if (err) return done(err)

              const [message] = await mailHogSearch(email)
              expect(message).toBeTruthy()
              expect(message.Content.Headers.Subject).toInclude('Reset your password')
              ticket = message.Content.Headers['X-Ticket'][0]
              expect(ticket).toBeString()
              await deleteMailHogEmail(message)

              request
                .post('/change-password/change')
                .send({
                  ticket,
                  newPassword: generateRandomString()
                })
                .expect(statusCode(204))
                .end(end(done))
            })
        })
      },
      done
    )
  })
})
