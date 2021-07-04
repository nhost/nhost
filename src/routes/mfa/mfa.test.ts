import 'jest-extended'

import { request } from 'test/server'

import { authenticator } from 'otplib'
import { end, saveJwt, validJwt, validRefreshToken, statusCode } from 'test/supertest-shared-utils'

import { Response } from 'superagent'
import { registerAccount, registerAndLoginAccount } from 'test/utils'

function saveTicket(saver: (t: string) => any) {
  return (res: Response) => {
    saver(res.body.ticket)
  }
}

function validTicket() {
  return (res: Response) => {
    expect(res.body.mfa).toBeTrue()
    expect(res.body.ticket).toBeString()
  }
}

function saveOtpSecret(saver: (o: string) => any) {
  return (res: Response) => {
    saver(res.body.otpSecret)
  }
}

function validOtpSecret() {
  return (res: Response) => {
    expect(res.body.imageUrl).toBeString()
    expect(res.body.otpSecret).toBeString()
  }
}

it('should generate a secret', (done) => {
  let jwtToken = ''

  registerAccount(request).then(({ email, password }) => {
    request
      .post('/login')
      .send({ email, password })
      .expect(statusCode(200))
      .expect(saveJwt((j) => (jwtToken = j)))
      .end((err) => {
        if (err) return done(err)

        request
          .post('/mfa/generate')
          .set({ Authorization: `Bearer ${jwtToken}` })
          .expect(statusCode(200))
          .expect(validOtpSecret())
          .end(end(done))
      })
  })
})

it('should enable mfa for user', (done) => {
  let jwtToken = ''
  let otpSecret = ''

  registerAccount(request).then(({ email, password }) => {
    request
      .post('/login')
      .send({ email, password })
      .expect(statusCode(200))
      .expect(saveJwt((j) => (jwtToken = j)))
      .end((err) => {
        if (err) return done(err)

        request
          .post('/mfa/generate')
          .set({ Authorization: `Bearer ${jwtToken}` })
          .expect(statusCode(200))
          .expect(validOtpSecret())
          .expect(saveOtpSecret((o) => (otpSecret = o)))
          .end((err) => {
            if (err) return done(err)

            request
              .post('/mfa/enable')
              .set({ Authorization: `Bearer ${jwtToken}` })
              .send({ code: authenticator.generate(otpSecret) })
              .expect(statusCode(204))
              .end(end(done))
          })
      })
  })
})

it('should sign the user in (mfa)', (done) => {
  let otpSecret = ''
  let ticket = ''

  registerAndLoginAccount(request).then(({ email, password, jwtToken }) => {
    request
      .post('/mfa/generate')
      .set({ Authorization: `Bearer ${jwtToken}` })
      .expect(statusCode(200))
      .expect(validOtpSecret())
      .expect(saveOtpSecret((o) => (otpSecret = o)))
      .end((err) => {
        if (err) return done(err)

        request
          .post('/mfa/enable')
          .set({ Authorization: `Bearer ${jwtToken}` })
          .send({ code: authenticator.generate(otpSecret) })
          .expect(statusCode(204))
          .end((err) => {
            if (err) return done(err)

            request
              .post('/login')
              .send({ email, password })
              .expect(statusCode(200))
              .expect(validTicket())
              .expect(saveTicket((t) => (ticket = t)))
              .end((err) => {
                if (err) return done(err)

                request
                  .post('/mfa/totp')
                  .send({
                    ticket,
                    code: authenticator.generate(otpSecret)
                  })
                  .expect(statusCode(200))
                  .expect(validJwt())
                  .expect(validRefreshToken())
                  .end(end(done))
              })
          })
      })
  })
})

it('should disable mfa for user', (done) => {
  let otpSecret = ''
  let ticket = ''
  let secondJwtToken = ''

  registerAndLoginAccount(request).then(({ email, password, jwtToken }) => {
    request
      .post('/mfa/generate')
      .set({ Authorization: `Bearer ${jwtToken}` })
      .expect(statusCode(200))
      .expect(validOtpSecret())
      .expect(saveOtpSecret((o) => (otpSecret = o)))
      .end((err) => {
        if (err) return done(err)

        request
          .post('/mfa/enable')
          .send({ code: authenticator.generate(otpSecret) })
          .set({ Authorization: `Bearer ${jwtToken}` })
          .expect(statusCode(204))
          .end((err) => {
            if (err) return done(err)

            request
              .post('/login')
              .send({ email, password })
              .expect(statusCode(200))
              .expect(validTicket())
              .expect(saveTicket((t) => (ticket = t)))
              .end((err) => {
                if (err) return done(err)

                request
                  .post('/mfa/totp')
                  .send({
                    ticket,
                    code: authenticator.generate(otpSecret)
                  })
                  .expect(statusCode(200))
                  .expect(validJwt())
                  .expect(saveJwt((j) => (secondJwtToken = j)))
                  .expect(validRefreshToken())
                  .end((err) => {
                    if (err) return done(err)

                    request
                      .post('/mfa/disable')
                      .set({ Authorization: `Bearer ${secondJwtToken}` })
                      .send({ code: authenticator.generate(otpSecret) })
                      .expect(statusCode(204))
                      .end(end(done))
                  })
              })
          })
      })
  })
})

it('should not generate mfa qr if mfa enabled for user', (done) => {
  let otpSecret = ''

  registerAndLoginAccount(request).then(({ email, password, jwtToken }) => {
    request
      .post('/mfa/generate')
      .set({ Authorization: `Bearer ${jwtToken}` })
      .expect(statusCode(200))
      .expect(validOtpSecret())
      .expect(saveOtpSecret((o) => (otpSecret = o)))
      .end((err) => {
        if (err) return done(err)

        request
          .post('/mfa/enable')
          .send({ code: authenticator.generate(otpSecret) })
          .set({ Authorization: `Bearer ${jwtToken}` })
          .expect(statusCode(204))
          .end((err) => {
            if (err) return done(err)

            request
              .post('/login')
              .send({ email, password })
              .expect(statusCode(200))
              .expect(validTicket())
              .end((err) => {
                if (err) return done(err)

                request
                  .post('/mfa/generate')
                  .set({ Authorization: `Bearer ${jwtToken}` })
                  .expect(statusCode(400))
                  .end(end(done))
              })
          })
      })
  })
})
