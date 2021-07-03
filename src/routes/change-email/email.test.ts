import 'jest-extended'

import { mailHogSearch, deleteMailHogEmail, generateRandomEmail, withEnv } from 'test/utils'
import { registerAndLoginAccount } from 'test/utils'

import { request } from 'test/server'
import { end, statusCode } from 'test/supertest-shared-utils'

it('should request to change email and receive a ticket by email', (done) => {
  withEnv(
    {
      EMAILS_ENABLED: 'true',
      VERIFY_EMAILS: 'true',
      AUTO_ACTIVATE_NEW_USERS: 'true'
    },
    request,
    (done) => {
      registerAndLoginAccount(request).then(({ jwtToken }) => {
        const newEmail = generateRandomEmail()

        request
          .post(`/change-email/request`)
          .set({ Authorization: `Bearer ${jwtToken}` })
          .send({ newEmail })
          .expect(statusCode(204))
          .end(async (err) => {
            if (err) return done(err)

            const [message] = await mailHogSearch(newEmail)
            expect(message).toBeTruthy()
            expect(message.Content.Headers.Subject).toInclude('Change your email address')
            expect(message.Content.Headers['X-Ticket'][0]).toBeString()
            await deleteMailHogEmail(message)

            done()
          })
      })
    },
    done
  )
})

it('should change the email from a ticket', (done) => {
  withEnv(
    {
      EMAILS_ENABLED: 'true',
      VERIFY_EMAILS: 'true',
      AUTO_ACTIVATE_NEW_USERS: 'true'
    },
    request,
    (done) => {
      registerAndLoginAccount(request).then(({ jwtToken }) => {
        const newEmail = generateRandomEmail()
        let ticket = ''

        request
          .post(`/change-email/request`)
          .set({ Authorization: `Bearer ${jwtToken}` })
          .send({ newEmail })
          .expect(statusCode(204))
          .end(async (err) => {
            if (err) return done(err)

            const [message] = await mailHogSearch(newEmail)
            expect(message).toBeTruthy()
            expect(message.Content.Headers.Subject).toInclude('Change your email address')
            ticket = message.Content.Headers['X-Ticket'][0]
            if (!ticket) {
              return done(new Error('No ticket sent in email'))
            }
            await deleteMailHogEmail(message)

            request
              .post(`/change-email/change`)
              .set({ Authorization: `Bearer ${jwtToken}` })
              .send({ ticket })
              .expect(statusCode(204))
              .end(end(done))
          })
      })
    },
    done
  )
})

it('should reconnect using the new email', (done) => {
  withEnv(
    {
      EMAILS_ENABLED: 'true',
      VERIFY_EMAILS: 'true',
      AUTO_ACTIVATE_NEW_USERS: 'true'
    },
    request,
    (done) => {
      registerAndLoginAccount(request).then(({ email, password, jwtToken }) => {
        const newEmail = generateRandomEmail()
        let ticket = ''

        request
          .post(`/change-email/request`)
          .set({ Authorization: `Bearer ${jwtToken}` })
          .send({ newEmail })
          .expect(statusCode(204))
          .end(async (err) => {
            if (err) return done(err)

            const [message] = await mailHogSearch(newEmail)
            expect(message).toBeTruthy()
            expect(message.Content.Headers.Subject).toInclude('Change your email address')
            ticket = message.Content.Headers['X-Ticket'][0]
            expect(ticket).toBeString()
            await deleteMailHogEmail(message)

            request
              .post(`/change-email/change`)
              .set({ Authorization: `Bearer ${jwtToken}` })
              .send({ ticket })
              .expect(statusCode(204))
              .end((err) => {
                if (err) return done(err)

                request
                  .post('/login')
                  .send({ email: newEmail, password })
                  .expect(statusCode(200))
                  .end(end(done))
              })
          })
      })
    },
    done
  )
})
